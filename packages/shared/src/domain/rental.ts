import { DomainError } from './errors';
import { assertCents, Cents, dollarsToCents } from './money';

/**
 * Rentals carry a RECURRING monthly brokerage/management fee — not a one-time
 * viewing fee or one-time commission.
 *
 * NET_PLUS_FEE (default): the owner enters the net rent they expect to receive;
 *   the tenant pays net + fee every month; the owner is paid the full net.
 * TOTAL_MINUS_FEE: the owner enters the total monthly rent; an explicitly
 *   agreed fee is deducted and the owner's resulting net is shown before
 *   acceptance.
 */
export const RentalPricingMode = {
  NET_PLUS_FEE: 'NET_PLUS_FEE',
  TOTAL_MINUS_FEE: 'TOTAL_MINUS_FEE',
} as const;
export type RentalPricingMode = (typeof RentalPricingMode)[keyof typeof RentalPricingMode];

export interface RentalFeeRules {
  mode: RentalPricingMode;
  monthlyFeeCents: Cents;
}

export const DEFAULT_RENTAL_FEE_RULES: RentalFeeRules = Object.freeze({
  mode: RentalPricingMode.NET_PLUS_FEE,
  monthlyFeeCents: dollarsToCents(50),
});

export interface RentalBreakdown {
  mode: RentalPricingMode;
  /** What the landlord is owed each month once the tenant has paid. */
  landlordNetCents: Cents;
  /** Retained by the platform each month. */
  platformFeeCents: Cents;
  /** What the tenant pays each month. Shown prominently to customers. */
  tenantTotalCents: Cents;
}

/**
 * @param enteredAmountCents the amount the owner typed: net rent in
 *   NET_PLUS_FEE mode, total rent in TOTAL_MINUS_FEE mode.
 */
export function computeRentalBreakdown(enteredAmountCents: Cents, rules: RentalFeeRules): RentalBreakdown {
  assertCents(enteredAmountCents, 'rent');
  assertCents(rules.monthlyFeeCents, 'monthlyFee');
  switch (rules.mode) {
    case RentalPricingMode.NET_PLUS_FEE:
      return {
        mode: rules.mode,
        landlordNetCents: enteredAmountCents,
        platformFeeCents: rules.monthlyFeeCents,
        tenantTotalCents: enteredAmountCents + rules.monthlyFeeCents,
      };
    case RentalPricingMode.TOTAL_MINUS_FEE: {
      if (rules.monthlyFeeCents >= enteredAmountCents) {
        throw new DomainError('RENT_FEE_EXCEEDS_TOTAL', 'The monthly fee must be lower than the total rent');
      }
      return {
        mode: rules.mode,
        landlordNetCents: enteredAmountCents - rules.monthlyFeeCents,
        platformFeeCents: rules.monthlyFeeCents,
        tenantTotalCents: enteredAmountCents,
      };
    }
    default:
      throw new DomainError('RENT_MODE_UNKNOWN');
  }
}

/**
 * Builds the explicit monthly terms an agreement is created with. Agreement
 * amounts are stored as three independent integers; nothing is recomputed
 * from global settings afterwards.
 */
export function rentalTermsFromBreakdown(b: RentalBreakdown) {
  if (b.landlordNetCents + b.platformFeeCents !== b.tenantTotalCents) {
    throw new DomainError('RENT_TERMS_INCONSISTENT');
  }
  return {
    pricingMode: b.mode,
    landlordNetCents: b.landlordNetCents,
    platformFeeCents: b.platformFeeCents,
    tenantTotalCents: b.tenantTotalCents,
  };
}

/** Owner-facing explanation for TOTAL_MINUS_FEE, required before acceptance. */
export function ownerRentalPreview(enteredAmountCents: Cents, rules: RentalFeeRules) {
  const b = computeRentalBreakdown(enteredAmountCents, rules);
  return {
    mode: b.mode,
    enteredAmountCents,
    landlordNetCents: b.landlordNetCents,
    platformFeeCents: b.platformFeeCents,
    tenantTotalCents: b.tenantTotalCents,
    feeDeductedFromOwner: b.mode === RentalPricingMode.TOTAL_MINUS_FEE,
  };
}
