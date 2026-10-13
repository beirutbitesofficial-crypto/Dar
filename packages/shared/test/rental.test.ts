import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRentalBreakdown,
  DEFAULT_RENTAL_FEE_RULES,
  ownerRentalPreview,
  planAllObligations,
  PricingSettings,
  RentalPricingMode,
  snapshotRentalTerms,
  snapshotSaleTerms,
  recordAcceptance,
} from '../src/domain';

test('rental NET_PLUS_FEE: $500 net + $50 fee = $550 tenant total, $500 owner payout', () => {
  const b = computeRentalBreakdown(50_000, DEFAULT_RENTAL_FEE_RULES);
  assert.deepEqual(b, { mode: 'NET_PLUS_FEE', landlordNetCents: 50_000, platformFeeCents: 5_000, tenantTotalCents: 55_000 });
});

test('rental TOTAL_MINUS_FEE: owner sees resulting net before acceptance', () => {
  const p = ownerRentalPreview(55_000, { mode: RentalPricingMode.TOTAL_MINUS_FEE, monthlyFeeCents: 5_000 });
  assert.equal(p.landlordNetCents, 50_000);
  assert.equal(p.tenantTotalCents, 55_000);
  assert.equal(p.feeDeductedFromOwner, true);
  const def = ownerRentalPreview(50_000, DEFAULT_RENTAL_FEE_RULES);
  assert.equal(def.feeDeductedFromOwner, false);
});

test('rental TOTAL_MINUS_FEE: fee must be lower than the total', () => {
  assert.throws(
    () => computeRentalBreakdown(5_000, { mode: RentalPricingMode.TOTAL_MINUS_FEE, monthlyFeeCents: 5_000 }),
    /lower than the total/,
  );
});

test('rental: the $50 is never silently deducted from the owner in the default mode', () => {
  for (const net of [10_000, 35_000, 50_000, 123_456]) {
    const b = computeRentalBreakdown(net, DEFAULT_RENTAL_FEE_RULES);
    assert.equal(b.landlordNetCents, net);
    assert.equal(b.tenantTotalCents, net + 5_000);
  }
});

const settingsV1: PricingSettings = {
  version: 1,
  termsVersion: '2026-10-v1',
  sale: { sellerBps: 250, buyerBps: 250 },
  rental: { mode: RentalPricingMode.NET_PLUS_FEE, monthlyFeeCents: 5_000 },
};
const settingsV2: PricingSettings = {
  version: 2,
  termsVersion: '2027-01-v2',
  sale: { sellerBps: 300, buyerBps: 300 },
  rental: { mode: RentalPricingMode.TOTAL_MINUS_FEE, monthlyFeeCents: 7_500 },
};

test('existing agreements retain their accepted fees after global settings change', () => {
  const accepted = snapshotRentalTerms(settingsV1, 50_000);
  // Admin changes the global fee and mode afterwards:
  const later = snapshotRentalTerms(settingsV2, 50_000);
  assert.equal(later.platformFeeCents, 7_500);
  // Obligations are generated only from the stored snapshot:
  const periods = planAllObligations({
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    dueDay: 1,
    proration: 'NONE',
    baseTerms: { landlordNetCents: accepted.landlordNetCents, platformFeeCents: accepted.platformFeeCents },
  });
  assert.equal(periods.length, 12);
  for (const p of periods) {
    assert.equal(p.landlordShareCents, 50_000);
    assert.equal(p.feeShareCents, 5_000);
    assert.equal(p.totalCents, 55_000);
  }
  assert.equal(accepted.settingsVersion, 1);
  assert.equal(accepted.termsVersion, '2026-10-v1');
  assert.ok(Object.isFrozen(accepted), 'snapshot must be immutable');
});

test('sale snapshot freezes rules; override requires an admin reason', () => {
  const s = snapshotSaleTerms(settingsV1, 10_000_000);
  assert.equal(s.buyerCommissionCents, 250_000);
  assert.ok(Object.isFrozen(s.rules), 'frozen rules');
  try { (s as any).rules.buyerBps = 1; } catch { /* strict mode throws; sloppy mode ignores */ }
  assert.equal(s.rules.buyerBps, 250, 'rules cannot be mutated');
  const o = snapshotSaleTerms(settingsV1, 10_000_000, {
    rules: { sellerBps: 200, buyerBps: 250 },
    approvedByAdminId: 'admin-1',
    reason: 'Repeat seller discount approved by management',
  });
  assert.equal(o.sellerCommissionCents, 200_000);
  assert.equal(o.overrideApprovedBy, 'admin-1');
  assert.throws(() =>
    snapshotSaleTerms(settingsV1, 10_000_000, { rules: settingsV1.sale, approvedByAdminId: 'a', reason: '' }),
  );
});

test('acceptance must record terms version and the exact disclosed amounts', () => {
  assert.throws(() =>
    recordAcceptance({ userId: 'u1', acceptedAt: new Date().toISOString(), termsVersion: 'v1', disclosedAmounts: {}, channel: 'mobile' }),
  );
  const a = recordAcceptance({
    userId: 'u1',
    acceptedAt: '2026-10-13T09:00:00.000Z',
    termsVersion: 'v1',
    disclosedAmounts: { tenantTotalCents: 55_000, platformFeeCents: 5_000 },
    channel: 'mobile',
  });
  assert.equal(a.disclosedAmounts.tenantTotalCents, 55_000);
});
