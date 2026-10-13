import { computeSaleBreakdown, SaleFeeRules } from './commission';
import { DomainError } from './errors';
import { assertBasisPoints, assertCents, Cents } from './money';
import { computeRentalBreakdown, RentalFeeRules, RentalPricingMode } from './rental';

/**
 * Global pricing settings. Changes apply ONLY to new transactions: every
 * request, closing and agreement stores a frozen snapshot of the rules,
 * computed amounts, terms version and acceptance record.
 */
export interface PricingSettings {
  version: number;
  sale: SaleFeeRules;
  rental: RentalFeeRules;
  termsVersion: string;
}

export function validatePricingSettings(s: Omit<PricingSettings, 'version'>) {
  assertBasisPoints(s.sale.buyerBps, 'buyerBps');
  assertBasisPoints(s.sale.sellerBps, 'sellerBps');
  assertCents(s.rental.monthlyFeeCents, 'monthlyFee');
  if (!Object.values(RentalPricingMode).includes(s.rental.mode)) throw new DomainError('RENT_MODE_UNKNOWN');
  if (!s.termsVersion || s.termsVersion.length > 40) throw new DomainError('TERMS_VERSION_INVALID');
}

export interface Acceptance {
  userId: string;
  acceptedAt: string; // ISO timestamp
  termsVersion: string;
  /** Exact amounts the person saw when they accepted. */
  disclosedAmounts: Record<string, Cents>;
  channel: 'mobile' | 'admin' | 'in_person_recorded_by_staff';
}

export interface SaleTermsSnapshot {
  kind: 'SALE';
  settingsVersion: number;
  termsVersion: string;
  rules: SaleFeeRules;
  priceCents: Cents;
  sellerCommissionCents: Cents;
  buyerCommissionCents: Cents;
  overrideApprovedBy?: string;
  overrideReason?: string;
}

export interface RentalTermsSnapshot {
  kind: 'RENTAL';
  settingsVersion: number;
  termsVersion: string;
  mode: RentalPricingMode;
  enteredAmountCents: Cents;
  landlordNetCents: Cents;
  platformFeeCents: Cents;
  tenantTotalCents: Cents;
  overrideApprovedBy?: string;
  overrideReason?: string;
}

export interface FeeOverride {
  approvedByAdminId: string;
  reason: string;
}

export function snapshotSaleTerms(
  settings: PricingSettings,
  priceCents: Cents,
  override?: { rules: SaleFeeRules } & FeeOverride,
): SaleTermsSnapshot {
  if (override && override.reason.trim().length < 3) throw new DomainError('OVERRIDE_REASON_REQUIRED');
  const rules = override?.rules ?? settings.sale;
  const b = computeSaleBreakdown(priceCents, rules);
  return deepFreeze({
    kind: 'SALE',
    settingsVersion: settings.version,
    termsVersion: settings.termsVersion,
    rules: { ...b.rules },
    priceCents: b.priceCents,
    sellerCommissionCents: b.sellerCommissionCents,
    buyerCommissionCents: b.buyerCommissionCents,
    ...(override ? { overrideApprovedBy: override.approvedByAdminId, overrideReason: override.reason } : {}),
  });
}

export function snapshotRentalTerms(
  settings: PricingSettings,
  enteredAmountCents: Cents,
  opts?: { mode?: RentalPricingMode; override?: { monthlyFeeCents: Cents } & FeeOverride },
): RentalTermsSnapshot {
  if (opts?.override && opts.override.reason.trim().length < 3) throw new DomainError('OVERRIDE_REASON_REQUIRED');
  const rules: RentalFeeRules = {
    mode: opts?.mode ?? settings.rental.mode,
    monthlyFeeCents: opts?.override?.monthlyFeeCents ?? settings.rental.monthlyFeeCents,
  };
  const b = computeRentalBreakdown(enteredAmountCents, rules);
  return deepFreeze({
    kind: 'RENTAL',
    settingsVersion: settings.version,
    termsVersion: settings.termsVersion,
    mode: b.mode,
    enteredAmountCents,
    landlordNetCents: b.landlordNetCents,
    platformFeeCents: b.platformFeeCents,
    tenantTotalCents: b.tenantTotalCents,
    ...(opts?.override
      ? { overrideApprovedBy: opts.override.approvedByAdminId, overrideReason: opts.override.reason }
      : {}),
  });
}

/** Builds an acceptance record. Fails if disclosed amounts are missing. */
export function recordAcceptance(input: Acceptance): Acceptance {
  if (!input.userId) throw new DomainError('ACCEPTANCE_USER_REQUIRED');
  if (!input.termsVersion) throw new DomainError('ACCEPTANCE_TERMS_REQUIRED');
  if (Object.keys(input.disclosedAmounts).length === 0) throw new DomainError('ACCEPTANCE_AMOUNTS_REQUIRED');
  return deepFreeze({ ...input, disclosedAmounts: { ...input.disclosedAmounts } });
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.values(obj as Record<string, unknown>).forEach((v) => deepFreeze(v));
    Object.freeze(obj);
  }
  return obj;
}
