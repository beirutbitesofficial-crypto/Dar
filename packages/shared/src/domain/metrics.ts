import { Cents } from './money';

/**
 * Dashboard money metrics. These are deliberately separate figures so that
 * collected rent is never presented as platform revenue.
 */
export interface FinancialAggregates {
  /** Net rent collected from tenants (payments − reversals − refunds), split. */
  rentCollectedLandlordCents: Cents;
  rentCollectedFeeCents: Cents;
  /** Fee portion still outstanding on rent obligations that are due (not void/waived). */
  rentFeeOutstandingCents: Cents;
  /** Net sale commissions collected (buyer + seller). */
  saleCommissionCollectedCents: Cents;
  /** Sale commission still owed on approved closings (not waived). */
  saleCommissionOutstandingCents: Cents;
  /** Net owner payouts recorded (payouts − payout reversals). */
  ownerPayoutsCents: Cents;
}

export interface DashboardMoney {
  moneyCollectedCents: Cents;
  brokerageRevenueEarnedCents: Cents;
  brokerageFeesUnpaidCents: Cents;
  rentOwedToLandlordsCents: Cents;
  landlordPayoutsCents: Cents;
}

export function computeDashboardMoney(a: FinancialAggregates): DashboardMoney {
  return {
    moneyCollectedCents: a.rentCollectedLandlordCents + a.rentCollectedFeeCents + a.saleCommissionCollectedCents,
    brokerageRevenueEarnedCents: a.rentCollectedFeeCents + a.saleCommissionCollectedCents,
    brokerageFeesUnpaidCents: a.rentFeeOutstandingCents + a.saleCommissionOutstandingCents,
    rentOwedToLandlordsCents: a.rentCollectedLandlordCents - a.ownerPayoutsCents,
    landlordPayoutsCents: a.ownerPayoutsCents,
  };
}
