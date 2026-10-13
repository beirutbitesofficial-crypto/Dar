import {
  addDays,
  addMonthsAnchored,
  compareDates,
  daysInMonth,
  diffDays,
  ISODate,
  minDate,
  parseISODate,
  toISODate,
} from './dates';
import { DomainError } from './errors';
import { assertCents, Cents, prorate } from './money';

/**
 * Monthly rent obligations for a rental agreement.
 *
 * - Billing periods are anchored to the agreement start day: a lease starting
 *   on the 31st bills Jan 31, Feb 28/29, Mar 31 ... (clamped at month end).
 * - The due date is the first occurrence of `dueDay` on or after the period
 *   start (clamped to month end). If that falls after the period ends (short
 *   final period), the due date is the period start.
 * - Each period has a stable `periodIndex`. The database enforces
 *   UNIQUE(agreementId, periodIndex) so generation is idempotent.
 * - Proration is explicit: NONE charges a full month for any started period;
 *   DAILY prorates a short final period by days (landlord share and fee are
 *   prorated separately so allocation stays exact).
 * - Amendments take effect from the first period starting on/after their
 *   effective date. They never alter already-generated obligations.
 */
export const ProrationPolicy = { NONE: 'NONE', DAILY: 'DAILY' } as const;
export type ProrationPolicy = (typeof ProrationPolicy)[keyof typeof ProrationPolicy];

export interface MonthlyTerms {
  landlordNetCents: Cents;
  platformFeeCents: Cents;
}

export interface Amendment extends MonthlyTerms {
  id: string;
  effectiveFrom: ISODate;
}

export interface ScheduleInput {
  startDate: ISODate;
  /** Last day of the lease (inclusive). */
  endDate: ISODate;
  dueDay: number;
  proration: ProrationPolicy;
  baseTerms: MonthlyTerms;
  amendments?: readonly Amendment[];
  /** Last day of occupancy when terminated early (inclusive). */
  terminationDate?: ISODate | null;
}

export interface PlannedObligation {
  periodIndex: number;
  periodStart: ISODate;
  periodEnd: ISODate;
  dueDate: ISODate;
  landlordShareCents: Cents;
  feeShareCents: Cents;
  totalCents: Cents;
  prorated: boolean;
  amendmentId: string | null;
}

const MAX_PERIODS = 600; // 50 years — protects against runaway loops on bad input

export function validateSchedule(input: ScheduleInput) {
  parseISODate(input.startDate);
  parseISODate(input.endDate);
  if (compareDates(input.endDate, input.startDate) < 0) throw new DomainError('AGREEMENT_END_BEFORE_START');
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) throw new DomainError('DUE_DAY_INVALID');
  assertCents(input.baseTerms.landlordNetCents, 'landlordNet');
  assertCents(input.baseTerms.platformFeeCents, 'platformFee');
  if (input.terminationDate) {
    parseISODate(input.terminationDate);
    if (compareDates(input.terminationDate, input.startDate) < 0) throw new DomainError('TERMINATION_BEFORE_START');
  }
  for (const a of input.amendments ?? []) {
    parseISODate(a.effectiveFrom);
    assertCents(a.landlordNetCents);
    assertCents(a.platformFeeCents);
  }
}

export function dueDateFor(periodStart: ISODate, periodEnd: ISODate, dueDay: number): ISODate {
  const { y, m } = parseISODate(periodStart);
  let candidate = toISODate(y, m, Math.min(dueDay, daysInMonth(y, m)));
  if (compareDates(candidate, periodStart) < 0) {
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    candidate = toISODate(ny, nm, Math.min(dueDay, daysInMonth(ny, nm)));
  }
  return compareDates(candidate, periodEnd) > 0 ? periodStart : candidate;
}

function termsForPeriod(input: ScheduleInput, periodStart: ISODate): MonthlyTerms & { amendmentId: string | null } {
  const applicable = [...(input.amendments ?? [])]
    .filter((a) => compareDates(a.effectiveFrom, periodStart) <= 0)
    .sort((a, b) => compareDates(a.effectiveFrom, b.effectiveFrom));
  const last = applicable[applicable.length - 1];
  return last
    ? { landlordNetCents: last.landlordNetCents, platformFeeCents: last.platformFeeCents, amendmentId: last.id }
    : { ...input.baseTerms, amendmentId: null };
}

