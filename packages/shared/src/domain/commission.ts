import { applyBasisPoints, assertBasisPoints, assertCents, BasisPoints, Cents } from './money';

/**
 * Sale brokerage: each party pays its own percentage of the FINAL agreed sale
 * price. Default 2.5% seller + 2.5% buyer = 5% combined brokerage revenue.
 * These estimates exclude taxes, registration fees and any other charges.
 */
export interface SaleFeeRules {
  sellerBps: BasisPoints;
  buyerBps: BasisPoints;
}

export const DEFAULT_SALE_FEE_RULES: SaleFeeRules = Object.freeze({ sellerBps: 250, buyerBps: 250 });

export interface SaleBreakdown {
  priceCents: Cents;
  sellerCommissionCents: Cents;
  buyerCommissionCents: Cents;
  totalBrokerageCents: Cents;
  /** Price minus the seller's brokerage commission only. */
  sellerProceedsCents: Cents;
  /** Price plus the buyer's brokerage commission only. */
  buyerTotalCents: Cents;
  rules: SaleFeeRules;
}

export function computeSaleBreakdown(priceCents: Cents, rules: SaleFeeRules = DEFAULT_SALE_FEE_RULES): SaleBreakdown {
  assertCents(priceCents, 'price');
  assertBasisPoints(rules.sellerBps, 'sellerBps');
  assertBasisPoints(rules.buyerBps, 'buyerBps');
  const seller = applyBasisPoints(priceCents, rules.sellerBps);
  const buyer = applyBasisPoints(priceCents, rules.buyerBps);
  return {
    priceCents,
    sellerCommissionCents: seller,
    buyerCommissionCents: buyer,
    totalBrokerageCents: seller + buyer,
    sellerProceedsCents: priceCents - seller,
    buyerTotalCents: priceCents + buyer,
    rules: { sellerBps: rules.sellerBps, buyerBps: rules.buyerBps },
  };
}

/** What the owner sees while typing an asking price. */
export function ownerSaleEstimate(askingPriceCents: Cents, rules: SaleFeeRules) {
  const b = computeSaleBreakdown(askingPriceCents, rules);
  return {
    askingPriceCents: b.priceCents,
    sellerCommissionCents: b.sellerCommissionCents,
    sellerProceedsCents: b.sellerProceedsCents,
    sellerBps: rules.sellerBps,
  };
}

/** What a prospective buyer sees on a listing. Never includes the seller's figures. */
export function customerSaleEstimate(askingPriceCents: Cents, rules: SaleFeeRules) {
  const b = computeSaleBreakdown(askingPriceCents, rules);
  return {
    askingPriceCents: b.priceCents,
    buyerCommissionCents: b.buyerCommissionCents,
    buyerTotalCents: b.buyerTotalCents,
    buyerBps: rules.buyerBps,
  };
}

export const SaleObligationStatus = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  WAIVED: 'WAIVED',
  REFUNDED: 'REFUNDED',
} as const;
export type SaleObligationStatus = (typeof SaleObligationStatus)[keyof typeof SaleObligationStatus];

/**
 * Derives a sale commission obligation's status from its amount and the net
 * collected so far. Waivers are an explicit, audited admin action.
 */
export function deriveSaleObligationStatus(input: {
  amountDueCents: Cents;
  netCollectedCents: Cents;
  everCollectedCents: Cents;
  waived: boolean;
}): SaleObligationStatus {
  if (input.waived) return SaleObligationStatus.WAIVED;
  if (input.netCollectedCents >= input.amountDueCents && input.amountDueCents > 0) return SaleObligationStatus.PAID;
  if (input.netCollectedCents <= 0 && input.everCollectedCents > 0) return SaleObligationStatus.REFUNDED;
  if (input.netCollectedCents > 0) return SaleObligationStatus.PARTIALLY_PAID;
  if (input.amountDueCents === 0) return SaleObligationStatus.PAID;
  return SaleObligationStatus.PENDING;
}
