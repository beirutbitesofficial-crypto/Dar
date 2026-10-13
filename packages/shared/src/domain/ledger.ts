import { compareDates, ISODate } from './dates';
import { DomainError } from './errors';
import { assertCents, Cents } from './money';

/**
 * Append-only financial ledger for rent obligations.
 *
 * Every tenant payment is split into a landlord portion and a platform-fee
 * portion at the moment it is recorded. Allocation rule (documented and
 * deliberate): the landlord's share is filled FIRST, then the platform fee —
 * so the platform never earns its fee on a month where the landlord is short.
 *
 * Corrections never edit or delete entries:
 *  - REVERSAL negates one specific payment entirely (e.g. recorded in error).
 *  - REFUND returns money to the tenant; it reduces the fee portion first,
 *    then the landlord portion.
 * Owner payouts are tracked separately: a tenant payment never marks the owner
 * as paid. Only a recorded payout (with date and reference) does.
 */
export const LedgerEntryKind = { PAYMENT: 'PAYMENT', REVERSAL: 'REVERSAL', REFUND: 'REFUND' } as const;
export type LedgerEntryKind = (typeof LedgerEntryKind)[keyof typeof LedgerEntryKind];

export interface LedgerEntry {
  id: string;
  kind: LedgerEntryKind;
  /** Signed: positive for PAYMENT, negative for REVERSAL/REFUND. */
  landlordCents: Cents;
  feeCents: Cents;
  reversesEntryId?: string | null;
}

export interface ObligationState {
  landlordDueCents: Cents;
  feeDueCents: Cents;
  dueDate: ISODate;
  voided?: boolean;
  waived?: boolean;
  entries: readonly LedgerEntry[];
}

export const RentObligationStatus = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  WAIVED: 'WAIVED',
  VOID: 'VOID',
} as const;
export type RentObligationStatus = (typeof RentObligationStatus)[keyof typeof RentObligationStatus];

export interface ObligationBalance {
  totalDueCents: Cents;
  landlordCollectedCents: Cents;
  feeCollectedCents: Cents;
  totalCollectedCents: Cents;
  landlordRemainingCents: Cents;
  feeRemainingCents: Cents;
  remainingCents: Cents;
  status: RentObligationStatus;
}

export function computeObligationBalance(state: ObligationState, today: ISODate): ObligationBalance {
  let landlord = 0;
  let fee = 0;
  for (const e of state.entries) {
    landlord += e.landlordCents;
    fee += e.feeCents;
  }
  const totalDue = state.landlordDueCents + state.feeDueCents;
  const collected = landlord + fee;
  const landlordRemaining = Math.max(0, state.landlordDueCents - landlord);
  const feeRemaining = Math.max(0, state.feeDueCents - fee);
  let status: RentObligationStatus;
  if (state.voided) status = RentObligationStatus.VOID;
  else if (state.waived) status = RentObligationStatus.WAIVED;
  else if (collected >= totalDue) status = RentObligationStatus.PAID;
  else if (collected > 0) status = RentObligationStatus.PARTIALLY_PAID;
  else {
    const cmp = compareDates(today, state.dueDate);
    status = cmp > 0 ? RentObligationStatus.OVERDUE : cmp === 0 ? RentObligationStatus.DUE : RentObligationStatus.UPCOMING;
  }
  return {
    totalDueCents: totalDue,
    landlordCollectedCents: landlord,
    feeCollectedCents: fee,
    totalCollectedCents: collected,
    landlordRemainingCents: landlordRemaining,
    feeRemainingCents: feeRemaining,
    remainingCents: landlordRemaining + feeRemaining,
    status,
  };
}

export function isOverdue(state: ObligationState, today: ISODate): boolean {
  const b = computeObligationBalance(state, today);
  return b.remainingCents > 0 && !state.voided && !state.waived && compareDates(today, state.dueDate) > 0;
}

/** Splits a tenant payment: landlord share first, then platform fee. */
export function planPaymentAllocation(state: ObligationState, amountCents: Cents, today: ISODate) {
  assertCents(amountCents, 'payment');
  if (amountCents === 0) throw new DomainError('PAYMENT_ZERO');
  if (state.voided) throw new DomainError('OBLIGATION_VOID');
  if (state.waived) throw new DomainError('OBLIGATION_WAIVED');
  const b = computeObligationBalance(state, today);
  if (amountCents > b.remainingCents) {
    throw new DomainError('PAYMENT_EXCEEDS_BALANCE', 'Payment is larger than the remaining balance', {
      remainingCents: b.remainingCents,
    });
  }
  const landlord = Math.min(amountCents, b.landlordRemainingCents);
  const fee = amountCents - landlord;
  return { kind: LedgerEntryKind.PAYMENT, landlordCents: landlord, feeCents: fee };
}

