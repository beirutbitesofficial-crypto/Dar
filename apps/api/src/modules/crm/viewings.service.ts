import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertNoConflict,
  canViewViewingAsCustomer,
  computeRentalBreakdown,
  customerSaleEstimate,
  formatDateTimeBeirut,
  isAdmin,
  isAssignedEmployee,
  leadMachine,
  LeadStatus,
  ViewingRequestDto,
  viewingMachine,
  ViewingStatus,
} from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { big, ref, toCents } from '../../common/money';
import { PrismaService, Tx } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

const BUFFER_MINUTES = 15;

@Injectable()
export class ViewingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The exact fee disclosure a customer must accept for this listing right now. */
  async currentDisclosure(propertyId: string) {
    const p = await this.prisma.property.findFirst({
      where: { id: propertyId, status: 'PUBLISHED', approvedAt: { not: null } },
      select: { id: true, listingType: true, priceCents: true, rentPricingMode: true },
    });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Listing not available' });
    const s = await this.settings.current();
    const price = toCents(p.priceCents);
    if (p.listingType === 'SALE') {
      const e = customerSaleEstimate(price, s.sale);
      return { kind: 'SALE' as const, amountCents: e.buyerCommissionCents, rateBps: e.buyerBps, totalCents: e.buyerTotalCents, termsVersion: s.termsVersion, settingsVersion: s.version };
    }
    const b = computeRentalBreakdown(price, { mode: p.rentPricingMode ?? s.rental.mode, monthlyFeeCents: s.rental.monthlyFeeCents });
    return { kind: 'RENT' as const, amountCents: b.tenantTotalCents, feeCents: b.platformFeeCents, rateBps: null, termsVersion: s.termsVersion, settingsVersion: s.version };
  }

  async request(
    actor: RequestActor,
    input: {
      propertyId: string;
      preferredSlots: { date: string; period: 'MORNING' | 'AFTERNOON' | 'EVENING' }[];
      customerNotes?: string | null;
      acceptedTermsVersion: string;
      acceptedFeeCents: number;
      idempotencyKey: string;
    },
  ): Promise<ViewingRequestDto> {
    const existing = await this.prisma.viewingRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.customerId !== actor.id) throw new ConflictException({ code: 'DUPLICATE_REQUEST', message: 'Duplicate' });
      return this.toDto(existing.id);
    }
    const property = await this.prisma.property.findUnique({ where: { id: input.propertyId }, select: { ownerId: true, assignedEmployeeId: true, refNo: true, titleAr: true } });
    if (!property) throw new NotFoundException();
    if (property.ownerId === actor.id) throw new BadRequestException({ code: 'OWN_LISTING', message: 'This is your own listing' });

    const disclosure = await this.currentDisclosure(input.propertyId);
    // Recorded acceptance must match what the server would disclose right now.
    if (disclosure.termsVersion !== input.acceptedTermsVersion || disclosure.amountCents !== input.acceptedFeeCents) {
      throw new ConflictException({
        code: 'TERMS_CHANGED',
        message: 'Fees or terms changed; please review again',
        details: { current: disclosure },
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (input.preferredSlots.some((s) => s.date < today)) throw new BadRequestException({ code: 'SLOT_IN_PAST', message: 'Choose future dates' });

    const viewing = await this.prisma.serializable(async (tx) => {
      const lead = await this.openLead(tx, actor.id, input.propertyId, property.assignedEmployeeId, 'VIEWING_REQUEST');
      const v = await tx.viewingRequest.create({
        data: {
          propertyId: input.propertyId,
          customerId: actor.id,
          leadId: lead.id,
          assignedEmployeeId: lead.assignedEmployeeId,
          preferredSlots: input.preferredSlots as any,
          customerNotes: input.customerNotes ?? null,
          disclosedKind: disclosure.kind,
          disclosedAmountCents: big(disclosure.amountCents),
          disclosedRateBps: disclosure.rateBps,
          termsVersion: disclosure.termsVersion,
          settingsVersion: disclosure.settingsVersion,
          acceptedAt: new Date(),
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.ensureConversation(tx, actor.id, lead.id, input.propertyId, lead.assignedEmployeeId, ref('DAR', property.refNo), `viewing_requested:${v.id}`);
      return v;
    });
    if (viewing.assignedEmployeeId) {
      await this.notifications.notify({
        userId: viewing.assignedEmployeeId,
        templateKey: 'staff.viewing_requested',
        vars: { ref: ref('DAR', property.refNo) },
        data: { viewingId: viewing.id },
        dedupeKey: `staff.viewing_requested:${viewing.id}`,
      });
    }
    return this.toDto(viewing.id);
  }

  /** Finds or creates the single open lead for (customer, property); auto-assigns to the listing's employee. */
  async openLead(tx: Tx, customerId: string, propertyId: string, employeeId: string | null, source: 'VIEWING_REQUEST' | 'MESSAGE') {
    const openKey = `${propertyId}:${customerId}`;
    const found = await tx.lead.findUnique({ where: { openKey } });
    if (found) return found;
    const status: LeadStatus = employeeId ? 'ASSIGNED' : 'NEW';
    const lead = await tx.lead.create({ data: { propertyId, customerId, assignedEmployeeId: employeeId, status, source, openKey } });
    await tx.leadEvent.create({ data: { leadId: lead.id, type: 'CREATED', toStatus: status, data: { source } } });
    return lead;
  }

  async ensureConversation(tx: Tx, customerId: string, leadId: string, propertyId: string, employeeId: string | null, propertyRef: string, systemKey: string) {
    let conv = await tx.conversation.findFirst({ where: { customerId, leadId } });
    if (!conv) {
      conv = await tx.conversation.create({ data: { customerId, leadId, propertyId, assignedEmployeeId: employeeId, subject: propertyRef, lastMessageAt: new Date() } });
    }
    await tx.message.upsert({
      where: { senderId_clientMessageId: { senderId: customerId, clientMessageId: systemKey } },
      create: { conversationId: conv.id, senderId: customerId, senderRole: 'SYSTEM', body: `viewing.requested`, clientMessageId: systemKey },
      update: {},
    });
    await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
    return conv;
  }

  async listMine(actor: RequestActor): Promise<ViewingRequestDto[]> {
    const rows = await this.prisma.viewingRequest.findMany({ where: { customerId: actor.id }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    return Promise.all(rows.map((r) => this.toDto(r.id)));
  }

  async reschedule(actor: RequestActor, id: string, slots: ViewingRequestDto['preferredSlots'], notes?: string | null) {
    const v = await this.load(id);
    authorize(canViewViewingAsCustomer(actor, v));
    viewingMachine.assert(v.status as ViewingStatus, 'REQUESTED', 'CUSTOMER');
    await this.prisma.viewingRequest.update({
      where: { id },
      data: { status: 'REQUESTED', preferredSlots: slots as any, customerNotes: notes ?? v.customerNotes, scheduledAt: null, scheduledEndsAt: null, version: { increment: 1 } },
    });
    if (v.assignedEmployeeId) {
      await this.notifications.notify({ userId: v.assignedEmployeeId, templateKey: 'staff.viewing_rescheduled', data: { viewingId: id }, dedupeKey: `staff.viewing_rescheduled:${id}:${Date.now()}` });
    }
    return this.toDto(id);
  }

  async cancelByCustomer(actor: RequestActor, id: string) {
    const v = await this.load(id);
    authorize(canViewViewingAsCustomer(actor, v));
    viewingMachine.assert(v.status as ViewingStatus, 'CANCELLED', 'CUSTOMER');
    await this.prisma.viewingRequest.update({ where: { id }, data: { status: 'CANCELLED', cancelledReason: 'customer', version: { increment: 1 } } });
    return this.toDto(id);
  }

  // ---------------------------------------------------------------- staff

  async confirm(actor: RequestActor, id: string, input: { scheduledAt: string; durationMinutes: number; meetingInstructions?: string }) {
    const v = await this.load(id);
    authorize(isAdmin(actor) || isAssignedEmployee(actor, v));
    if (!v.assignedEmployeeId) throw new BadRequestException({ code: 'EMPLOYEE_REQUIRED', message: 'Assign an employee first' });
    viewingMachine.assert(v.status as ViewingStatus, 'CONFIRMED', isAdmin(actor) ? 'ADMIN' : 'STAFF');
    const startsAt = new Date(input.scheduledAt);
    if (startsAt.getTime() < Date.now()) throw new BadRequestException({ code: 'SLOT_IN_PAST', message: 'Time is in the past' });
    const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
    await this.prisma.serializable(async (tx) => {
      const others = await tx.viewingRequest.findMany({
        where: {
          assignedEmployeeId: v.assignedEmployeeId,
          status: 'CONFIRMED',
          id: { not: id },
          scheduledAt: { lt: new Date(endsAt.getTime() + BUFFER_MINUTES * 60_000) },
          scheduledEndsAt: { gt: new Date(startsAt.getTime() - BUFFER_MINUTES * 60_000) },
        },
        select: { id: true, assignedEmployeeId: true, scheduledAt: true, scheduledEndsAt: true },
      });
      assertNoConflict(
        { id, employeeId: v.assignedEmployeeId!, startsAt, endsAt },
        others.map((o) => ({ id: o.id, employeeId: o.assignedEmployeeId!, startsAt: o.scheduledAt!, endsAt: o.scheduledEndsAt! })),
        BUFFER_MINUTES,
      );
      // The database exclusion constraint is the final guard against races.
      await tx.viewingRequest.update({
        where: { id },
        data: { status: 'CONFIRMED', scheduledAt: startsAt, scheduledEndsAt: endsAt, meetingInstructions: input.meetingInstructions ?? null, version: { increment: 1 } },
      });
      if (v.leadId) await this.moveLead(tx, actor, v.leadId, 'VIEWING_SCHEDULED');
      await this.audit.log({ actorId: actor.id, action: 'viewing.confirmed', entityType: 'ViewingRequest', entityId: id }, tx);
    });
    const user = await this.prisma.user.findUnique({ where: { id: v.customerId }, select: { locale: true } });
    await this.notifications.notify({
      userId: v.customerId,
      templateKey: 'viewing.confirmed',
      vars: { date: formatDateTimeBeirut(startsAt, user?.locale === 'en' ? 'en' : 'ar') },
      data: { viewingId: id },
      dedupeKey: `viewing.confirmed:${id}:${startsAt.getTime()}`,
    });
    return this.toDto(id);
  }

  async outcome(actor: RequestActor, id: string, status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED', notes?: string) {
    const v = await this.load(id);
    authorize(isAdmin(actor) || isAssignedEmployee(actor, v));
    viewingMachine.assert(v.status as ViewingStatus, status, isAdmin(actor) ? 'ADMIN' : 'STAFF');
    await this.prisma.$transaction(async (tx) => {
      await tx.viewingRequest.update({ where: { id }, data: { status, outcomeNotes: notes ?? null, version: { increment: 1 } } });
      if (v.leadId && status === 'COMPLETED') await this.moveLead(tx, actor, v.leadId, 'VIEWED');
      await this.audit.log({ actorId: actor.id, action: 'viewing.outcome', entityType: 'ViewingRequest', entityId: id, metadata: { status } }, tx);
    });
    if (status === 'CANCELLED') {
      await this.notifications.notify({ userId: v.customerId, templateKey: 'viewing.cancelled', data: { viewingId: id }, dedupeKey: `viewing.cancelled:${id}` });
    }
    return this.toDto(id);
  }

  /** Moves a lead forward only when the transition is valid; otherwise leaves it. */
  private async moveLead(tx: Tx, actor: RequestActor, leadId: string, to: LeadStatus) {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    const who = isAdmin(actor) ? 'ADMIN' : 'STAFF';
    if (lead.status === to || !leadMachine.allowed(lead.status as LeadStatus, to, who)) return;
    await tx.lead.update({ where: { id: leadId }, data: { status: to, version: { increment: 1 } } });
    await tx.leadEvent.create({ data: { leadId, actorId: actor.id, type: 'STATUS', fromStatus: lead.status, toStatus: to } });
  }

  async calendar(actor: RequestActor, from: Date, to: Date, employeeId?: string) {
    const where: Prisma.ViewingRequestWhereInput = {
      status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
      scheduledAt: { gte: from, lt: to },
      ...(isAdmin(actor) ? (employeeId ? { assignedEmployeeId: employeeId } : {}) : { assignedEmployeeId: actor.id }),
    };
    const rows = await this.prisma.viewingRequest.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: { property: { select: { refNo: true, titleAr: true } }, customer: { select: { fullName: true } }, assignedEmployee: { select: { fullName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      scheduledAt: r.scheduledAt,
      scheduledEndsAt: r.scheduledEndsAt,
      propertyRef: ref('DAR', r.property.refNo),
      propertyTitle: r.property.titleAr,
      customerName: r.customer.fullName,
      employeeName: r.assignedEmployee?.fullName ?? null,
    }));
  }

  async staffQueue(actor: RequestActor) {
    const rows = await this.prisma.viewingRequest.findMany({
      where: { status: 'REQUESTED', ...(isAdmin(actor) ? {} : { assignedEmployeeId: actor.id }) },
      orderBy: { createdAt: 'asc' },
      include: { property: { select: { refNo: true, titleAr: true } }, customer: { select: { fullName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      propertyRef: ref('DAR', r.property.refNo),
      propertyTitle: r.property.titleAr,
      customerName: r.customer.fullName,
      preferredSlots: r.preferredSlots,
      customerNotes: r.customerNotes,
      assignedEmployeeId: r.assignedEmployeeId,
      leadId: r.leadId,
      createdAt: r.createdAt,
    }));
  }

  private async load(id: string) {
    const v = await this.prisma.viewingRequest.findUnique({ where: { id } });
    if (!v) throw new NotFoundException();
    return v;
  }

  async toDto(id: string): Promise<ViewingRequestDto> {
    const v = await this.prisma.viewingRequest.findUniqueOrThrow({
      where: { id },
      include: { property: { select: { refNo: true, titleAr: true, titleEn: true } }, assignedEmployee: { select: { fullName: true } } },
    });
    const conv = v.leadId ? await this.prisma.conversation.findFirst({ where: { leadId: v.leadId, customerId: v.customerId }, select: { id: true } }) : null;
    return {
      id: v.id,
      propertyId: v.propertyId,
      propertyRef: ref('DAR', v.property.refNo),
      propertyTitle: { ar: v.property.titleAr ?? '', en: v.property.titleEn },
      status: v.status,
      preferredSlots: v.preferredSlots as ViewingRequestDto['preferredSlots'],
      scheduledAt: v.scheduledAt?.toISOString() ?? null,
      customerNotes: v.customerNotes,
      disclosedFee: { kind: v.disclosedKind, amountCents: toCents(v.disclosedAmountCents), termsVersion: v.termsVersion },
      assignedEmployeeName: v.assignedEmployee?.fullName ?? null,
      conversationId: conv?.id ?? null,
      createdAt: v.createdAt.toISOString(),
      // Meeting instructions (exact address etc.) are only shared once confirmed.
      ...(v.status === 'CONFIRMED' ? { meetingInstructions: v.meetingInstructions } : {}),
    } as ViewingRequestDto;
  }

  assertCustomerOrStaff(actor: RequestActor, v: { customerId: string; assignedEmployeeId: string | null }) {
    if (!(actor.id === v.customerId || isAdmin(actor) || isAssignedEmployee(actor, v))) throw new ForbiddenException();
  }
}
