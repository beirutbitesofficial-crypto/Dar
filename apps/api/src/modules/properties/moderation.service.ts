import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  canViewStaffPropertyRecord,
  isAdmin,
  listingMachine,
  ListingStatus,
  maskPhone,
  ownerSaleEstimate,
  ownerRentalPreview,
  sanitizeForType,
} from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { big, dateOnly, ref, toCentsOrNull, toDbDate } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { MediaService } from './media.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /** Everything awaiting a human decision. */
  async queue() {
    const [listings, revisions, photos, reports] = await Promise.all([
      this.prisma.property.findMany({
        where: { status: 'PENDING_REVIEW' },
        orderBy: { submittedAt: 'asc' },
        select: { id: true, refNo: true, titleAr: true, listingType: true, propertyType: true, submittedAt: true, contactFlags: true, demo: true, owner: { select: { fullName: true } } },
      }),
      this.prisma.propertyRevision.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: { property: { select: { id: true, refNo: true, titleAr: true } } },
      }),
      this.prisma.media.findMany({
        where: { reviewStatus: 'PENDING', status: 'READY', removedAt: null, kind: { in: ['PHOTO', 'VIDEO'] }, property: { status: { in: ['PUBLISHED', 'PAUSED'] } } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, kind: true, propertyId: true, storageKey: true, createdAt: true },
      }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
    ]);
    const urls = await this.media.urls(photos);
    return {
      listings: listings.map((l) => ({ ...l, ref: ref('DAR', l.refNo), contactFlagged: !!l.contactFlags })),
      revisions: revisions.map((r) => ({ id: r.id, propertyId: r.propertyId, ref: ref('DAR', r.property.refNo), title: r.property.titleAr, changes: r.changes, contactFlags: r.contactFlags, createdAt: r.createdAt })),
      media: photos.map((m) => ({ id: m.id, kind: m.kind, propertyId: m.propertyId, url: urls.get(m.id) ?? null, createdAt: m.createdAt })),
      openReports: reports,
    };
  }

  /**
   * Full staff record including private fields. Admins and the assigned
   * employee only. Every view is recorded in the audit trail.
   */
  async staffView(actor: RequestActor, id: string, ip?: string) {
    const p = await this.prisma.property.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, fullName: true, phone: true, email: true } },
        assignedEmployee: { select: { id: true, fullName: true } },
        area: true,
        town: true,
        neighborhood: true,
        media: { where: { removedAt: null }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!p) throw new NotFoundException();
    authorize(canViewStaffPropertyRecord(actor, p));
    await this.audit.log({ actorId: actor.id, action: 'sensitive.owner_contact_viewed', entityType: 'Property', entityId: id, ip });
    if (p.latitude) await this.audit.log({ actorId: actor.id, action: 'sensitive.exact_location_viewed', entityType: 'Property', entityId: id, ip });
    const urls = await this.media.urls(p.media.filter((m) => m.kind !== 'DOCUMENT'));
    const settings = await this.settings.current();
    const price = toCentsOrNull(p.priceCents);
    const notes = await this.prisma.internalNote.findMany({ where: { entityType: 'PROPERTY', entityId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return {
      ...p,
      ref: ref('DAR', p.refNo),
      priceCents: price,
      latitude: p.latitude ? Number(p.latitude) : null,
      longitude: p.longitude ? Number(p.longitude) : null,
      availableFrom: dateOnly(p.availableFrom),
      area: p.area ? { id: p.area.id, nameAr: p.area.nameAr, nameEn: p.area.nameEn } : null,
      town: p.town ? { id: p.town.id, nameAr: p.town.nameAr, nameEn: p.town.nameEn } : null,
      neighborhood: p.neighborhood ? { id: p.neighborhood.id, nameAr: p.neighborhood.nameAr, nameEn: p.neighborhood.nameEn } : null,
      media: p.media.map((m) => ({
        id: m.id, kind: m.kind, status: m.status, reviewStatus: m.reviewStatus, reviewReason: m.reviewReason,
        isCover: m.isCover, fileName: m.fileName, ocrText: m.ocrText, url: urls.get(m.id) ?? null,
        // Documents are fetched one at a time through an audited, short-lived link.
        documentLink: m.kind === 'DOCUMENT' ? `/v1/staff/documents/${m.id}` : null,
      })),
      estimate:
        price && p.listingType === 'SALE'
          ? ownerSaleEstimate(price, settings.sale)
          : price && p.listingType === 'RENT'
            ? ownerRentalPreview(price, { mode: p.rentPricingMode ?? settings.rental.mode, monthlyFeeCents: settings.rental.monthlyFeeCents })
            : null,
      internalNotes: notes,
      allowedTransitions: listingMachine.next(p.status as ListingStatus, isAdmin(actor) ? 'ADMIN' : 'STAFF'),
    };
  }

  async approve(actor: RequestActor, id: string, opts: { assignedEmployeeId?: string; featured?: boolean }) {
    const p = await this.prisma.property.findUniqueOrThrow({ where: { id } });
    listingMachine.assert(p.status as ListingStatus, 'PUBLISHED', 'ADMIN');
    if (opts.assignedEmployeeId) await this.assertEmployee(opts.assignedEmployeeId);
    if (!p.assignedEmployeeId && !opts.assignedEmployeeId) {
      throw new BadRequestException({ code: 'EMPLOYEE_REQUIRED', message: 'Assign an employee before publishing' });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          approvedAt: now,
          approvedById: actor.id,
          publishedAt: p.publishedAt ?? now,
          rejectionReason: null,
          assignedEmployeeId: opts.assignedEmployeeId ?? p.assignedEmployeeId,
          featured: opts.featured ?? p.featured,
          version: { increment: 1 },
        },
      });
      // Photos/videos submitted with the listing were reviewed as part of it.
      await tx.media.updateMany({
        where: { propertyId: id, reviewStatus: 'PENDING', status: 'READY', removedAt: null },
        data: { reviewStatus: 'APPROVED', reviewedById: actor.id },
      });
      await this.audit.log({ actorId: actor.id, action: 'listing.approved', entityType: 'Property', entityId: id }, tx);
    });
    await this.notifications.notify({
      userId: p.ownerId,
      templateKey: 'listing.approved',
      vars: { ref: ref('DAR', p.refNo) },
      data: { propertyId: id },
      dedupeKey: `listing.approved:${id}:${now.getTime()}`,
    });
    return { ok: true };
  }

  async reject(actor: RequestActor, id: string, reason: string) {
    const p = await this.prisma.property.findUniqueOrThrow({ where: { id } });
    listingMachine.assert(p.status as ListingStatus, 'REJECTED', 'ADMIN', { reason });
    await this.prisma.property.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason, version: { increment: 1 } } });
    await this.audit.log({ actorId: actor.id, action: 'listing.rejected', entityType: 'Property', entityId: id, metadata: { reason } });
    await this.notifications.notify({
      userId: p.ownerId,
      templateKey: 'listing.rejected',
      vars: { ref: ref('DAR', p.refNo), reason },
      data: { propertyId: id },
      dedupeKey: `listing.rejected:${id}:${Date.now()}`,
    });
    return { ok: true };
  }

  async adminTransition(actor: RequestActor, id: string, to: ListingStatus, reason?: string) {
    const p = await this.prisma.property.findUniqueOrThrow({ where: { id } });
    listingMachine.assert(p.status as ListingStatus, to, isAdmin(actor) ? 'ADMIN' : 'STAFF', { reason });
    if (!isAdmin(actor)) authorize(canViewStaffPropertyRecord(actor, p));
    await this.prisma.property.update({ where: { id }, data: { status: to, version: { increment: 1 } } });
    await this.audit.log({ actorId: actor.id, action: 'listing.status_changed', entityType: 'Property', entityId: id, metadata: { from: p.status, to, reason } });
    return { ok: true };
  }

  async decideRevision(actor: RequestActor, revisionId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    const rev = await this.prisma.propertyRevision.findUniqueOrThrow({ where: { id: revisionId }, include: { property: true } });
    if (rev.status !== 'PENDING') throw new BadRequestException({ code: 'REVISION_NOT_PENDING', message: 'Already decided' });
    if (decision === 'REJECT' && (!reason || reason.trim().length < 5)) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Reason required' });
    await this.prisma.$transaction(async (tx) => {
      if (decision === 'APPROVE') {
        const changes = sanitizeForType({ propertyType: rev.property.propertyType, ...(rev.changes as Record<string, any>) } as any) as Record<string, any>;
        const data: Prisma.PropertyUncheckedUpdateInput = {};
        for (const [k, v] of Object.entries(changes)) {
          if (k === 'priceCents') data.priceCents = big(v as number);
          else if (k === 'availableFrom') data.availableFrom = v ? toDbDate(v as string) : null;
          else (data as any)[k] = v;
        }
        await tx.property.update({ where: { id: rev.propertyId }, data: { ...data, approvedAt: new Date(), approvedById: actor.id, version: { increment: 1 } } });
      }
      await tx.propertyRevision.update({
        where: { id: revisionId },
        data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', pendingKey: null, reviewedById: actor.id, reviewedAt: new Date(), reviewReason: reason },
      });
      await this.audit.log(
        { actorId: actor.id, action: decision === 'APPROVE' ? 'listing.revision_approved' : 'listing.revision_rejected', entityType: 'Property', entityId: rev.propertyId, metadata: { revisionId, reason } },
        tx,
      );
    });
    await this.notifications.notify({
      userId: rev.property.ownerId,
      templateKey: decision === 'APPROVE' ? 'listing.revision_approved' : 'listing.revision_rejected',
      vars: { ref: ref('DAR', rev.property.refNo), reason: reason ?? '' },
      data: { propertyId: rev.propertyId },
      dedupeKey: `listing.revision:${revisionId}`,
    });
    return { ok: true };
  }

  /** Image review workflow: a human checks each photo for phone numbers, signs or faces before it goes public. */
  async reviewMedia(actor: RequestActor, mediaId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    const m = await this.prisma.media.findUniqueOrThrow({ where: { id: mediaId }, include: { property: { select: { ownerId: true, refNo: true } } } });
    await this.prisma.media.update({
      where: { id: mediaId },
      data: { reviewStatus: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewReason: reason ?? null, reviewedById: actor.id, ...(decision === 'REJECT' ? { isCover: false } : {}) },
    });
    await this.audit.log({ actorId: actor.id, action: 'media.reviewed', entityType: 'Media', entityId: mediaId, metadata: { decision, reason } });
    if (decision === 'REJECT' && m.property) {
      await this.notifications.notify({
        userId: m.property.ownerId,
        templateKey: 'media.rejected',
        vars: { ref: ref('DAR', m.property.refNo), reason: reason ?? '' },
        data: { propertyId: m.propertyId ?? '' },
        dedupeKey: `media.rejected:${mediaId}`,
      });
    }
    return { ok: true };
  }

  async assign(actor: RequestActor, id: string, employeeId: string) {
    await this.assertEmployee(employeeId);
    await this.prisma.property.update({ where: { id }, data: { assignedEmployeeId: employeeId, version: { increment: 1 } } });
    await this.audit.log({ actorId: actor.id, action: 'listing.assigned', entityType: 'Property', entityId: id, metadata: { employeeId } });
    return { ok: true };
  }

  async feature(actor: RequestActor, id: string, featured: boolean, rank: number) {
    const p = await this.prisma.property.findUniqueOrThrow({ where: { id }, select: { status: true } });
    if (featured && p.status !== 'PUBLISHED') throw new BadRequestException({ code: 'NOT_PUBLISHED', message: 'Only published listings can be featured' });
    await this.prisma.property.update({ where: { id }, data: { featured, featuredRank: rank } });
    await this.audit.log({ actorId: actor.id, action: 'listing.featured', entityType: 'Property', entityId: id, metadata: { featured, rank } });
    return { ok: true };
  }

  async listAll(filters: { status?: ListingStatus; q?: string; assignedEmployeeId?: string; page: number }, actor: RequestActor) {
    const where: Prisma.PropertyWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(isAdmin(actor) ? (filters.assignedEmployeeId ? { assignedEmployeeId: filters.assignedEmployeeId } : {}) : { assignedEmployeeId: actor.id }),
      ...(filters.q ? { OR: [{ titleAr: { contains: filters.q } }, { titleEn: { contains: filters.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (filters.page - 1) * 50,
        take: 50,
        select: {
          id: true, refNo: true, status: true, listingType: true, propertyType: true, titleAr: true, priceCents: true, featured: true, featuredRank: true, demo: true,
          updatedAt: true, town: { select: { nameAr: true, nameEn: true } }, assignedEmployee: { select: { id: true, fullName: true } },
          owner: { select: { fullName: true, phone: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);
    return {
      total,
      page: filters.page,
      items: rows.map((r) => ({ ...r, ref: ref('DAR', r.refNo), priceCents: toCentsOrNull(r.priceCents), owner: { fullName: r.owner.fullName, phoneMasked: maskPhone(r.owner.phone) } })),
    };
  }

  private async assertEmployee(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { roles: true, blocked: true } });
    if (!u || u.blocked || !u.roles.includes('EMPLOYEE')) throw new BadRequestException({ code: 'NOT_AN_EMPLOYEE', message: 'Choose an active employee' });
  }
}