/** Full reversal of one payment entry. */
export function planReversal(state: ObligationState, paymentEntryId: string) {
  const entry = state.entries.find((e) => e.id === paymentEntryId);
  if (!entry) throw new DomainError('LEDGER_ENTRY_NOT_FOUND');
  if (entry.kind !== LedgerEntryKind.PAYMENT) throw new DomainError('ONLY_PAYMENTS_CAN_BE_REVERSED');
  if (state.entries.some((e) => e.kind === LedgerEntryKind.REVERSAL && e.reversesEntryId === paymentEntryId)) {
    throw new DomainError('ALREADY_REVERSED');
  }
  return {
    kind: LedgerEntryKind.REVERSAL,
    landlordCents: -entry.landlordCents,
    feeCents: -entry.feeCents,
    reversesEntryId: entry.id,
  };
}

/** Refund to tenant: reduces the fee portion first, then the landlord portion. */
export function planRefund(state: ObligationState, amountCents: Cents, today: ISODate) {
  assertCents(amountCents, 'refund');
  if (amountCents === 0) throw new DomainError('REFUND_ZERO');
  const b = computeObligationBalance(state, today);
  if (amountCents > b.totalCollectedCents) throw new DomainError('REFUND_EXCEEDS_COLLECTED');
  const fee = Math.min(amountCents, Math.max(0, b.feeCollectedCents));
  const landlord = amountCents - fee;
  return { kind: LedgerEntryKind.REFUND, landlordCents: -landlord, feeCents: -fee };
}

// ---------------------------------------------------------------------------
// Owner payouts
// ---------------------------------------------------------------------------

export interface PayoutLine {
  obligationId: string;
  /** Positive for a payout, negative for a payout reversal. */
  amountCents: Cents;
}

export interface ObligationLandlordPosition {
  obligationId: string;
  landlordCollectedCents: Cents;
}

export interface PayablePosition {
  obligationId: string;
  landlordCollectedCents: Cents;
  paidOutCents: Cents;
  /** Can be negative when a tenant payment was reversed after the owner was paid. */
  payableCents: Cents;
}

export function computeOwnerPayables(
  positions: readonly ObligationLandlordPosition[],
  payoutLines: readonly PayoutLine[],
): { lines: PayablePosition[]; totalPayableCents: Cents; totalPaidOutCents: Cents; ownerDebtCents: Cents } {
  const paid = new Map<string, number>();
  for (const l of payoutLines) paid.set(l.obligationId, (paid.get(l.obligationId) ?? 0) + l.amountCents);
  const lines = positions.map((p) => {
    const paidOut = paid.get(p.obligationId) ?? 0;
    return {
      obligationId: p.obligationId,
      landlordCollectedCents: p.landlordCollectedCents,
      paidOutCents: paidOut,
      payableCents: p.landlordCollectedCents - paidOut,
    };
  });
  return {
    lines,
    totalPayableCents: lines.reduce((s, l) => s + Math.max(0, l.payableCents), 0),
    totalPaidOutCents: lines.reduce((s, l) => s + l.paidOutCents, 0),
    ownerDebtCents: lines.reduce((s, l) => s + Math.max(0, -l.payableCents), 0),
  };
}

/**
 * Plans a payout of everything currently payable on the selected obligations.
 * A payout is only "paid" once staff record it with a date and reference.
 */
export function planPayout(
  payables: readonly PayablePosition[],
  obligationIds?: readonly string[],
): PayoutLine[] {
  const selected = obligationIds ? new Set(obligationIds) : null;
  const lines = payables
    .filter((p) => (!selected || selected.has(p.obligationId)) && p.payableCents > 0)
    .map((p) => ({ obligationId: p.obligationId, amountCents: p.payableCents }));
  if (lines.length === 0) throw new DomainError('NOTHING_PAYABLE');
  return lines;
}

export function validatePayoutLines(payables: readonly PayablePosition[], lines: readonly PayoutLine[]) {
  const byId = new Map(payables.map((p) => [p.obligationId, p]));
  for (const l of lines) {
    const p = byId.get(l.obligationId);
    if (!p) throw new DomainError('PAYOUT_OBLIGATION_UNKNOWN');
    assertCents(l.amountCents, 'payout');
    if (l.amountCents === 0) throw new DomainError('PAYOUT_ZERO');
    if (l.amountCents > p.payableCents) throw new DomainError('PAYOUT_EXCEEDS_PAYABLE');
  }
}
