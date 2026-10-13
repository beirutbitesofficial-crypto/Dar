import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canRecordCollection,
  deriveSaleObligationStatus,
  isAdmin,
  isAssignedEmployee,
  leadMachine,
  LeadStatus,
  listingMachine,
  ListingStatus,
  snapshotSaleTerms,
} from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { big, dateOnly, ref, toCents, toDbDate } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

type Party = 'BUYER' | 'SELLER';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * An employee (or admin) records the agreed sale. Commissions are computed
   * on the FINAL agreed price and frozen with the current fee rules. Fee
   * overrides are allowed only with a reason and take effect only when an
   * administrator approves the closing.
   */
  async request(
    actor: RequestActor,
    input: {
      propertyId: string;
      leadId?: string;
      buyerId: string;
      finalPriceCents: number;
      closingDate: string;
      override?: { sellerBps: number; buyerBps: number; reason: string };
      buyerAcceptance: { acceptedAt: string; channel: 'mobile' | 'in_person_recorded_by_staff' };
      sellerAcceptance: { acceptedAt: string; channel: 'mobile' | 'in_person_recorded_by_staff' };
      notes?: string;
    },
  ) {
    const p = await this.prisma.property.findUnique({ where: { id: input.propertyId } });
    if (!p) throw new NotFoundException();
    authorize(isAdmin(actor) || isAssignedEmployee(actor, p));
    if (p.listingType !== 'SALE') throw new BadRequestException({ code: 'NOT_A_SALE', message: 'Listing is not for sale' });
    if (!['PUBLISHED', 'PAUSED'].includes(p.status)) throw new BadRequestException({ code: 'LISTING_NOT_ACTIVE', message: 'Listing is not active' });
    if (input.buyerId === p.ownerId) throw new BadRequestException({ code: 'BUYER_IS_SELLER', message: 'Buyer and seller must differ' });
    const buyer = await this.prisma.user.findUnique({ where: { id: input.buyerId }, select: { id: true, anonymizedAt: true } });
    if (!buyer || buyer.anonymizedAt) throw new BadRequestException({ code: 'BUYER_INVALID', message: 'Unknown buyer' });

    const settings = await this.settings.current();
    const snap = snapshotSaleTerms(
      settings,
      input.finalPriceCents,
      input.override ? { rules: { sellerBps: input.override.sellerBps, buyerBps: input.override.buyerBps }, approvedByAdminId: 'PENDING_ADMIN_APPROVAL', reason: input.override.reason } : undefined,
    );
    const closing = await this.prisma.saleClosing.create({
      data: {
        propertyId: p.id,
        leadId: input.leadId,
        sellerId: p.ownerId,
        buyerId: input.buyerId,
        assignedEmployeeId: p.assignedEmployeeId,
        finalPriceCents: big(input.finalPriceCents),
        closingDate: toDbDate(input.closingDate),
        sellerBps: snap.rules.sellerBps,
        buyerBps: snap.rules.buyerBps,
        sellerCommissionCents: big(snap.sellerCommissionCents),
        buyerCommissionCents: big(snap.buyerCommissionCents),
        termsSnapshot: snap as any,
        settingsVersion: snap.settingsVersion,
        termsVersion: snap.termsVersion,
        overrideReason: input.override?.reason,
        buyerAcceptedAt: new Date(input.buyerAcceptance.acceptedAt),
        buyerAcceptanceChannel: input.buyerAcceptance.channel,
        sellerAcceptedAt: new Date(input.sellerAcceptance.acceptedAt),
        sellerAcceptanceChannel: input.sellerAcceptance.channel,
        requestedById: actor.id,
        notes: input.notes,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      action: 'sale.closing_requested',
      entityType: 'SaleClosing',
      entityId: closing.id,
      metadata: { finalPriceCents: input.finalPriceCents, override: !!input.override },
    });
    return this.detail(actor, closing.id);
  }

  async approve(actor: RequestActor, id: string) {
    authorize(isAdmin(actor));
    const c = await this.prisma.saleClosing.findUniqueOrThrow({ where: { id }, include: { property: true } });
    if (c.status !== 'PENDING_APPROVAL') throw new BadRequestException({ code: 'CLOSING_NOT_PENDING', message: 'Already decided' });
    listingMachine.assert(c.property.status as ListingStatus, 'SOLD', 'ADMIN');
    await this.prisma.serializable(async (tx) => {
      const snapshot = c.overrideReason ? { ...(c.termsSnapshot as object), overrideApprovedBy: actor.id } : c.termsSnapshot;
      // termsSnapshot can still change here because the closing is not yet APPROVED.
      await tx.saleClosing.update({
        where: { id },
        data: { termsSnapshot: snapshot as any },
      });
      await tx.saleClosing.update({
        where: { id },
        data: { status: 'APPROVED', approvedKey: c.propertyId, approvedById: actor.id, approvedAt: new Date() },
      });
      await tx.saleObligation.createMany({
        data: [
          { closingId: id, party: 'SELLER', amountDueCents: c.sellerCommissionCents },
          { closingId: id, party: 'BUYER', amountDueCents: c.buyerCommissionCents },
        ],
      });
      await tx.property.update({ where: { id: c.propertyId }, data: { status: 'SOLD', featured: false, version: { increment: 1 } } });
      await this.closeLeads(tx, actor.id, c.propertyId, c.leadId, 'Property sold');
      await this.audit.log({ actorId: actor.id, action: 'sale.closing_approved', entityType: 'SaleClosing', entityId: id, metadata: { overrideApproved: !!c.overrideReason } }, tx);
    });
    for (const userId of [c.buyerId, c.sellerId]) {
      await this.notifications.notify({ userId, templateKey: 'sale.closed', vars: { ref: ref('SALE', c.refNo) }, data: { closingId: id }, dedupeKey: `sale.closed:${id}:${userId}` });
    }
    return this.detail(actor, id);
  }

  /** Marks the winning lead WON and any other open leads on the property LOST. */
  private async closeLeads(tx: any, actorId: string, propertyId: string, winningLeadId: string | null, lostReason: string) {
    const open = await tx.lead.findMany({ where: { propertyId, openKey: { not: null } } });
    for (const lead of open) {
      const won = lead.id === winningLeadId;
      const to: LeadStatus = won ? 'WON' : 'LOST';
      if (won && !leadMachine.allowed(lead.status as LeadStatus, 'WON', 'SYSTEM')) {
        // Fast-tracked deals: record the jump explicitly in the lead history.
        await tx.leadEvent.create({ data: { leadId: lead.id, actorId, type: 'NOTE', data: { note: `Closed from ${lead.status}` } } });
      }
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: to, openKey: null, closedAt: new Date(), wonAt: won ? new Date() : null, lostReason: won ? null : lostReason, version: { increment: 1 } },
      });
      await tx.leadEvent.create({ data: { leadId: lead.id, actorId, type: 'STATUS', fromStatus: lead.status, toStatus: to } });
    }
  }

  async cancel(actor: RequestActor, id: string, reason: string) {
    authorize(isAdmin(actor));
    const c = await this.prisma.saleClosing.findUniqueOrThrow({ where: { id } });
    if (c.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException({ code: 'CLOSING_NOT_PENDING', message: 'Approved closings cannot be cancelled; record refunds or waivers instead' });
    }
    await this.prisma.saleClosing.update({ where: { id }, data: { status: 'CANCELLED', cancelledReason: reason } });
    await this.audit.log({ actorId: actor.id, action: 'sale.closing_cancelled', entityType: 'SaleClosing', entityId: id, metadata: { reason } });
    return { ok: true };
  }

  async recordEntry(
    actor: RequestActor,
    closingId: string,
    input: { party: Party; kind: 'PAYMENT' | 'REFUND'; amountCents: number; method: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; receivedOn: string; reference?: string; reason?: string; idempotencyKey: string },
  ) {
    const c = await this.prisma.saleClosing.findUniqueOrThrow({ where: { id: closingId }, include: { obligations: true } });
    if (c.status !== 'APPROVED') throw new BadRequestException({ code: 'CLOSING_NOT_APPROVED', message: 'Closing not approved' });
    if (input.kind === 'REFUND') authorize(isAdmin(actor));
    else authorize(canRecordCollection(actor, { landlordId: c.sellerId, tenantId: c.buyerId, assignedEmployeeId: c.assignedEmployeeId }));
    if (input.kind === 'REFUND' && !(input.reason && input.reason.trim().length >= 5)) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Reason required' });
    const ob = c.obligations.find((o) => o.party === input.party)!;
    const prior = await this.prisma.saleLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) return { entryId: prior.id, receiptNo: prior.receiptNo, duplicate: true };
    const entry = await this.prisma.serializable(async (tx) => {
      const e = await tx.saleLedgerEntry.create({
        data: {
          obligationId: ob.id,
          kind: input.kind,
          amountCents: big(input.kind === 'PAYMENT' ? input.amountCents : -input.amountCents),
          method: input.method,
          receivedOn: toDbDate(input.receivedOn),
          reference: input.reference,
          reason: input.reason,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.audit.log(
        { actorId: actor.id, action: input.kind === 'PAYMENT' ? 'sale.payment_recorded' : 'sale.refund_recorded', entityType: 'SaleObligation', entityId: ob.id, metadata: { entryId: e.id, amountCents: input.amountCents } },
        tx,
      );
      return e;
    });
    return { entryId: entry.id, receiptNo: entry.receiptNo, duplicate: false };
  }

  async reverse(actor: RequestActor, entryId: string, reason: string, idempotencyKey: string) {
    authorize(isAdmin(actor));
    const target = await this.prisma.saleLedgerEntry.findUniqueOrThrow({ where: { id: entryId } });
    const prior = await this.prisma.saleLedgerEntry.findUnique({ where: { idempotencyKey } });
    if (prior) return { entryId: prior.id, duplicate: true };
    const e = await this.prisma.serializable(async (tx) => {
      const rev = await tx.saleLedgerEntry.create({
        data: {
          obligationId: target.obligationId,
          kind: 'REVERSAL',
          amountCents: -target.amountCents,
          method: target.method,
          receivedOn: new Date(),
          reason,
          reversesEntryId: target.id,
          recordedById: actor.id,
          idempotencyKey,
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'sale.reversal_recorded', entityType: 'SaleLedgerEntry', entityId: target.id, metadata: { reason } }, tx);
      return rev;
    });
    return { entryId: e.id, duplicate: false };
  }

  async waive(actor: RequestActor, obligationId: string, reason: string) {
    authorize(isAdmin(actor));
    await this.prisma.saleObligation.update({ where: { id: obligationId }, data: { waivedAt: new Date(), waivedById: actor.id, waiveReason: reason } });
    await this.audit.log({ actorId: actor.id, action: 'sale.obligation_waived', entityType: 'SaleObligation', entityId: obligationId, metadata: { reason } });
    return { ok: true };
  }

  async list(actor: RequestActor, status?: string) {
    const rows = await this.prisma.saleClosing.findMany({
      where: { ...(status ? { status: status as any } : {}), ...(isAdmin(actor) ? {} : { assignedEmployeeId: actor.id }) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        property: { select: { refNo: true, titleAr: true } },
        buyer: { select: { fullName: true } },
        seller: { select: { fullName: true } },
        obligations: { include: { entries: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      ref: ref('SALE', c.refNo),
      status: c.status,
      propertyRef: ref('DAR', c.property.refNo),
      propertyTitle: c.property.titleAr,
      buyerName: c.buyer.fullName,
      sellerName: c.seller.fullName,
      finalPriceCents: toCents(c.finalPriceCents),
      closingDate: dateOnly(c.closingDate),
      obligations: c.obligations.map((o) => this.obligationDto(o)),
      overrideReason: c.overrideReason,
    }));
  }

  async detail(actor: RequestActor, id: string) {
    const c = await this.prisma.saleClosing.findUnique({
      where: { id },
      include: {
        property: { select: { refNo: true, titleAr: true, assignedEmployeeId: true } },
        buyer: { select: { id: true, fullName: true } },
        seller: { select: { id: true, fullName: true } },
        obligations: { include: { entries: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!c) throw new NotFoundException();
    const party = c.buyerId === actor.id ? 'BUYER' : c.sellerId === actor.id ? 'SELLER' : null;
    authorize(isAdmin(actor) || isAssignedEmployee(actor, c) || !!party);
    const obligations = c.obligations
      .filter((o) => !party || isAdmin(actor) || isAssignedEmployee(actor, c) || o.party === party) // parties see only their own side
      .map((o) => ({
        ...this.obligationDto(o),
        entries: o.entries.map((e) => ({ id: e.id, receiptNo: e.receiptNo, kind: e.kind, amountCents: toCents(e.amountCents), method: e.method, receivedOn: dateOnly(e.receivedOn), reference: e.reference, reason: e.reason, reversesEntryId: e.reversesEntryId })),
      }));
    return {
      id: c.id,
      ref: ref('SALE', c.refNo),
      status: c.status,
      propertyRef: ref('DAR', c.property.refNo),
      propertyTitle: c.property.titleAr,
      buyer: c.buyer,
      seller: c.seller,
      finalPriceCents: toCents(c.finalPriceCents),
      closingDate: dateOnly(c.closingDate),
      sellerBps: c.sellerBps,
      buyerBps: c.buyerBps,
      sellerCommissionCents: party === 'BUYER' ? undefined : toCents(c.sellerCommissionCents),
      buyerCommissionCents: party === 'SELLER' ? undefined : toCents(c.buyerCommissionCents),
      termsVersion: c.termsVersion,
      overrideReason: party ? undefined : c.overrideReason,
      obligations,
    };
  }

  private obligationDto(o: { id: string; party: string; amountDueCents: bigint; waivedAt: Date | null; entries: { kind: string; amountCents: bigint }[] }) {
    const net = o.entries.reduce((s, e) => s + toCents(e.amountCents), 0);
    const ever = o.entries.filter((e) => e.kind === 'PAYMENT').reduce((s, e) => s + toCents(e.amountCents), 0);
    const due = toCents(o.amountDueCents);
    return {
      id: o.id,
      party: o.party as Party,
      amountDueCents: due,
      collectedCents: net,
      remainingCents: o.waivedAt ? 0 : Math.max(0, due - net),
      status: deriveSaleObligationStatus({ amountDueCents: due, netCollectedCents: net, everCollectedCents: ever, waived: !!o.waivedAt }),
    };
  }
}
