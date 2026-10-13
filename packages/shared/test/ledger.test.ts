import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardMoney,
  computeObligationBalance,
  computeOwnerPayables,
  LedgerEntry,
  ObligationState,
  planPayout,
  planPaymentAllocation,
  planRefund,
  planReversal,
  validatePayoutLines,
} from '../src/domain';

const today = '2026-10-13';
function obligation(entries: LedgerEntry[] = []): ObligationState {
  return { landlordDueCents: 50_000, feeDueCents: 5_000, dueDate: '2026-10-05', entries };
}
let seq = 0;
function apply(state: ObligationState, entry: Omit<LedgerEntry, 'id'>): ObligationState {
  return { ...state, entries: [...state.entries, { id: `e${++seq}`, ...entry }] };
}

test('partial payments fill the landlord share first, then the platform fee', () => {
  let s = obligation();
  assert.equal(computeObligationBalance(s, today).status, 'OVERDUE');
  const p1 = planPaymentAllocation(s, 30_000, today);
  assert.deepEqual(p1, { kind: 'PAYMENT', landlordCents: 30_000, feeCents: 0 });
  s = apply(s, p1);
  let b = computeObligationBalance(s, today);
  assert.equal(b.status, 'PARTIALLY_PAID');
  assert.equal(b.remainingCents, 25_000);
  const p2 = planPaymentAllocation(s, 25_000, today);
  assert.deepEqual(p2, { kind: 'PAYMENT', landlordCents: 20_000, feeCents: 5_000 });
  s = apply(s, p2);
  b = computeObligationBalance(s, today);
  assert.equal(b.status, 'PAID');
  assert.equal(b.landlordCollectedCents, 50_000);
  assert.equal(b.feeCollectedCents, 5_000);
  assert.throws(() => planPaymentAllocation(s, 1, today), /larger than the remaining/);
});

test('overpayment, zero payments and void obligations are rejected', () => {
  assert.throws(() => planPaymentAllocation(obligation(), 55_001, today));
  assert.throws(() => planPaymentAllocation(obligation(), 0, today));
  assert.throws(() => planPaymentAllocation({ ...obligation(), voided: true }, 100, today));
});

test('reversal negates exactly one payment and cannot be applied twice', () => {
  let s = obligation();
  s = apply(s, planPaymentAllocation(s, 30_000, today));
  s = apply(s, planPaymentAllocation(s, 25_000, today));
  const secondId = s.entries[1]!.id;
  const r = planReversal(s, secondId);
  assert.deepEqual(r, { kind: 'REVERSAL', landlordCents: -20_000, feeCents: -5_000, reversesEntryId: secondId });
  s = apply(s, r);
  const b = computeObligationBalance(s, today);
  assert.equal(b.totalCollectedCents, 30_000);
  assert.equal(b.status, 'PARTIALLY_PAID');
  assert.equal(s.entries.length, 3, 'history is kept, nothing deleted');
  assert.throws(() => planReversal(s, secondId), /ALREADY_REVERSED/);
  assert.throws(() => planReversal(s, s.entries[2]!.id), /ONLY_PAYMENTS/);
});

test('refunds reduce the platform fee first, then the landlord share', () => {
  let s = obligation();
  s = apply(s, planPaymentAllocation(s, 55_000, today));
  const r = planRefund(s, 7_000, today);
  assert.deepEqual(r, { kind: 'REFUND', landlordCents: -2_000, feeCents: -5_000 });
  assert.throws(() => planRefund(s, 55_001, today));
});

test('a tenant payment does NOT mark the owner as paid; only a recorded payout does', () => {
  let s = obligation();
  s = apply(s, planPaymentAllocation(s, 55_000, today));
  const collected = computeObligationBalance(s, today).landlordCollectedCents;
  let pay = computeOwnerPayables([{ obligationId: 'ob1', landlordCollectedCents: collected }], []);
  assert.equal(pay.totalPayableCents, 50_000);
  assert.equal(pay.totalPaidOutCents, 0);
  const lines = planPayout(pay.lines);
  assert.deepEqual(lines, [{ obligationId: 'ob1', amountCents: 50_000 }]);
  pay = computeOwnerPayables([{ obligationId: 'ob1', landlordCollectedCents: collected }], lines);
  assert.equal(pay.totalPayableCents, 0);
  assert.equal(pay.totalPaidOutCents, 50_000);
  assert.throws(() => planPayout(pay.lines), /NOTHING_PAYABLE/);
});

test('owner payout balance with partial collection, payout, then a reversed tenant payment', () => {
  let s = obligation();
  s = apply(s, planPaymentAllocation(s, 30_000, today));
  let pos = [{ obligationId: 'ob1', landlordCollectedCents: computeObligationBalance(s, today).landlordCollectedCents }];
  let pay = computeOwnerPayables(pos, []);
  assert.equal(pay.totalPayableCents, 30_000);
  validatePayoutLines(pay.lines, [{ obligationId: 'ob1', amountCents: 30_000 }]);
  assert.throws(() => validatePayoutLines(pay.lines, [{ obligationId: 'ob1', amountCents: 30_001 }]), /EXCEEDS/);
  const payouts = [{ obligationId: 'ob1', amountCents: 30_000 }];
  // The tenant's bank transfer bounces after the owner was paid:
  s = apply(s, planReversal(s, s.entries[0]!.id));
  pos = [{ obligationId: 'ob1', landlordCollectedCents: computeObligationBalance(s, today).landlordCollectedCents }];
  pay = computeOwnerPayables(pos, payouts);
  assert.equal(pay.totalPayableCents, 0);
  assert.equal(pay.ownerDebtCents, 30_000, 'surfaced as owner debt, never hidden');
});

test('dashboard: collected rent is not counted as platform revenue', () => {
  const m = computeDashboardMoney({
    rentCollectedLandlordCents: 1_000_000,
    rentCollectedFeeCents: 100_000,
    rentFeeOutstandingCents: 15_000,
    saleCommissionCollectedCents: 500_000,
    saleCommissionOutstandingCents: 250_000,
    ownerPayoutsCents: 800_000,
  });
  assert.deepEqual(m, {
    moneyCollectedCents: 1_600_000,
    brokerageRevenueEarnedCents: 600_000,
    brokerageFeesUnpaidCents: 265_000,
    rentOwedToLandlordsCents: 200_000,
    landlordPayoutsCents: 800_000,
  });
});