/** All billing periods of the agreement (respecting early termination). */
export function planAllObligations(input: ScheduleInput): PlannedObligation[] {
  validateSchedule(input);
  const anchorDay = parseISODate(input.startDate).d;
  const lastDay = input.terminationDate ? minDate(input.endDate, input.terminationDate) : input.endDate;
  const out: PlannedObligation[] = [];
  for (let i = 0; i < MAX_PERIODS; i++) {
    const periodStart = addMonthsAnchored(input.startDate, i, anchorDay);
    if (compareDates(periodStart, lastDay) > 0) break;
    const fullEnd = addDays(addMonthsAnchored(input.startDate, i + 1, anchorDay), -1);
    const periodEnd = minDate(fullEnd, lastDay);
    const terms = termsForPeriod(input, periodStart);
    const partial = compareDates(periodEnd, fullEnd) < 0;
    let landlord = terms.landlordNetCents;
    let fee = terms.platformFeeCents;
    const prorated = partial && input.proration === ProrationPolicy.DAILY;
    if (prorated) {
      const covered = diffDays(periodStart, periodEnd) + 1;
      const full = diffDays(periodStart, fullEnd) + 1;
      landlord = prorate(landlord, covered, full);
      fee = prorate(fee, covered, full);
    }
    out.push({
      periodIndex: i,
      periodStart,
      periodEnd,
      dueDate: dueDateFor(periodStart, periodEnd, input.dueDay),
      landlordShareCents: landlord,
      feeShareCents: fee,
      totalCents: landlord + fee,
      prorated,
      amendmentId: terms.amendmentId,
    });
  }
  return out;
}

/**
 * Obligations that should exist as of `throughDate` (typically today + a
 * look-ahead window), minus the period indexes already stored. Safe to call
 * repeatedly: it never returns a period that already exists.
 */
export function planMissingObligations(
  input: ScheduleInput,
  throughDate: ISODate,
  existingPeriodIndexes: Iterable<number>,
): PlannedObligation[] {
  const existing = new Set(existingPeriodIndexes);
  return planAllObligations(input).filter(
    (p) => compareDates(p.periodStart, throughDate) <= 0 && !existing.has(p.periodIndex),
  );
}

export interface ExistingObligation {
  id: string;
  periodIndex: number;
  landlordShareCents: Cents;
  feeShareCents: Cents;
  collectedCents: Cents;
}

export type TerminationAction =
  | { kind: 'VOID'; obligationId: string; requiresRefundReview: boolean }
  | {
      kind: 'ADJUST';
      obligationId: string;
      landlordShareCents: Cents;
      feeShareCents: Cents;
      requiresRefundReview: boolean;
    };

/**
 * Early termination: obligations for periods entirely after the last day are
 * voided; the period containing the last day is adjusted when DAILY proration
 * was agreed. Nothing is deleted. If money was already collected beyond the
 * new amount, the action is flagged for a recorded refund decision.
 */
export function planTermination(input: ScheduleInput & { terminationDate: ISODate }, existing: readonly ExistingObligation[]) {
  const planned = new Map(planAllObligations(input).map((p) => [p.periodIndex, p]));
  const actions: TerminationAction[] = [];
  for (const o of existing) {
    const p = planned.get(o.periodIndex);
    if (!p) {
      actions.push({ kind: 'VOID', obligationId: o.id, requiresRefundReview: o.collectedCents > 0 });
    } else if (p.landlordShareCents !== o.landlordShareCents || p.feeShareCents !== o.feeShareCents) {
      actions.push({
        kind: 'ADJUST',
        obligationId: o.id,
        landlordShareCents: p.landlordShareCents,
        feeShareCents: p.feeShareCents,
        requiresRefundReview: o.collectedCents > p.totalCents,
      });
    }
  }
  return actions;
}

/** A renewal is a new agreement that starts the day after the previous one ends. */
export function renewalStartDate(previousEndDate: ISODate): ISODate {
  return addDays(previousEndDate, 1);
}
