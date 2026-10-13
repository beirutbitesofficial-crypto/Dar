import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RentLedgerEntry, RentObligation } from '@prisma/client';
import {
  addDays,
  agreementMachine,
  AgreementStatus,
  canRecordCollection,
  canViewAgreementAsParty,
  canViewAgreementAsStaff,
  computeObligationBalance,
  computeOwnerPayables,
  isAdmin,
  ISODate,
  listingMachine,
  ListingStatus,
  ObligationState,
  planMissingObligations,
  planPaymentAllocation,
  planPayout,
  planRefund,
  planReversal,
  planTermination,
  RentalPricingMode,
  renewalStartDate,
  ScheduleInput,
  snapshotRentalTerms,
  todayInBeirut,
} from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { big, dateOnly, ref, toCents, toDbDate } from '../../common/money';
import { PrismaService, Tx } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

/** Obligations are generated this many days ahead so tenants can be reminded before the due date. */
export const GENERATION_LOOKAHEAD_DAYS = 35;

type ObligationWithEntries = RentObligation & { entries: RentLedgerEntry[] };

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ======================================================================
  // Agreements
  // ======================================================================

  async create(
    actor: RequestActor,
    input: {
      propertyId: string;
      tenantId: string;
      leadId?: string;
      assignedEmployeeId: string;
      startDate: string;
      endDate: string;
      dueDay: number;
      proration: 'NONE' | 'DAILY';
      pricingMode?: RentalPricingMode;
      enteredAmountCents: number;
      feeOverride?: { monthlyFeeCents: number; reason: string };
      depositCents: number;
      renewedFromId?: string;
      notes?: string;
    },
  ) {
    const p = await this.prisma.property.findUnique({ where: { id: input.propertyId } });
    if (!p) throw new NotFoundException();
    authorize(isAdmin(actor) || (p.assignedEmployeeId === actor.id && actor.roles.includes('EMPLOYEE')));
    if (p.listingType !== 'RENT') throw new BadRequestException({ code: 'NOT_A_RENTAL', message: 'Listing is not for rent' });
    if (input.tenantId === p.ownerId) throw new BadRequestException({ code: 'TENANT_IS_LANDLORD', message: 'Tenant and landlord must differ' });
    const emp = await this.prisma.user.findUnique({ where: { id: input.assignedEmployeeId }, select: { roles: true } });
    if (!emp?.roles.includes('EMPLOYEE')) throw new BadRequestException({ code: 'NOT_AN_EMPLOYEE', message: 'Choose an employee' });

    const settings = await this.settings.current();
    // Fee overrides are recorded now but only take effect if an admin activates the agreement.
    const snap = snapshotRentalTerms(settings, input.enteredAmountCents, {
      mode: input.pricingMode ?? p.rentPricingMode ?? settings.rental.mode,
      override: input.feeOverride ? { monthlyFeeCents: input.feeOverride.monthlyFeeCents, reason: input.feeOverride.reason, approvedByAdminId: isAdmin(actor) ? actor.id : 'PENDING_ADMIN_APPROVAL' } : undefined,
    });
    const ag = await this.prisma.rentalAgreement.create({
      data: {
        propertyId: p.id,
        landlordId: p.ownerId,
        tenantId: input.tenantId,
        assignedEmployeeId: input.assignedEmployeeId,
        leadId: input.leadId,
        startDate: toDbDate(input.startDate),
        endDate: toDbDate(input.endDate),
        dueDay: input.dueDay,
        proration: input.proration,
        pricingMode: snap.mode,
        enteredAmountCents: big(snap.enteredAmountCents),
        landlordNetCents: big(snap.landlordNetCents),
        platformFeeCents: big(snap.platformFeeCents),
        tenantTotalCents: big(snap.tenantTotalCents),
        depositCents: big(input.depositCents),
        settingsVersion: snap.settingsVersion,
        termsVersion: snap.termsVersion,
        termsSnapshot: snap as any,
        feeOverrideReason: input.feeOverride?.reason,
        feeOverrideApprovedById: input.feeOverride && isAdmin(actor) ? actor.id : null,
        renewedFromId: input.renewedFromId,
        createdById: actor.id,
        notes: input.notes,
      },
    });
    await this.audit.log({ actorId: actor.id, action: 'rental.agreement_created', entityType: 'RentalAgreement', entityId: ag.id, metadata: { feeOverride: !!input.feeOverride } });
    return this.staffDetail(actor, ag.id);
  }

  /** Disclosure shown to a party before they accept in the app. */
  async acceptanceTerms(actor: RequestActor, id: string) {
    const ag = await this.load(id);
    const party = canViewAgreementAsParty(actor, ag);
    authorize(!!party);
    return {
      party,
      status: ag.status,
      termsVersion: ag.termsVersion,
      pricingMode: ag.pricingMode,
      startDate: dateOnly(ag.startDate),
      endDate: dateOnly(ag.endDate),
      dueDay: ag.dueDay,
      ...(party === 'TENANT'
        ? { tenantMonthlyTotalCents: toCents(ag.tenantTotalCents), includesMonthlyFeeCents: toCents(ag.platformFeeCents), depositCents: toCents(ag.depositCents) }
        : { landlordNetCents: toCents(ag.landlordNetCents), platformFeeCents: toCents(ag.platformFeeCents), feeDeductedFromOwner: ag.pricingMode === 'TOTAL_MINUS_FEE', tenantMonthlyTotalCents: toCents(ag.tenantTotalCents) }),
      accepted: party === 'TENANT' ? !!ag.tenantAcceptedAt : !!ag.landlordAcceptedAt,
    };
  }

  /** A party accepts in the app; the acceptance timestamp and channel are stored on the agreement. */
  async acceptAsParty(actor: RequestActor, id: string, termsVersion: string, disclosedMonthlyCents: number) {
    const ag = await this.load(id);
    const party = canViewAgreementAsParty(actor, ag);
    authorize(!!party);
    if (ag.status !== 'DRAFT') throw new BadRequestException({ code: 'AGREEMENT_NOT_DRAFT', message: 'Already finalized' });
    const expected = party === 'TENANT' ? toCents(ag.tenantTotalCents) : toCents(ag.landlordNetCents);
    if (termsVersion !== ag.termsVersion || disclosedMonthlyCents !== expected) {
      throw new BadRequestException({ code: 'TERMS_CHANGED', message: 'Please review the latest terms' });
    }
    await this.recordAcceptance(actor, id, party!, new Date().toISOString(), 'mobile');
    return this.acceptanceTerms(actor, id);
  }

  async recordAcceptance(actor: RequestActor, id: string, party: 'LANDLORD' | 'TENANT', acceptedAt: string, channel: 'mobile' | 'in_person_recorded_by_staff') {
    const ag = await this.load(id);
    const self = canViewAgreementAsParty(actor, ag) === party && channel === 'mobile';
    authorize(self || isAdmin(actor) || canViewAgreementAsStaff(actor, ag));
    if (ag.status !== 'DRAFT') throw new BadRequestException({ code: 'AGREEMENT_NOT_DRAFT', message: 'Already finalized' });
    await this.prisma.rentalAgreement.update({
      where: { id },
      data: party === 'TENANT' ? { tenantAcceptedAt: new Date(acceptedAt), tenantAcceptanceChannel: channel } : { landlordAcceptedAt: new Date(acceptedAt), landlordAcceptanceChannel: channel },
    });
    await this.audit.log({ actorId: actor.id, action: 'rental.acceptance_recorded', entityType: 'RentalAgreement', entityId: id, metadata: { party, channel } });
    return { ok: true };
  }

  /** Admin activation: requires both acceptances (also enforced by a DB check), approves any fee override. */
  async activate(actor: RequestActor, id: string) {
    authorize(isAdmin(actor));
    const ag = await this.prisma.rentalAgreement.findUniqueOrThrow({ where: { id }, include: { property: true } });
    agreementMachine.assert(ag.status as AgreementStatus, 'ACTIVE', 'ADMIN');
    if (!ag.landlordAcceptedAt || !ag.tenantAcceptedAt) throw new BadRequestException({ code: 'ACCEPTANCE_MISSING', message: 'Both parties must accept first' });
    await this.prisma.serializable(async (tx) => {
      if (ag.feeOverrideReason && !ag.feeOverrideApprovedById) {
        await tx.rentalAgreement.update({ where: { id }, data: { feeOverrideApprovedById: actor.id } });
      }
      await tx.rentalAgreement.update({ where: { id }, data: { status: 'ACTIVE', activeKey: ag.propertyId, activatedAt: new Date(), activatedById: actor.id } });
      if (listingMachine.allowed(ag.property.status as ListingStatus, 'RENTED', 'SYSTEM')) {
        await tx.property.update({ where: { id: ag.propertyId }, data: { status: 'RENTED', featured: false, version: { increment: 1 } } });
      }
      if (ag.leadId) {
        const leads = await tx.lead.findMany({ where: { propertyId: ag.propertyId, openKey: { not: null } } });
        for (const l of leads) {
          const won = l.id === ag.leadId;
          await tx.lead.update({
            where: { id: l.id },
            data: { status: won ? 'WON' : 'LOST', openKey: null, closedAt: new Date(), wonAt: won ? new Date() : null, lostReason: won ? null : 'Property rented', version: { increment: 1 } },
          });
          await tx.leadEvent.create({ data: { leadId: l.id, actorId: actor.id, type: 'STATUS', fromStatus: l.status, toStatus: won ? 'WON' : 'LOST' } });
        }
      }
      await this.audit.log({ actorId: actor.id, action: 'rental.agreement_activated', entityType: 'RentalAgreement', entityId: id }, tx);
    });
    await this.generateFor(id, todayInBeirut(), actor.id);
    for (const userId of [ag.landlordId, ag.tenantId]) {
      await this.notifications.notify({ userId, templateKey: 'rental.activated', vars: { ref: ref('LEASE', ag.refNo) }, data: { agreementId: id }, dedupeKey: `rental.activated:${id}:${userId}` });
    }
    return this.staffDetail(actor, id);
  }

  async cancelDraft(actor: RequestActor, id: string, reason: string) {
    authorize(isAdmin(actor));
    const ag = await this.load(id);
    agreementMachine.assert(ag.status as AgreementStatus, 'CANCELLED', 'ADMIN', { reason });
    await this.prisma.rentalAgreement.update({ where: { id }, data: { status: 'CANCELLED', notes: [ag.notes, `Cancelled: ${reason}`].filter(Boolean).join('\n') } });
    await this.audit.log({ actorId: actor.id, action: 'rental.agreement_cancelled', entityType: 'RentalAgreement', entityId: id, metadata: { reason } });
    return { ok: true };
  }

  /**
   * Amendment: new monthly terms from an effective date, accepted by both
   * parties. Applies only to periods not yet generated, so nothing already
   * billed changes silently.
   */
  async amend(
    actor: RequestActor,
    id: string,
    input: { effectiveFrom: string; landlordNetCents: number; platformFeeCents: number; reason: string; landlordAcceptedAt: string; tenantAcceptedAt: string },
  ) {
    authorize(isAdmin(actor));
    const ag = await this.prisma.rentalAgreement.findUniqueOrThrow({ where: { id }, include: { obligations: { orderBy: { periodIndex: 'desc' }, take: 1 } } });
    if (ag.status !== 'ACTIVE') throw new BadRequestException({ code: 'AGREEMENT_NOT_ACTIVE', message: 'Only active agreements can be amended' });
    const lastGenerated = ag.obligations[0] ? dateOnly(ag.obligations[0].periodStart)! : null;
    if (lastGenerated && input.effectiveFrom <= lastGenerated) {
      throw new BadRequestException({ code: 'AMENDMENT_TOO_EARLY', message: `Effective date must be after ${lastGenerated} (already billed)`, details: { lastGenerated } });
    }
    const am = await this.prisma.agreementAmendment.create({
      data: {
        agreementId: id,
        effectiveFrom: toDbDate(input.effectiveFrom),
        landlordNetCents: big(input.landlordNetCents),
        platformFeeCents: big(input.platformFeeCents),
        tenantTotalCents: big(input.landlordNetCents + input.platformFeeCents),
        reason: input.reason,
        landlordAcceptedAt: new Date(input.landlordAcceptedAt),
        tenantAcceptedAt: new Date(input.tenantAcceptedAt),
        recordedById: actor.id,
      },
    });
    await this.audit.log({ actorId: actor.id, action: 'rental.agreement_amended', entityType: 'RentalAgreement', entityId: id, metadata: { amendmentId: am.id, effectiveFrom: input.effectiveFrom } });
    return this.staffDetail(actor, id);
  }

  /** Early termination: void future periods, adjust the current one if DAILY proration was agreed. */
  async terminate(actor: RequestActor, id: string, terminationDate: string, reason: string) {
    authorize(isAdmin(actor));
    const ag = await this.prisma.rentalAgreement.findUniqueOrThrow({ where: { id }, include: { amendments: true, obligations: { include: { entries: true } } } });
    agreementMachine.assert(ag.status as AgreementStatus, 'TERMINATED', 'ADMIN', { reason });
    const schedule = { ...this.scheduleInput(ag), terminationDate };
    const actions = planTermination(
      schedule,
      ag.obligations
        .filter((o) => !o.voidedAt)
        .map((o) => ({
          id: o.id,
          periodIndex: o.periodIndex,
          landlordShareCents: toCents(o.landlordShareCents),
          feeShareCents: toCents(o.feeShareCents),
          collectedCents: o.entries.reduce((s, e) => s + toCents(e.amountCents), 0),
        })),
    );
    await this.prisma.serializable(async (tx) => {
      for (const a of actions) {
        if (a.kind === 'VOID') {
          await tx.rentObligation.update({ where: { id: a.obligationId }, data: { voidedAt: new Date(), voidReason: `Terminated: ${reason}` } });
          await this.audit.log({ actorId: actor.id, action: 'rental.obligation_voided', entityType: 'RentObligation', entityId: a.obligationId, metadata: { requiresRefundReview: a.requiresRefundReview } }, tx);
        } else {
          const o = ag.obligations.find((x) => x.id === a.obligationId)!;
          await tx.rentObligation.update({
            where: { id: a.obligationId },
            data: {
              originalLandlordShareCents: o.originalLandlordShareCents ?? o.landlordShareCents,
              originalFeeShareCents: o.originalFeeShareCents ?? o.feeShareCents,
              landlordShareCents: big(a.landlordShareCents),
              feeShareCents: big(a.feeShareCents),
              totalCents: big(a.landlordShareCents + a.feeShareCents),
              prorated: true,
              adjustedReason: `Early termination on ${terminationDate} (daily proration as agreed)`,
            },
          });
          await this.audit.log({ actorId: actor.id, action: 'rental.obligation_adjusted', entityType: 'RentObligation', entityId: a.obligationId, metadata: { requiresRefundReview: a.requiresRefundReview } }, tx);
        }
      }
      await tx.rentalAgreement.update({ where: { id }, data: { status: 'TERMINATED', activeKey: null, terminationDate: toDbDate(terminationDate), terminationReason: reason } });
      await this.audit.log({ actorId: actor.id, action: 'rental.agreement_terminated', entityType: 'RentalAgreement', entityId: id, metadata: { terminationDate, reason } }, tx);
    });
    return { ...(await this.staffDetail(actor, id)), refundReviewNeeded: actions.filter((a) => a.requiresRefundReview).map((a) => a.obligationId) };
  }

  /** Renewal creates a new DRAFT agreement; both parties accept its terms again. */
  async renew(actor: RequestActor, id: string, input: { endDate: string; enteredAmountCents?: number; keepCurrentFee: boolean }) {
    authorize(isAdmin(actor));
    const ag = await this.prisma.rentalAgreement.findUniqueOrThrow({ where: { id } });
    if (!['ACTIVE', 'ENDED'].includes(ag.status)) throw new BadRequestException({ code: 'AGREEMENT_NOT_RENEWABLE', message: 'Cannot renew' });
    const startDate = renewalStartDate(dateOnly(ag.endDate)!);
    return this.create(actor, {
      propertyId: ag.propertyId,
      tenantId: ag.tenantId,
      assignedEmployeeId: ag.assignedEmployeeId,
      startDate,
      endDate: input.endDate,
      dueDay: ag.dueDay,
      proration: ag.proration,
      pricingMode: ag.pricingMode,
      enteredAmountCents: input.enteredAmountCents ?? toCents(ag.enteredAmountCents),
      feeOverride: input.keepCurrentFee ? { monthlyFeeCents: toCents(ag.platformFeeCents), reason: `Renewal of LEASE-${1000 + ag.refNo} at the previously agreed fee` } : undefined,
      depositCents: toCents(ag.depositCents),
      renewedFromId: ag.id,
    });
  }

  // ======================================================================
  // Monthly obligations (idempotent)
  // ======================================================================

  scheduleInput(ag: {
    startDate: Date;
    endDate: Date;
    dueDay: number;
    proration: string;
    landlordNetCents: bigint;
    platformFeeCents: bigint;
    terminationDate: Date | null;
    amendments?: { id: string; effectiveFrom: Date; landlordNetCents: bigint; platformFeeCents: bigint }[];
  }): ScheduleInput {
    return {
      startDate: dateOnly(ag.startDate)!,
      endDate: dateOnly(ag.endDate)!,
      dueDay: ag.dueDay,
      proration: ag.proration as 'NONE' | 'DAILY',
      baseTerms: { landlordNetCents: toCents(ag.landlordNetCents), platformFeeCents: toCents(ag.platformFeeCents) },
      amendments: (ag.amendments ?? []).map((a) => ({
        id: a.id,
        effectiveFrom: dateOnly(a.effectiveFrom)!,
        landlordNetCents: toCents(a.landlordNetCents),
        platformFeeCents: toCents(a.platformFeeCents),
      })),
      terminationDate: dateOnly(ag.terminationDate),
    };
  }

  /**
   * Creates any missing obligations up to today + look-ahead. Safe to run any
   * number of times: the planner skips existing period indexes and the
   * database's UNIQUE(agreementId, periodIndex) makes duplicates impossible.
   */
  async generateFor(agreementId: string, today: ISODate, actorId: string | null = null): Promise<number> {
    const ag = await this.prisma.rentalAgreement.findUniqueOrThrow({
      where: { id: agreementId },
      include: { amendments: true, obligations: { select: { periodIndex: true } } },
    });
    if (ag.status !== 'ACTIVE') return 0;
    const missing = planMissingObligations(this.scheduleInput(ag), addDays(today, GENERATION_LOOKAHEAD_DAYS), ag.obligations.map((o) => o.periodIndex));
    if (missing.length === 0) return 0;
    const res = await this.prisma.rentObligation.createMany({
      data: missing.map((m) => ({
        agreementId,
        periodIndex: m.periodIndex,
        periodStart: toDbDate(m.periodStart),
        periodEnd: toDbDate(m.periodEnd),
        dueDate: toDbDate(m.dueDate),
        landlordShareCents: big(m.landlordShareCents),
        feeShareCents: big(m.feeShareCents),
        totalCents: big(m.totalCents),
        prorated: m.prorated,
        amendmentId: m.amendmentId,
      })),
      skipDuplicates: true,
    });
    if (res.count > 0) {
      await this.audit.log({ actorId, action: 'rental.obligations_generated', entityType: 'RentalAgreement', entityId: agreementId, metadata: { count: res.count, through: addDays(today, GENERATION_LOOKAHEAD_DAYS) } });
    }
    return res.count;
  }

  async generateAll(today: ISODate) {
    const active = await this.prisma.rentalAgreement.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    let created = 0;
    for (const a of active) created += await this.generateFor(a.id, today);
    return { agreements: active.length, created };
  }

  /** Agreements past their end date become ENDED (their obligations remain collectible). */
  async endExpired(today: ISODate) {
    const expired = await this.prisma.rentalAgreement.findMany({ where: { status: 'ACTIVE', endDate: { lt: toDbDate(today) } }, select: { id: true } });
    for (const e of expired) {
      await this.prisma.rentalAgreement.update({ where: { id: e.id }, data: { status: 'ENDED', activeKey: null } });
      await this.audit.log({ actorId: null, action: 'rental.agreement_ended', entityType: 'RentalAgreement', entityId: e.id });
    }
    return expired.length;
  }

  // ======================================================================
  // Collections
  // ======================================================================

  toState(o: ObligationWithEntries): ObligationState {
    return {
      landlordDueCents: toCents(o.landlordShareCents),
      feeDueCents: toCents(o.feeShareCents),
      dueDate: dateOnly(o.dueDate)!,
      voided: !!o.voidedAt,
      waived: !!o.waivedAt,
      entries: o.entries.map((e) => ({ id: e.id, kind: e.kind, landlordCents: toCents(e.landlordCents), feeCents: toCents(e.feeCents), reversesEntryId: e.reversesEntryId })),
    };
  }

  private async loadObligation(tx: Tx, id: string) {
    const o = await tx.rentObligation.findUnique({ where: { id }, include: { entries: true, agreement: true } });
    if (!o) throw new NotFoundException();
    return o;
  }

  async recordPayment(
    actor: RequestActor,
    obligationId: string,
    input: { amountCents: number; method: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; receivedOn: string; reference?: string; notes?: string; idempotencyKey: string },
  ) {
    const prior = await this.prisma.rentLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) {
      if (prior.obligationId !== obligationId) throw new BadRequestException({ code: 'DUPLICATE_REQUEST', message: 'Key reused' });
      return { entryId: prior.id, receiptNo: prior.receiptNo, duplicate: true };
    }
    const { entry, agreement } = await this.prisma.serializable(async (tx) => {
      const o = await this.loadObligation(tx, obligationId);
      authorize(canRecordCollection(actor, o.agreement));
      if (input.receivedOn > todayInBeirut()) throw new BadRequestException({ code: 'DATE_IN_FUTURE', message: 'Payment date cannot be in the future' });
      const alloc = planPaymentAllocation(this.toState(o), input.amountCents, todayInBeirut());
      const e = await tx.rentLedgerEntry.create({
        data: {
          obligationId,
          kind: 'PAYMENT',
          landlordCents: big(alloc.landlordCents),
          feeCents: big(alloc.feeCents),
          amountCents: big(input.amountCents),
          method: input.method,
          receivedOn: toDbDate(input.receivedOn),
          reference: input.reference,
          reason: input.notes,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'rental.payment_recorded', entityType: 'RentObligation', entityId: obligationId, metadata: { entryId: e.id, ...alloc } }, tx);
      return { entry: e, agreement: o.agreement };
    });
    await this.notifications.notify({
      userId: agreement.tenantId,
      templateKey: 'rent.payment_received',
      vars: { receipt: `R-${entry.receiptNo}` },
      data: { agreementId: agreement.id },
      dedupeKey: `rent.payment_received:${entry.id}`,
    });
    return { entryId: entry.id, receiptNo: entry.receiptNo, duplicate: false };
  }

  async reverse(actor: RequestActor, entryId: string, reason: string, idempotencyKey: string) {
    authorize(isAdmin(actor));
    const prior = await this.prisma.rentLedgerEntry.findUnique({ where: { idempotencyKey } });
    if (prior) return { entryId: prior.id, duplicate: true };
    const target = await this.prisma.rentLedgerEntry.findUniqueOrThrow({ where: { id: entryId } });
    const e = await this.prisma.serializable(async (tx) => {
      const o = await this.loadObligation(tx, target.obligationId);
      const plan = planReversal(this.toState(o), entryId);
      const rev = await tx.rentLedgerEntry.create({
        data: {
          obligationId: o.id,
          kind: 'REVERSAL',
          landlordCents: big(plan.landlordCents),
          feeCents: big(plan.feeCents),
          amountCents: big(plan.landlordCents + plan.feeCents),
          method: target.method,
          receivedOn: toDbDate(todayInBeirut()),
          reason,
          reversesEntryId: entryId,
          recordedById: actor.id,
          idempotencyKey,
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'rental.reversal_recorded', entityType: 'RentLedgerEntry', entityId: entryId, metadata: { reason, reversalId: rev.id } }, tx);
      return rev;
    });
    return { entryId: e.id, duplicate: false };
  }

  async refund(
    actor: RequestActor,
    obligationId: string,
    input: { amountCents: number; method: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; paidOn: string; reference?: string; reason: string; idempotencyKey: string },
  ) {
    authorize(isAdmin(actor));
    const prior = await this.prisma.rentLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) return { entryId: prior.id, duplicate: true };
    const e = await this.prisma.serializable(async (tx) => {
      const o = await this.loadObligation(tx, obligationId);
      const plan = planRefund(this.toState(o), input.amountCents, todayInBeirut());
      const r = await tx.rentLedgerEntry.create({
        data: {
          obligationId,
          kind: 'REFUND',
          landlordCents: big(plan.landlordCents),
          feeCents: big(plan.feeCents),
          amountCents: big(plan.landlordCents + plan.feeCents),
          method: input.method,
          receivedOn: toDbDate(input.paidOn),
          reference: input.reference,
          reason: input.reason,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'rental.refund_recorded', entityType: 'RentObligation', entityId: obligationId, metadata: { entryId: r.id, ...plan } }, tx);
      return r;
    });
    return { entryId: e.id, duplicate: false };
  }

  async waive(actor: RequestActor, obligationId: string, reason: string) {
    authorize(isAdmin(actor));
    await this.prisma.rentObligation.update({ where: { id: obligationId }, data: { waivedAt: new Date(), waivedById: actor.id, waiveReason: reason } });
    await this.audit.log({ actorId: actor.id, action: 'rental.obligation_waived', entityType: 'RentObligation', entityId: obligationId, metadata: { reason } });
    return { ok: true };
  }

  async recordDeposit(
    actor: RequestActor,
    agreementId: string,
    input: { kind: 'RECEIVED' | 'RETURNED' | 'APPLIED_TO_DAMAGES'; amountCents: number; method: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; occurredOn: string; reference?: string; notes?: string; idempotencyKey: string },
  ) {
    const ag = await this.load(agreementId);
    authorize(input.kind === 'RECEIVED' ? canRecordCollection(actor, ag) : isAdmin(actor));
    const entries = await this.prisma.depositEntry.findMany({ where: { agreementId } });
    const held = entries.reduce((s, e) => s + (e.kind === 'RECEIVED' ? 1 : -1) * toCents(e.amountCents), 0);
    if (input.kind !== 'RECEIVED' && input.amountCents > held) throw new BadRequestException({ code: 'DEPOSIT_EXCEEDS_HELD', message: 'More than the deposit held' });
    const prior = await this.prisma.depositEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) return prior;
    const e = await this.prisma.depositEntry.create({ data: { agreementId, ...input, amountCents: big(input.amountCents), occurredOn: toDbDate(input.occurredOn), recordedById: actor.id } });
    await this.audit.log({ actorId: actor.id, action: 'rental.deposit_recorded', entityType: 'RentalAgreement', entityId: agreementId, metadata: { kind: input.kind, amountCents: input.amountCents } });
    return { ...e, amountCents: input.amountCents };
  }

  // ======================================================================
  // Owner payouts
  // ======================================================================

  async ownerPayables(ownerId: string, client: Tx = this.prisma) {
    const obligations = await client.rentObligation.findMany({
      where: { agreement: { landlordId: ownerId } },
      include: { entries: true, payoutLines: true, agreement: { select: { refNo: true, property: { select: { refNo: true, titleAr: true } } } } },
      orderBy: [{ agreementId: 'asc' }, { periodIndex: 'asc' }],
    });
    const positions = obligations.map((o) => ({ obligationId: o.id, landlordCollectedCents: o.entries.reduce((s, e) => s + toCents(e.landlordCents), 0) }));
    const lines = obligations.flatMap((o) => o.payoutLines.map((l) => ({ obligationId: o.id, amountCents: toCents(l.amountCents) })));
    const summary = computeOwnerPayables(positions, lines);
    return { obligations, ...summary };
  }

  /** All owners with money collected for them and not yet transferred. */
  async payoutQueue() {
    const rows = await this.prisma.$queryRaw<{ ownerId: string; fullName: string; collected: bigint; paid: bigint }[]>`
      SELECT a."landlordId" AS "ownerId", u."fullName",
             coalesce(sum(le.collected), 0)::bigint AS collected,
             coalesce(sum(pl.paid), 0)::bigint AS paid
      FROM "RentObligation" o
      JOIN "RentalAgreement" a ON a.id = o."agreementId"
      JOIN "User" u ON u.id = a."landlordId"
      LEFT JOIN (SELECT "obligationId", sum("landlordCents") AS collected FROM "RentLedgerEntry" GROUP BY 1) le ON le."obligationId" = o.id
      LEFT JOIN (SELECT "obligationId", sum("amountCents") AS paid FROM "OwnerPayoutLine" GROUP BY 1) pl ON pl."obligationId" = o.id
      GROUP BY a."landlordId", u."fullName"
      HAVING coalesce(sum(le.collected), 0) <> coalesce(sum(pl.paid), 0)
      ORDER BY u."fullName"`;
    return rows.map((r) => ({ ownerId: r.ownerId, ownerName: r.fullName, collectedForOwnerCents: toCents(r.collected), paidOutCents: toCents(r.paid), balanceCents: toCents(r.collected) - toCents(r.paid) }));
  }

  async recordPayout(
    actor: RequestActor,
    input: { ownerId: string; obligationIds: string[]; method: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; paidOn: string; reference: string; notes?: string; idempotencyKey: string },
  ) {
    authorize(isAdmin(actor));
    const prior = await this.prisma.ownerPayout.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) return { payoutId: prior.id, duplicate: true };
    const payout = await this.prisma.serializable(async (tx) => {
      const { lines: payables } = await this.ownerPayables(input.ownerId, tx);
      const known = new Set(payables.map((l) => l.obligationId));
      if (input.obligationIds.some((id) => !known.has(id))) {
        throw new BadRequestException({ code: 'PAYOUT_OBLIGATION_UNKNOWN', message: 'Obligation does not belong to this owner' });
      }
      const lines = planPayout(payables, input.obligationIds);
      const total = lines.reduce((s, l) => s + l.amountCents, 0);
      const p = await tx.ownerPayout.create({
        data: {
          ownerId: input.ownerId,
          kind: 'PAYOUT',
          totalCents: big(total),
          method: input.method,
          paidOn: toDbDate(input.paidOn),
          reference: input.reference,
          notes: input.notes,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
          lines: { create: lines.map((l) => ({ obligationId: l.obligationId, amountCents: big(l.amountCents) })) },
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'payout.recorded', entityType: 'OwnerPayout', entityId: p.id, metadata: { ownerId: input.ownerId, totalCents: total, lines: lines.length } }, tx);
      return { ...p, total };
    });
    await this.notifications.notify({
      userId: input.ownerId,
      templateKey: 'payout.recorded',
      vars: { ref: ref('PAY', payout.refNo) },
      data: { payoutId: payout.id },
      dedupeKey: `payout.recorded:${payout.id}`,
    });
    return { payoutId: payout.id, totalCents: payout.total, duplicate: false };
  }

  async reversePayout(actor: RequestActor, payoutId: string, reason: string, idempotencyKey: string) {
    authorize(isAdmin(actor));
    const prior = await this.prisma.ownerPayout.findUnique({ where: { idempotencyKey } });
    if (prior) return { payoutId: prior.id, duplicate: true };
    const p = await this.prisma.ownerPayout.findUniqueOrThrow({ where: { id: payoutId }, include: { lines: true } });
    if (p.kind !== 'PAYOUT') throw new BadRequestException({ code: 'NOT_A_PAYOUT', message: 'Only payouts can be reversed' });
    const rev = await this.prisma.serializable(async (tx) => {
      const r = await tx.ownerPayout.create({
        data: {
          ownerId: p.ownerId,
          kind: 'REVERSAL',
          totalCents: -p.totalCents,
          method: p.method,
          paidOn: toDbDate(todayInBeirut()),
          reference: `REVERSAL OF PAY-${1000 + p.refNo}`,
          notes: reason,
          reversesPayoutId: p.id,
          recordedById: actor.id,
          idempotencyKey,
          lines: { create: p.lines.map((l) => ({ obligationId: l.obligationId, amountCents: -l.amountCents })) },
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'payout.reversed', entityType: 'OwnerPayout', entityId: p.id, metadata: { reason, reversalId: r.id } }, tx);
      return r;
    });
    return { payoutId: rev.id, duplicate: false };
  }

  // ======================================================================
  // Views
  // ======================================================================

  obligationDto(o: ObligationWithEntries, today = todayInBeirut()) {
    const b = computeObligationBalance(this.toState(o), today);
    return {
      id: o.id,
      agreementId: o.agreementId,
      periodIndex: o.periodIndex,
      periodStart: dateOnly(o.periodStart)!,
      periodEnd: dateOnly(o.periodEnd)!,
      dueDate: dateOnly(o.dueDate)!,
      landlordShareCents: toCents(o.landlordShareCents),
      feeShareCents: toCents(o.feeShareCents),
      totalCents: toCents(o.totalCents),
      collectedCents: b.totalCollectedCents,
      landlordCollectedCents: b.landlordCollectedCents,
      feeCollectedCents: b.feeCollectedCents,
      remainingCents: o.voidedAt || o.waivedAt ? 0 : b.remainingCents,
      status: b.status,
      prorated: o.prorated,
      adjustedReason: o.adjustedReason,
      voidReason: o.voidReason,
      waiveReason: o.waiveReason,
    };
  }

  async staffDetail(actor: RequestActor, id: string) {
    const ag = await this.prisma.rentalAgreement.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, refNo: true, titleAr: true } },
        landlord: { select: { id: true, fullName: true, phone: true } },
        tenant: { select: { id: true, fullName: true, phone: true } },
        assignedEmployee: { select: { id: true, fullName: true } },
        amendments: { orderBy: { effectiveFrom: 'asc' } },
        deposits: { orderBy: { createdAt: 'asc' } },
        obligations: { orderBy: { periodIndex: 'asc' }, include: { entries: { orderBy: { createdAt: 'asc' } }, payoutLines: true } },
      },
    });
    if (!ag) throw new NotFoundException();
    authorize(canViewAgreementAsStaff(actor, ag));
    return {
      id: ag.id,
      ref: ref('LEASE', ag.refNo),
      status: ag.status,
      property: { ...ag.property, ref: ref('DAR', ag.property.refNo) },
      landlord: ag.landlord,
      tenant: ag.tenant,
      assignedEmployee: ag.assignedEmployee,
      startDate: dateOnly(ag.startDate),
      endDate: dateOnly(ag.endDate),
      terminationDate: dateOnly(ag.terminationDate),
      dueDay: ag.dueDay,
      proration: ag.proration,
      pricingMode: ag.pricingMode,
      enteredAmountCents: toCents(ag.enteredAmountCents),
      landlordNetCents: toCents(ag.landlordNetCents),
      platformFeeCents: toCents(ag.platformFeeCents),
      tenantTotalCents: toCents(ag.tenantTotalCents),
      depositCents: toCents(ag.depositCents),
      depositHeldCents: ag.deposits.reduce((s, d) => s + (d.kind === 'RECEIVED' ? 1 : -1) * toCents(d.amountCents), 0),
      deposits: ag.deposits.map((d) => ({ ...d, amountCents: toCents(d.amountCents), occurredOn: dateOnly(d.occurredOn) })),
      termsVersion: ag.termsVersion,
      settingsVersion: ag.settingsVersion,
      feeOverride: ag.feeOverrideReason ? { reason: ag.feeOverrideReason, approvedById: ag.feeOverrideApprovedById } : null,
      landlordAcceptedAt: ag.landlordAcceptedAt,
      landlordAcceptanceChannel: ag.landlordAcceptanceChannel,
      tenantAcceptedAt: ag.tenantAcceptedAt,
      tenantAcceptanceChannel: ag.tenantAcceptanceChannel,
      amendments: ag.amendments.map((a) => ({ id: a.id, effectiveFrom: dateOnly(a.effectiveFrom), landlordNetCents: toCents(a.landlordNetCents), platformFeeCents: toCents(a.platformFeeCents), tenantTotalCents: toCents(a.tenantTotalCents), reason: a.reason })),
      obligations: ag.obligations.map((o) => ({
        ...this.obligationDto(o),
        paidOutCents: o.payoutLines.reduce((s, l) => s + toCents(l.amountCents), 0),
        entries: o.entries.map((e) => ({ id: e.id, receiptNo: e.receiptNo, kind: e.kind, amountCents: toCents(e.amountCents), landlordCents: toCents(e.landlordCents), feeCents: toCents(e.feeCents), method: e.method, receivedOn: dateOnly(e.receivedOn), reference: e.reference, reason: e.reason, reversesEntryId: e.reversesEntryId })),
      })),
      allowedTransitions: agreementMachine.next(ag.status as AgreementStatus, 'ADMIN'),
    };
  }

  async list(actor: RequestActor, status?: AgreementStatus) {
    const where: Prisma.RentalAgreementWhereInput = { ...(status ? { status } : {}), ...(isAdmin(actor) ? {} : { assignedEmployeeId: actor.id }) };
    const rows = await this.prisma.rentalAgreement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { property: { select: { refNo: true, titleAr: true } }, landlord: { select: { fullName: true } }, tenant: { select: { fullName: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      ref: ref('LEASE', a.refNo),
      status: a.status,
      propertyRef: ref('DAR', a.property.refNo),
      propertyTitle: a.property.titleAr,
      landlordName: a.landlord.fullName,
      tenantName: a.tenant.fullName,
      startDate: dateOnly(a.startDate),
      endDate: dateOnly(a.endDate),
      tenantTotalCents: toCents(a.tenantTotalCents),
      landlordNetCents: toCents(a.landlordNetCents),
      platformFeeCents: toCents(a.platformFeeCents),
    }));
  }

  /** Collections board: obligations due up to a date with balances (staff scoped). */
  async collections(actor: RequestActor, filter: 'OVERDUE' | 'DUE_SOON' | 'ALL_OPEN') {
    const today = todayInBeirut();
    const rows = await this.prisma.rentObligation.findMany({
      where: {
        voidedAt: null,
        waivedAt: null,
        dueDate: { lte: toDbDate(filter === 'OVERDUE' ? addDays(today, -1) : addDays(today, filter === 'DUE_SOON' ? 7 : 3650)) },
        agreement: isAdmin(actor) ? {} : { assignedEmployeeId: actor.id },
      },
      include: { entries: true, agreement: { select: { refNo: true, tenant: { select: { fullName: true } }, property: { select: { refNo: true, titleAr: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 500,
    });
    return rows
      .map((o) => ({ ...this.obligationDto(o, today), agreementRef: ref('LEASE', o.agreement.refNo), tenantName: o.agreement.tenant.fullName, propertyRef: ref('DAR', o.agreement.property.refNo), propertyTitle: o.agreement.property.titleAr }))
      .filter((o) => o.remainingCents > 0);
  }

  /** What the landlord sees: agreed net rent vs. what was actually collected and paid to them. */
  async ownerStatement(actor: RequestActor, ownerId: string) {
    authorize(actor.id === ownerId || isAdmin(actor));
    const { obligations, lines, totalPayableCents, totalPaidOutCents, ownerDebtCents } = await this.ownerPayables(ownerId);
    const payouts = await this.prisma.ownerPayout.findMany({ where: { ownerId }, orderBy: { paidOn: 'desc' }, include: { lines: true } });
    const byObligation = new Map(lines.map((l) => [l.obligationId, l]));
    return {
      totals: { payableCents: totalPayableCents, paidOutCents: totalPaidOutCents, ownerDebtCents },
      lines: obligations.map((o) => {
        const l = byObligation.get(o.id)!;
        return {
          obligationId: o.id,
          agreementRef: ref('LEASE', o.agreement.refNo),
          propertyRef: ref('DAR', o.agreement.property.refNo),
          propertyTitle: o.agreement.property.titleAr,
          period: `${dateOnly(o.periodStart)} → ${dateOnly(o.periodEnd)}`,
          dueDate: dateOnly(o.dueDate),
          agreedNetRentCents: toCents(o.landlordShareCents),
          collectedForOwnerCents: l.landlordCollectedCents,
          paidOutCents: l.paidOutCents,
          payableCents: l.payableCents,
          status: o.voidedAt ? 'VOID' : o.waivedAt ? 'WAIVED' : computeObligationBalance(this.toState(o), todayInBeirut()).status,
        };
      }),
      payouts: payouts.map((p) => ({ id: p.id, ref: ref('PAY', p.refNo), kind: p.kind, totalCents: toCents(p.totalCents), paidOn: dateOnly(p.paidOn), reference: p.reference, method: p.method })),
    };
  }

  /** Agreements the signed-in user is a party to, with only their side's figures. */
  async myAgreements(actor: RequestActor) {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: { OR: [{ tenantId: actor.id }, { landlordId: actor.id }], status: { in: ['DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED'] } },
      orderBy: { startDate: 'desc' },
      include: { property: { select: { refNo: true, titleAr: true, titleEn: true } }, obligations: { orderBy: { periodIndex: 'asc' }, include: { entries: true } } },
    });
    const today = todayInBeirut();
    return rows.map((a) => {
      const party = a.tenantId === actor.id ? 'TENANT' : 'LANDLORD';
      return {
        id: a.id,
        ref: ref('LEASE', a.refNo),
        party,
        status: a.status,
        property: { ref: ref('DAR', a.property.refNo), titleAr: a.property.titleAr, titleEn: a.property.titleEn },
        startDate: dateOnly(a.startDate),
        endDate: dateOnly(a.endDate),
        termsVersion: a.termsVersion,
        needsMyAcceptance: a.status === 'DRAFT' && (party === 'TENANT' ? !a.tenantAcceptedAt : !a.landlordAcceptedAt),
        ...(party === 'TENANT'
          ? { tenantMonthlyTotalCents: toCents(a.tenantTotalCents), includesMonthlyFeeCents: toCents(a.platformFeeCents) }
          : { agreedNetRentCents: toCents(a.landlordNetCents) }),
        periods: a.obligations.map((o) => {
          const d = this.obligationDto(o, today);
          return party === 'TENANT'
            ? { id: d.id, periodStart: d.periodStart, periodEnd: d.periodEnd, dueDate: d.dueDate, amountCents: d.totalCents, paidCents: d.collectedCents, remainingCents: d.remainingCents, status: d.status }
            : { id: d.id, periodStart: d.periodStart, periodEnd: d.periodEnd, dueDate: d.dueDate, agreedNetRentCents: d.landlordShareCents, collectedForYouCents: d.landlordCollectedCents, status: d.status };
        }),
      };
    });
  }

  private async load(id: string) {
    const a = await this.prisma.rentalAgreement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    return a;
  }
}
