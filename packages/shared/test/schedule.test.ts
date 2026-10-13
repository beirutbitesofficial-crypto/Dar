import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsAnchored,
  dueDateFor,
  planAllObligations,
  planMissingObligations,
  planTermination,
  renewalStartDate,
  ScheduleInput,
  todayInBeirut,
} from '../src/domain';

const terms = { landlordNetCents: 50_000, platformFeeCents: 5_000 };

test('month-end anchoring: a lease starting Jan 31 bills Feb 28, Mar 31, Apr 30', () => {
  const p = planAllObligations({ startDate: '2026-01-31', endDate: '2026-05-30', dueDay: 31, proration: 'NONE', baseTerms: terms });
  assert.deepEqual(
    p.map((x) => [x.periodStart, x.periodEnd, x.dueDate]),
    [
      ['2026-01-31', '2026-02-27', '2026-01-31'],
      ['2026-02-28', '2026-03-30', '2026-02-28'],
      ['2026-03-31', '2026-04-29', '2026-03-31'],
      ['2026-04-30', '2026-05-30', '2026-04-30'],
    ],
  );
  assert.ok(p.every((x) => !x.prorated && x.totalCents === 55_000));
});

test('leap year clamping', () => {
  assert.equal(addMonthsAnchored('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonthsAnchored('2028-01-31', 2), '2028-03-31');
  assert.equal(addMonthsAnchored('2026-11-30', 3), '2027-02-28');
});

test('due day falls on the next occurrence within the period', () => {
  assert.equal(dueDateFor('2026-01-15', '2026-02-14', 1), '2026-02-01');
  assert.equal(dueDateFor('2026-01-15', '2026-02-14', 20), '2026-01-20');
  assert.equal(dueDateFor('2026-03-01', '2026-03-10', 25), '2026-03-01'); // short final period
});

test('explicit DAILY proration of a short final period, landlord and fee prorated separately', () => {
  const base: ScheduleInput = { startDate: '2026-01-01', endDate: '2026-03-15', dueDay: 1, proration: 'DAILY', baseTerms: terms };
  const p = planAllObligations(base);
  assert.equal(p.length, 3);
  const last = p[2]!;
  assert.equal(last.periodEnd, '2026-03-15');
  assert.equal(last.prorated, true);
  assert.equal(last.landlordShareCents, 24_194); // 50,000 × 15/31 = 24,193.55
  assert.equal(last.feeShareCents, 2_419); // 5,000 × 15/31 = 2,419.35
  assert.equal(last.totalCents, 26_613);
  const none = planAllObligations({ ...base, proration: 'NONE' });
  assert.equal(none[2]!.totalCents, 55_000);
  assert.equal(none[2]!.prorated, false);
});

test('monthly generation is idempotent: re-running never produces duplicates', () => {
  const input: ScheduleInput = { startDate: '2026-01-01', endDate: '2026-12-31', dueDay: 5, proration: 'NONE', baseTerms: terms };
  const first = planMissingObligations(input, '2026-02-15', []);
  assert.deepEqual(first.map((p) => p.periodIndex), [0, 1]);
  const again = planMissingObligations(input, '2026-02-15', [0, 1]);
  assert.deepEqual(again, []);
  const later = planMissingObligations(input, '2026-04-01', [0, 1]);
  assert.deepEqual(later.map((p) => p.periodIndex), [2, 3]);
  // Same period index always maps to the same dates and amounts:
  assert.deepEqual(planAllObligations(input)[1], first[1]);
});

test('amendments apply from the first period starting on/after their effective date', () => {
  const p = planAllObligations({
    startDate: '2026-01-01',
    endDate: '2026-04-30',
    dueDay: 1,
    proration: 'NONE',
    baseTerms: terms,
    amendments: [{ id: 'am1', effectiveFrom: '2026-02-10', landlordNetCents: 60_000, platformFeeCents: 5_000 }],
  });
  assert.deepEqual(p.map((x) => x.landlordShareCents), [50_000, 50_000, 60_000, 60_000]);
  assert.equal(p[2]!.amendmentId, 'am1');
});

test('early termination voids future periods and adjusts the current one (DAILY)', () => {
  const input = { startDate: '2026-01-01', endDate: '2026-12-31', dueDay: 1, proration: 'DAILY' as const, baseTerms: terms };
  const existing = [0, 1, 2, 3].map((i) => ({
    id: `ob${i}`,
    periodIndex: i,
    landlordShareCents: 50_000,
    feeShareCents: 5_000,
    collectedCents: i === 3 ? 10_000 : i < 2 ? 55_000 : 0,
  }));
  const actions = planTermination({ ...input, terminationDate: '2026-03-15' }, existing);
  assert.deepEqual(actions, [
    { kind: 'ADJUST', obligationId: 'ob2', landlordShareCents: 24_194, feeShareCents: 2_419, requiresRefundReview: false },
    { kind: 'VOID', obligationId: 'ob3', requiresRefundReview: true },
  ]);
});

test('renewal starts the day after the previous end date', () => {
  assert.equal(renewalStartDate('2026-12-31'), '2027-01-01');
});

test('invalid schedules are rejected', () => {
  assert.throws(() => planAllObligations({ startDate: '2026-05-01', endDate: '2026-04-01', dueDay: 1, proration: 'NONE', baseTerms: terms }));
  assert.throws(() => planAllObligations({ startDate: '2026-02-30', endDate: '2026-04-01', dueDay: 1, proration: 'NONE', baseTerms: terms }));
  assert.throws(() => planAllObligations({ startDate: '2026-01-01', endDate: '2026-04-01', dueDay: 32, proration: 'NONE', baseTerms: terms }));
});

test('Beirut calendar date crosses midnight correctly (UTC+3 in summer, UTC+2 in winter)', () => {
  assert.equal(todayInBeirut(new Date('2026-07-31T21:30:00Z')), '2026-08-01');
  assert.equal(todayInBeirut(new Date('2026-12-31T21:30:00Z')), '2026-12-31');
  assert.equal(todayInBeirut(new Date('2026-12-31T22:30:00Z')), '2027-01-01');
});
