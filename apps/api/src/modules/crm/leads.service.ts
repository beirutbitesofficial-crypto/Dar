import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canViewLead, isAdmin, leadMachine, LeadStatus } from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { big, ref, toCents } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: RequestActor, filters: { status?: LeadStatus; employeeId?: string; page: number }) {
    const where: Prisma.LeadWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      // Employees only ever see leads assigned to them.
      ...(isAdmin(actor) ? (filters.employeeId ? { assignedEmployeeId: filters.employeeId } : {}) : { assignedEmployeeId: actor.id }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (filters.page - 1) * 50,
        take: 50,
        include: {
          property: { select: { refNo: true, titleAr: true, listingType: true } },
          customer: { select: { fullName: true } },
          assignedEmployee: { select: { fullName: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      total,
      page: filters.page,
      items: rows.map((l) => ({
        id: l.id,
        status: l.status,
        source: l.source,
        version: l.version,
        propertyId: l.propertyId,
        propertyRef: ref('DAR', l.property.refNo),
        propertyTitle: l.property.titleAr,
        listingType: l.property.listingType,
        customerName: l.customer.fullName,
        assignedEmployeeId: l.assignedEmployeeId,
        assignedEmployeeName: l.assignedEmployee?.fullName ?? null,
        lostReason: l.lostReason,
        updatedAt: l.updatedAt,
      })),
    };
  }

  async pipeline(actor: RequestActor) {
    const grouped = await this.prisma.lead.groupBy({
      by: ['status'],
      where: isAdmin(actor) ? {} : { assignedEmployeeId: actor.id },
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  }

  /** Full lead record, including the customer's private contact (audited). */
  async detail(actor: RequestActor, id: string, ip?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, refNo: true, titleAr: true, listingType: true, priceCents: true, assignedEmployeeId: true } },
        customer: { select: { id: true, fullName: true, phone: true, email: true, phoneVerifiedAt: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        offers: { orderBy: { createdAt: 'desc' } },
        viewings: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, scheduledAt: true, preferredSlots: true, customerNotes: true, outcomeNotes: true } },
        conversations: { select: { id: true } },
      },
    });
    if (!lead) throw new NotFoundException();
    authorize(canViewLead(actor, lead));
    await this.audit.log({ actorId: actor.id, action: 'sensitive.customer_contact_viewed', entityType: 'Lead', entityId: id, ip });
    const notes = await this.prisma.internalNote.findMany({ where: { entityType: 'LEAD', entityId: id }, orderBy: { createdAt: 'desc' } });
    return {
      ...lead,
      property: { ...lead.property, ref: ref('DAR', lead.property.refNo), priceCents: toCents(lead.property.priceCents) },
      offers: lead.offers.map((o) => ({ ...o, amountCents: toCents(o.amountCents) })),
      internalNotes: notes,
      allowedTransitions: leadMachine.next(lead.status as LeadStatus, isAdmin(actor) ? 'ADMIN' : 'STAFF'),
    };
  }

  async transition(actor: RequestActor, id: string, to: LeadStatus, reason?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    authorize(canViewLead(actor, lead));
    leadMachine.assert(lead.status as LeadStatus, to, isAdmin(actor) ? 'ADMIN' : 'STAFF', { reason });
    const closing = to === 'LOST';
    const updated = await this.prisma.lead.updateMany({
      where: { id, version: lead.version },
      data: {
        status: to,
        lostReason: closing ? reason : lead.lostReason,
        openKey: closing ? null : lead.openKey,
        closedAt: closing ? new Date() : null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ConflictException({ code: 'CONCURRENT_UPDATE', message: 'Lead changed; refresh and try again' });
    await this.prisma.leadEvent.create({ data: { leadId: id, actorId: actor.id, type: 'STATUS', fromStatus: lead.status, toStatus: to, data: reason ? { reason } : undefined } });
    await this.audit.log({ actorId: actor.id, action: 'lead.status_changed', entityType: 'Lead', entityId: id, metadata: { from: lead.status, to } });
    return { ok: true };
  }

  /**
   * Assignment uses optimistic concurrency: two admins assigning the same lead
   * at once cannot silently overwrite each other.
   */
  async assign(actor: RequestActor, id: string, employeeId: string, expectedVersion: number) {
    const emp = await this.prisma.user.findUnique({ where: { id: employeeId }, select: { roles: true, blocked: true } });
    if (!emp || emp.blocked || !emp.roles.includes('EMPLOYEE')) throw new BadRequestException({ code: 'NOT_AN_EMPLOYEE', message: 'Choose an active employee' });
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    if (lead.status === 'WON' || lead.status === 'LOST') throw new BadRequestException({ code: 'LEAD_CLOSED', message: 'Lead is closed' });
    const to: LeadStatus = lead.status === 'NEW' ? 'ASSIGNED' : (lead.status as LeadStatus);
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.lead.updateMany({ where: { id, version: expectedVersion }, data: { assignedEmployeeId: employeeId, status: to, version: { increment: 1 } } });
      if (r.count !== 1) return r;
      // Keep the lead's conversation and open viewings with the same employee.
      await tx.conversation.updateMany({ where: { leadId: id }, data: { assignedEmployeeId: employeeId } });
      await tx.viewingRequest.updateMany({ where: { leadId: id, status: 'REQUESTED' }, data: { assignedEmployeeId: employeeId } });
      await tx.leadEvent.create({ data: { leadId: id, actorId: actor.id, type: 'ASSIGNED', fromStatus: lead.status, toStatus: to, data: { employeeId } } });
      await this.audit.log({ actorId: actor.id, action: 'lead.assigned', entityType: 'Lead', entityId: id, metadata: { from: lead.assignedEmployeeId, to: employeeId } }, tx);
      return r;
    });
    if (result.count !== 1) throw new ConflictException({ code: 'CONCURRENT_UPDATE', message: 'Lead was changed by someone else; refresh and try again' });
    await this.notifications.notify({ userId: employeeId, templateKey: 'staff.lead_assigned', data: { leadId: id }, dedupeKey: `staff.lead_assigned:${id}:${expectedVersion}` });
    return { ok: true };
  }

  async addNote(actor: RequestActor, id: string, body: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    authorize(canViewLead(actor, lead));
    return this.prisma.internalNote.create({ data: { entityType: 'LEAD', entityId: id, authorId: actor.id, body } });
  }

  async addOffer(actor: RequestActor, id: string, input: { amountCents: number; party: string; notes?: string }) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    authorize(canViewLead(actor, lead));
    const offer = await this.prisma.offer.create({ data: { leadId: id, amountCents: big(input.amountCents), party: input.party, notes: input.notes, recordedById: actor.id } });
    await this.prisma.leadEvent.create({ data: { leadId: id, actorId: actor.id, type: 'OFFER', data: { offerId: offer.id, amountCents: input.amountCents, party: input.party } } });
    if (leadMachine.allowed(lead.status as LeadStatus, 'NEGOTIATION', isAdmin(actor) ? 'ADMIN' : 'STAFF')) {
      await this.transition(actor, id, 'NEGOTIATION');
    }
    return { ...offer, amountCents: input.amountCents };
  }
}
