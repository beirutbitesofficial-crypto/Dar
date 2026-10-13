import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Property } from '@prisma/client';
import {
  canEditPropertyAsOwner,
  detectContactInfo,
  ListingStatus,
  listingMachine,
  missingForSubmission,
  OwnerListingSummary,
  OwnerViewingActivity,
  ownerRentalPreview,
  ownerSaleEstimate,
  PropertyDraftInput,
  sanitizeForType,
  splitEdit,
} from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { big, dateOnly, ref, toCentsOrNull, toDbDate } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LocationCache } from './location-cache.service';
import { MediaService } from './media.service';

const EDITABLE_DIRECTLY: ListingStatus[] = ['DRAFT', 'REJECTED', 'PENDING_REVIEW'];

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly locations: LocationCache,
    private readonly settings: SettingsService,
  ) {}

  private toData(input: PropertyDraftInput & { rentPricingMode?: any }): Prisma.PropertyUncheckedUpdateInput {
    const clean = sanitizeForType(input as any) as PropertyDraftInput;
    const data: Prisma.PropertyUncheckedUpdateInput = {};
    const copy = [
      'listingType', 'propertyType', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'areaId', 'townId', 'neighborhoodId',
      'exactAddress', 'latitude', 'longitude', 'sizeSqm', 'bedrooms', 'bathrooms', 'floor', 'totalFloors', 'furnished', 'amenities',
      'otherAmenities', 'ownerContactName', 'ownerContactPhone', 'ownerContactEmail', 'ownerNotesForStaff',
    ] as const;
    for (const k of copy) if (clean[k] !== undefined) (data as any)[k] = clean[k];
    if (clean.priceCents !== undefined) data.priceCents = big(clean.priceCents);
    if (clean.availableFrom !== undefined) data.availableFrom = clean.availableFrom ? toDbDate(clean.availableFrom) : null;
    return data;
  }

  private flags(p: { titleAr?: string | null; titleEn?: string | null; descriptionAr?: string | null; descriptionEn?: string | null; otherAmenities?: string | null }) {
    const text = [p.titleAr, p.titleEn, p.descriptionAr, p.descriptionEn, p.otherAmenities].filter(Boolean).join('\n');
    const findings = detectContactInfo(text);
    return findings.length ? (findings as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }

  async createDraft(actor: RequestActor, input: PropertyDraftInput) {
    if (!(await this.locations.validateHierarchy(input.areaId, input.townId, input.neighborhoodId))) {
      throw new BadRequestException({ code: 'LOCATION_INVALID', message: 'Location does not match' });
    }
    const settings = await this.settings.current();
    const data = this.toData(input);
    const p = await this.prisma.$transaction(async (tx) => {
      // Anyone can become an owner by listing a property; they keep their customer role.
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id }, select: { roles: true } });
      if (!user.roles.includes('OWNER')) await tx.user.update({ where: { id: actor.id }, data: { roles: { push: 'OWNER' } } });
      return tx.property.create({
        data: {
          ...(data as Prisma.PropertyUncheckedCreateInput),
          ownerId: actor.id,
          status: 'DRAFT',
          // The pricing mode in force when the owner entered the price decides
          // whether that price is the net rent or the total rent.
          rentPricingMode: input.listingType === 'RENT' ? settings.rental.mode : null,
          contactFlags: this.flags(input),
        },
      });
    });
    return this.ownerView(actor, p.id);
  }

  async update(actor: RequestActor, id: string, input: PropertyDraftInput) {
    const p = await this.load(id);
    authorize(canEditPropertyAsOwner(actor, p));
    if (['SOLD', 'ARCHIVED', 'RENTED'].includes(p.status)) throw new BadRequestException({ code: 'LISTING_CLOSED', message: 'This listing can no longer be edited' });
    const merged = { ...p, ...input };
    if (!(await this.locations.validateHierarchy(merged.areaId, merged.townId, merged.neighborhoodId))) {
      throw new BadRequestException({ code: 'LOCATION_INVALID', message: 'Location does not match' });
    }
    if (input.listingType && input.listingType !== p.listingType && !EDITABLE_DIRECTLY.includes(p.status as ListingStatus)) {
      throw new BadRequestException({ code: 'LISTING_TYPE_LOCKED', message: 'Sale/rent cannot change after publication' });
    }

    if (EDITABLE_DIRECTLY.includes(p.status as ListingStatus)) {
      const settings = await this.settings.current();
      await this.prisma.property.update({
        where: { id },
        data: {
          ...this.toData({ ...input, propertyType: input.propertyType ?? p.propertyType ?? undefined } as any),
          rentPricingMode: (input.listingType ?? p.listingType) === 'RENT' ? (p.rentPricingMode ?? settings.rental.mode) : null,
          contactFlags: this.flags({ ...p, ...input }),
          version: { increment: 1 },
        },
      });
      return this.ownerView(actor, id);
    }

    // Published/paused: sensitive public changes wait for review; the approved version stays public.
    // Only fields whose value actually changed are considered (clients may resend the whole form).
    const current: Record<string, unknown> = { ...p, priceCents: toCentsOrNull(p.priceCents), availableFrom: dateOnly(p.availableFrom) };
    const changed = Object.fromEntries(
      Object.entries(input).filter(([k, v]) => v !== undefined && JSON.stringify(v) !== JSON.stringify(current[k] ?? null)),
    );
    const { sensitive, direct, needsReview } = splitEdit(changed);
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(direct).length) {
        await tx.property.update({ where: { id }, data: { ...this.toData(direct as PropertyDraftInput), version: { increment: 1 } } });
      }
      if (needsReview) {
        const pending = await tx.propertyRevision.findUnique({ where: { pendingKey: id } });
        const changes = { ...((pending?.changes as object) ?? {}), ...sensitive };
        const contactFlags = this.flags({ ...p, ...(changes as any) });
        if (pending) {
          await tx.propertyRevision.update({ where: { id: pending.id }, data: { changes: changes as any, contactFlags } });
        } else {
          await tx.propertyRevision.create({
            data: { propertyId: id, pendingKey: id, changes: changes as any, contactFlags, submittedById: actor.id },
          });
        }
      }
    });
    return this.ownerView(actor, id);
  }

  async submit(actor: RequestActor, id: string) {
    const p = await this.load(id);
    authorize(canEditPropertyAsOwner(actor, p));
    listingMachine.assert(p.status as ListingStatus, 'PENDING_REVIEW', 'OWNER');
    const photos = await this.prisma.media.findMany({ where: { propertyId: id, kind: 'PHOTO', removedAt: null, status: 'READY' }, select: { isCover: true } });
    const missing = missingForSubmission({
      ...p,
      priceCents: toCentsOrNull(p.priceCents),
      photoCount: photos.length,
      hasCover: photos.some((x) => x.isCover),
    } as any);
    if (missing.length) throw new BadRequestException({ code: 'LISTING_INCOMPLETE', message: 'Listing is incomplete', details: { missing } });
    await this.prisma.property.update({
      where: { id },
      data: { status: 'PENDING_REVIEW', submittedAt: new Date(), rejectionReason: null, contactFlags: this.flags(p), version: { increment: 1 } },
    });
    await this.audit.log({ actorId: actor.id, action: 'listing.submitted', entityType: 'Property', entityId: id });
    return this.ownerView(actor, id);
  }

  async ownerTransition(actor: RequestActor, id: string, to: 'DRAFT' | 'PAUSED' | 'PUBLISHED' | 'ARCHIVED') {
    const p = await this.load(id);
    authorize(canEditPropertyAsOwner(actor, p));
    listingMachine.assert(p.status as ListingStatus, to, 'OWNER');
    if (to === 'PUBLISHED' && !p.approvedAt) throw new BadRequestException({ code: 'NOT_APPROVED', message: 'Listing was never approved' });
    await this.prisma.property.update({ where: { id }, data: { status: to, version: { increment: 1 } } });
    await this.audit.log({ actorId: actor.id, action: 'listing.status_changed', entityType: 'Property', entityId: id, metadata: { from: p.status, to } });
    return this.ownerView(actor, id);
  }

  async withdrawRevision(actor: RequestActor, id: string) {
    const p = await this.load(id);
    authorize(canEditPropertyAsOwner(actor, p));
    await this.prisma.propertyRevision.updateMany({ where: { pendingKey: id }, data: { status: 'WITHDRAWN', pendingKey: null } });
    return { ok: true };
  }

  async listMine(actor: RequestActor): Promise<OwnerListingSummary[]> {
    const rows = await this.prisma.property.findMany({
      where: { ownerId: actor.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        media: { where: { kind: 'PHOTO', isCover: true, removedAt: null, status: 'READY' }, take: 1 },
        revisions: { where: { status: 'PENDING' }, select: { id: true } },
        _count: { select: { viewings: true } },
      },
    });
    const urls = await this.media.urls(rows.flatMap((r) => r.media));
    return rows.map((r) => ({
      id: r.id,
      ref: ref('DAR', r.refNo),
      status: r.status as ListingStatus,
      listingType: r.listingType!,
      propertyType: r.propertyType!,
      titleAr: r.titleAr ?? '',
      priceCents: toCentsOrNull(r.priceCents) ?? 0,
      rejectionReason: r.rejectionReason,
      hasPendingRevision: r.revisions.length > 0,
      coverUrl: r.media[0] ? urls.get(r.media[0].id) ?? null : null,
      viewingCount: r._count.viewings,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /** Full view for the owner — includes the private fields they entered themselves. */
  async ownerView(actor: RequestActor, id: string) {
    const p = await this.prisma.property.findUnique({
      where: { id },
      include: {
        media: { where: { removedAt: null }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] },
        revisions: { where: { status: { in: ['PENDING', 'REJECTED'] } }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!p) throw new NotFoundException();
    authorize(canEditPropertyAsOwner(actor, p));
    const urls = await this.media.urls(p.media.filter((m) => m.kind !== 'DOCUMENT'));
    const settings = await this.settings.current();
    const price = toCentsOrNull(p.priceCents);
    return {
      id: p.id,
      ref: ref('DAR', p.refNo),
      status: p.status,
      listingType: p.listingType,
      propertyType: p.propertyType,
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      areaId: p.areaId,
      townId: p.townId,
      neighborhoodId: p.neighborhoodId,
      exactAddress: p.exactAddress,
      latitude: p.latitude ? Number(p.latitude) : null,
      longitude: p.longitude ? Number(p.longitude) : null,
      priceCents: price,
      rentPricingMode: p.rentPricingMode,
      sizeSqm: p.sizeSqm,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      totalFloors: p.totalFloors,
      furnished: p.furnished,
      amenities: p.amenities,
      otherAmenities: p.otherAmenities,
      availableFrom: dateOnly(p.availableFrom),
      ownerContactName: p.ownerContactName,
      ownerContactPhone: p.ownerContactPhone,
      ownerContactEmail: p.ownerContactEmail,
      ownerNotesForStaff: p.ownerNotesForStaff,
      contactFlagged: !!p.contactFlags,
      rejectionReason: p.rejectionReason,
      pendingRevision: p.revisions[0]
        ? { status: p.revisions[0].status, changes: p.revisions[0].changes, reason: p.revisions[0].reviewReason }
        : null,
      media: p.media.map((m) => ({
        id: m.id,
        kind: m.kind,
        status: m.status,
        reviewStatus: m.reviewStatus,
        reviewReason: m.reviewReason,
        isCover: m.isCover,
        sortOrder: m.sortOrder,
        fileName: m.fileName,
        url: urls.get(m.id) ?? null,
      })),
      estimate:
        price && p.listingType === 'SALE'
          ? { kind: 'SALE', ...ownerSaleEstimate(price, settings.sale) }
          : price && p.listingType === 'RENT'
            ? { kind: 'RENT', ...ownerRentalPreview(price, { mode: p.rentPricingMode ?? settings.rental.mode, monthlyFeeCents: settings.rental.monthlyFeeCents }) }
            : null,
      allowedTransitions: listingMachine.next(p.status as ListingStatus, 'OWNER'),
      demo: p.demo,
    };
  }

  /** Viewing activity for the owner: counts and dates only — no customer identity or contact. */
  async viewingActivity(actor: RequestActor, id: string): Promise<OwnerViewingActivity[]> {
    const p = await this.load(id);
    authorize(canEditPropertyAsOwner(actor, p));
    const rows = await this.prisma.viewingRequest.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, scheduledAt: true, createdAt: true },
      take: 100,
    });
    return rows.map((r) => ({ id: r.id, status: r.status, scheduledAt: r.scheduledAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
  }

  private async load(id: string): Promise<Property> {
    const p = await this.prisma.property.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    return p;
  }
}
