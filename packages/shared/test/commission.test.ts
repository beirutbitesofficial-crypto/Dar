import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBasisPoints,
  computeSaleBreakdown,
  customerSaleEstimate,
  DEFAULT_SALE_FEE_RULES,
  deriveSaleObligationStatus,
  formatBasisPoints,
  ownerSaleEstimate,
  parseMoneyInput,
  centsToDecimalString,
} from '../src/domain';

test('sale: $100,000 at 2.5% + 2.5% matches the specification exactly', () => {
  const b = computeSaleBreakdown(10_000_000, DEFAULT_SALE_FEE_RULES);
  assert.equal(b.sellerCommissionCents, 250_000); // $2,500
  assert.equal(b.buyerCommissionCents, 250_000); // $2,500
  assert.equal(b.totalBrokerageCents, 500_000); // $5,000
  assert.equal(b.sellerProceedsCents, 9_750_000); // $97,500
  assert.equal(b.buyerTotalCents, 10_250_000); // $102,500
});

test('sale: owner sees seller figures only, customer sees buyer figures only', () => {
  const owner = ownerSaleEstimate(10_000_000, DEFAULT_SALE_FEE_RULES);
  assert.deepEqual(Object.keys(owner).sort(), ['askingPriceCents', 'sellerBps', 'sellerCommissionCents', 'sellerProceedsCents']);
  assert.equal(owner.sellerProceedsCents, 9_750_000);
  const customer = customerSaleEstimate(10_000_000, DEFAULT_SALE_FEE_RULES);
  assert.deepEqual(Object.keys(customer).sort(), ['askingPriceCents', 'buyerBps', 'buyerCommissionCents', 'buyerTotalCents']);
  assert.equal(customer.buyerTotalCents, 10_250_000);
});

test('sale: commissions are computed on the final agreed price, not the asking price', () => {
  const asking = computeSaleBreakdown(15_000_000, DEFAULT_SALE_FEE_RULES);
  const final = computeSaleBreakdown(14_200_000, DEFAULT_SALE_FEE_RULES);
  assert.equal(asking.sellerCommissionCents, 375_000);
  assert.equal(final.sellerCommissionCents, 355_000);
  assert.equal(final.buyerCommissionCents, 355_000);
});

test('sale: asymmetric configurable rates', () => {
  const b = computeSaleBreakdown(20_000_000, { sellerBps: 200, buyerBps: 300 });
  assert.equal(b.sellerCommissionCents, 400_000);
  assert.equal(b.buyerCommissionCents, 600_000);
  assert.equal(b.totalBrokerageCents, 1_000_000);
});

test('money: exact half-up rounding to the cent with integer arithmetic', () => {
  assert.equal(applyBasisPoints(12_345_678, 250), 308_642); // 308,641.95 → 308,642
  assert.equal(applyBasisPoints(2, 2500), 1); // 0.5 → 1
  assert.equal(applyBasisPoints(1, 2500), 0); // 0.25 → 0
  assert.equal(applyBasisPoints(99_999_999_999, 250), 2_500_000_000); // no float drift at large values
});

test('money: rejects non-integer, negative and out-of-range values', () => {
  assert.throws(() => computeSaleBreakdown(100.5 as number), /integer/);
  assert.throws(() => computeSaleBreakdown(-1), /negative/);
  assert.throws(() => computeSaleBreakdown(100, { sellerBps: 10_001, buyerBps: 0 }));
  assert.throws(() => computeSaleBreakdown(100, { sellerBps: 2.5, buyerBps: 0 }));
});

test('money: parses Latin and Arabic-Indic input', () => {
  assert.equal(parseMoneyInput('150,000'), 15_000_000);
  assert.equal(parseMoneyInput('١٥٠٬٠٠٠'), 15_000_000);
  assert.equal(parseMoneyInput('$1,250.5'), 125_050);
  assert.equal(parseMoneyInput('1,250.555'), null);
  assert.equal(parseMoneyInput('-5'), null);
  assert.equal(parseMoneyInput('abc'), null);
  assert.equal(centsToDecimalString(250_000), '2500.00');
  assert.equal(centsToDecimalString(-5), '-0.05');
  assert.equal(formatBasisPoints(250), '2.5%');
  assert.equal(formatBasisPoints(300), '3%');
});

test('sale obligations: Pending → Partially paid → Paid, Waived, Refunded', () => {
  const base = { amountDueCents: 250_000, waived: false };
  assert.equal(deriveSaleObligationStatus({ ...base, netCollectedCents: 0, everCollectedCents: 0 }), 'PENDING');
  assert.equal(deriveSaleObligationStatus({ ...base, netCollectedCents: 100_000, everCollectedCents: 100_000 }), 'PARTIALLY_PAID');
  assert.equal(deriveSaleObligationStatus({ ...base, netCollectedCents: 250_000, everCollectedCents: 250_000 }), 'PAID');
  assert.equal(deriveSaleObligationStatus({ ...base, netCollectedCents: 0, everCollectedCents: 250_000 }), 'REFUNDED');
  assert.equal(deriveSaleObligationStatus({ ...base, waived: true, netCollectedCents: 0, everCollectedCents: 0 }), 'WAIVED');
});
