-- Database-level guarantees that Prisma's schema language cannot express.
-- The application enforces the same rules; these guards make them hold even
-- for buggy code, manual SQL or concurrent requests. See docs/DATABASE.md.

-- ===========================================================================
-- 1. Value checks
-- ===========================================================================

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_price_positive" CHECK ("priceCents" IS NULL OR "priceCents" > 0),
  ADD CONSTRAINT "Property_counts_nonnegative" CHECK (
    ("bedrooms" IS NULL OR "bedrooms" >= 0) AND ("bathrooms" IS NULL OR "bathrooms" >= 0) AND
    ("sizeSqm" IS NULL OR "sizeSqm" > 0)),
  ADD CONSTRAINT "Property_published_requires_approval" CHECK (
    "status" <> 'PUBLISHED' OR ("approvedAt" IS NOT NULL AND "publishedAt" IS NOT NULL));

ALTER TABLE "PricingSettings"
  ADD CONSTRAINT "PricingSettings_bps_range" CHECK (
    "saleBuyerBps" BETWEEN 0 AND 10000 AND "saleSellerBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "PricingSettings_fee_nonnegative" CHECK ("rentalMonthlyFeeCents" >= 0);

ALTER TABLE "SaleClosing"
  ADD CONSTRAINT "SaleClosing_amounts_valid" CHECK (
    "finalPriceCents" > 0 AND "sellerCommissionCents" >= 0 AND "buyerCommissionCents" >= 0 AND
    "sellerBps" BETWEEN 0 AND 10000 AND "buyerBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "SaleClosing_approvedKey_matches_status" CHECK (
    ("status" = 'APPROVED' AND "approvedKey" = "propertyId") OR ("status" <> 'APPROVED' AND "approvedKey" IS NULL));

ALTER TABLE "SaleObligation"
  ADD CONSTRAINT "SaleObligation_amount_nonnegative" CHECK ("amountDueCents" >= 0);

ALTER TABLE "SaleLedgerEntry"
  ADD CONSTRAINT "SaleLedgerEntry_sign_matches_kind" CHECK (
    ("kind" = 'PAYMENT' AND "amountCents" > 0 AND "reversesEntryId" IS NULL) OR
    ("kind" = 'REFUND' AND "amountCents" < 0 AND "reversesEntryId" IS NULL) OR
    ("kind" = 'REVERSAL' AND "amountCents" < 0 AND "reversesEntryId" IS NOT NULL));

ALTER TABLE "RentalAgreement"
  ADD CONSTRAINT "RentalAgreement_terms_consistent" CHECK (
    "landlordNetCents" >= 0 AND "platformFeeCents" >= 0 AND
    "landlordNetCents" + "platformFeeCents" = "tenantTotalCents" AND "depositCents" >= 0),
  ADD CONSTRAINT "RentalAgreement_dates_valid" CHECK (
    "endDate" >= "startDate" AND "dueDay" BETWEEN 1 AND 31 AND
    ("terminationDate" IS NULL OR "terminationDate" >= "startDate")),
  ADD CONSTRAINT "RentalAgreement_parties_distinct" CHECK ("landlordId" <> "tenantId"),
  ADD CONSTRAINT "RentalAgreement_activeKey_matches_status" CHECK (
    ("status" = 'ACTIVE' AND "activeKey" = "propertyId") OR ("status" <> 'ACTIVE' AND "activeKey" IS NULL)),
  ADD CONSTRAINT "RentalAgreement_active_requires_acceptance" CHECK (
    "status" NOT IN ('ACTIVE', 'ENDED', 'TERMINATED') OR
    ("landlordAcceptedAt" IS NOT NULL AND "tenantAcceptedAt" IS NOT NULL));

ALTER TABLE "AgreementAmendment"
  ADD CONSTRAINT "AgreementAmendment_terms_consistent" CHECK (
    "landlordNetCents" >= 0 AND "platformFeeCents" >= 0 AND
    "landlordNetCents" + "platformFeeCents" = "tenantTotalCents");

ALTER TABLE "DepositEntry"
  ADD CONSTRAINT "DepositEntry_amount_positive" CHECK ("amountCents" > 0);

ALTER TABLE "RentObligation"
  ADD CONSTRAINT "RentObligation_amounts_consistent" CHECK (
    "landlordShareCents" >= 0 AND "feeShareCents" >= 0 AND
    "landlordShareCents" + "feeShareCents" = "totalCents"),
  ADD CONSTRAINT "RentObligation_period_valid" CHECK ("periodEnd" >= "periodStart" AND "periodIndex" >= 0);

ALTER TABLE "RentLedgerEntry"
  ADD CONSTRAINT "RentLedgerEntry_amount_is_sum" CHECK ("amountCents" = "landlordCents" + "feeCents"),
  ADD CONSTRAINT "RentLedgerEntry_sign_matches_kind" CHECK (
    ("kind" = 'PAYMENT' AND "landlordCents" >= 0 AND "feeCents" >= 0 AND "amountCents" > 0 AND "reversesEntryId" IS NULL) OR
    ("kind" = 'REFUND' AND "landlordCents" <= 0 AND "feeCents" <= 0 AND "amountCents" < 0 AND "reversesEntryId" IS NULL) OR
    ("kind" = 'REVERSAL' AND "landlordCents" <= 0 AND "feeCents" <= 0 AND "amountCents" < 0 AND "reversesEntryId" IS NOT NULL));

ALTER TABLE "OwnerPayout"
  ADD CONSTRAINT "OwnerPayout_sign_matches_kind" CHECK (
    ("kind" = 'PAYOUT' AND "totalCents" > 0 AND "reversesPayoutId" IS NULL) OR
    ("kind" = 'REVERSAL' AND "totalCents" < 0 AND "reversesPayoutId" IS NOT NULL)),
  ADD CONSTRAINT "OwnerPayout_reference_required" CHECK (length(trim("reference")) > 0);

ALTER TABLE "OwnerPayoutLine"
  ADD CONSTRAINT "OwnerPayoutLine_nonzero" CHECK ("amountCents" <> 0);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_openKey_matches_status" CHECK (
    ("status" IN ('WON', 'LOST') AND "openKey" IS NULL) OR
    ("status" NOT IN ('WON', 'LOST') AND "openKey" = "propertyId" || ':' || "customerId")),
  ADD CONSTRAINT "Lead_lost_requires_reason" CHECK ("status" <> 'LOST' OR length(trim(coalesce("lostReason", ''))) >= 3);

ALTER TABLE "PropertyRevision"
  ADD CONSTRAINT "PropertyRevision_pendingKey_matches_status" CHECK (
    ("status" = 'PENDING' AND "pendingKey" = "propertyId") OR ("status" <> 'PENDING' AND "pendingKey" IS NULL));

ALTER TABLE "ViewingRequest"
  ADD CONSTRAINT "ViewingRequest_schedule_valid" CHECK (
    ("scheduledAt" IS NULL AND "scheduledEndsAt" IS NULL) OR ("scheduledEndsAt" > "scheduledAt")),
  ADD CONSTRAINT "ViewingRequest_confirmed_has_schedule" CHECK (
    "status" <> 'CONFIRMED' OR ("scheduledAt" IS NOT NULL AND "assignedEmployeeId" IS NOT NULL));

-- ===========================================================================
-- 2. No double-booked employees (confirmed viewings may not overlap)
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ViewingRequest"
  ADD CONSTRAINT "ViewingRequest_no_double_booking" EXCLUDE USING gist (
    "assignedEmployeeId" WITH =,
    tsrange("scheduledAt", "scheduledEndsAt", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');

-- ===========================================================================
-- 3. Append-only financial history and audit trail
-- ===========================================================================

CREATE OR REPLACE FUNCTION dar_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % on "%" is not allowed; record a correcting entry instead', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentLedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "RentLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "SaleLedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "SaleLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "OwnerPayout_append_only" BEFORE UPDATE OR DELETE ON "OwnerPayout"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "OwnerPayoutLine_append_only" BEFORE UPDATE OR DELETE ON "OwnerPayoutLine"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "DepositEntry_append_only" BEFORE UPDATE OR DELETE ON "DepositEntry"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "AgreementAmendment_append_only" BEFORE UPDATE OR DELETE ON "AgreementAmendment"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "PricingSettings_append_only" BEFORE UPDATE OR DELETE ON "PricingSettings"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();
CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION dar_reject_mutation();

-- Obligations: never deleted; identity and schedule never change; amounts may
-- only change through an explicit, recorded adjustment (termination).
CREATE OR REPLACE FUNCTION dar_guard_rent_obligation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: obligations are voided, never deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."agreementId" <> OLD."agreementId" OR NEW."periodIndex" <> OLD."periodIndex"
     OR NEW."periodStart" <> OLD."periodStart" OR NEW."dueDate" <> OLD."dueDate" THEN
    RAISE EXCEPTION 'OBLIGATION_IDENTITY_IMMUTABLE' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (NEW."landlordShareCents" <> OLD."landlordShareCents" OR NEW."feeShareCents" <> OLD."feeShareCents")
     AND (NEW."originalLandlordShareCents" IS NULL OR NEW."adjustedReason" IS NULL) THEN
    RAISE EXCEPTION 'OBLIGATION_ADJUSTMENT_REQUIRES_RECORD' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."originalLandlordShareCents" IS NOT NULL
     AND NEW."originalLandlordShareCents" IS DISTINCT FROM OLD."originalLandlordShareCents" THEN
    RAISE EXCEPTION 'OBLIGATION_ORIGINAL_AMOUNT_IMMUTABLE' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentObligation_guard" BEFORE UPDATE OR DELETE ON "RentObligation"
  FOR EACH ROW EXECUTE FUNCTION dar_guard_rent_obligation();

-- Accepted agreement terms are frozen once the agreement leaves DRAFT.
-- Changes go through AgreementAmendment (recorded, with an effective date).
CREATE OR REPLACE FUNCTION dar_guard_agreement_terms() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'AGREEMENT_NOT_DELETABLE' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" <> 'DRAFT' AND (
       NEW."landlordNetCents" <> OLD."landlordNetCents" OR NEW."platformFeeCents" <> OLD."platformFeeCents"
    OR NEW."tenantTotalCents" <> OLD."tenantTotalCents" OR NEW."pricingMode" <> OLD."pricingMode"
    OR NEW."enteredAmountCents" <> OLD."enteredAmountCents" OR NEW."startDate" <> OLD."startDate"
    OR NEW."endDate" <> OLD."endDate" OR NEW."dueDay" <> OLD."dueDay" OR NEW."proration" <> OLD."proration"
    OR NEW."termsVersion" <> OLD."termsVersion" OR NEW."settingsVersion" <> OLD."settingsVersion"
    OR NEW."termsSnapshot" <> OLD."termsSnapshot" OR NEW."landlordId" <> OLD."landlordId"
    OR NEW."tenantId" <> OLD."tenantId" OR NEW."propertyId" <> OLD."propertyId"
    OR NEW."depositCents" <> OLD."depositCents") THEN
    RAISE EXCEPTION 'AGREEMENT_TERMS_FROZEN: use a recorded amendment' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentalAgreement_terms_guard" BEFORE UPDATE OR DELETE ON "RentalAgreement"
  FOR EACH ROW EXECUTE FUNCTION dar_guard_agreement_terms();

-- Approved sale closings: price and commissions are frozen.
CREATE OR REPLACE FUNCTION dar_guard_sale_closing() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: closings are cancelled, never deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" = 'APPROVED' AND (
       NEW."finalPriceCents" <> OLD."finalPriceCents" OR NEW."sellerCommissionCents" <> OLD."sellerCommissionCents"
    OR NEW."buyerCommissionCents" <> OLD."buyerCommissionCents" OR NEW."sellerBps" <> OLD."sellerBps"
    OR NEW."buyerBps" <> OLD."buyerBps" OR NEW."termsSnapshot" <> OLD."termsSnapshot") THEN
    RAISE EXCEPTION 'CLOSING_TERMS_FROZEN' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SaleClosing_guard" BEFORE UPDATE OR DELETE ON "SaleClosing"
  FOR EACH ROW EXECUTE FUNCTION dar_guard_sale_closing();

-- ===========================================================================
-- 4. Balance guards (serialized per obligation with a row lock)
-- ===========================================================================

-- Rent ledger: collected amounts per share stay within [0, share]; reversals
-- must negate exactly one PAYMENT on the same obligation.
CREATE OR REPLACE FUNCTION dar_guard_rent_ledger_insert() RETURNS trigger AS $$
DECLARE
  ob RECORD;
  landlord_sum BIGINT;
  fee_sum BIGINT;
  target RECORD;
BEGIN
  SELECT * INTO ob FROM "RentObligation" WHERE "id" = NEW."obligationId" FOR UPDATE;
  IF NEW."kind" = 'PAYMENT' AND (ob."voidedAt" IS NOT NULL OR ob."waivedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'OBLIGATION_CLOSED: cannot record a payment on a void or waived obligation' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."kind" = 'REVERSAL' THEN
    SELECT * INTO target FROM "RentLedgerEntry" WHERE "id" = NEW."reversesEntryId";
    IF target IS NULL OR target."kind" <> 'PAYMENT' OR target."obligationId" <> NEW."obligationId"
       OR NEW."landlordCents" <> -target."landlordCents" OR NEW."feeCents" <> -target."feeCents" THEN
      RAISE EXCEPTION 'REVERSAL_MISMATCH: a reversal must exactly negate one payment on the same obligation' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM "RentLedgerEntry" WHERE "reversesEntryId" = NEW."reversesEntryId") THEN
      RAISE EXCEPTION 'ALREADY_REVERSED: this payment has already been reversed' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  SELECT coalesce(sum("landlordCents"), 0), coalesce(sum("feeCents"), 0) INTO landlord_sum, fee_sum
    FROM "RentLedgerEntry" WHERE "obligationId" = NEW."obligationId";
  landlord_sum := landlord_sum + NEW."landlordCents";
  fee_sum := fee_sum + NEW."feeCents";
  IF landlord_sum < 0 OR fee_sum < 0 THEN
    RAISE EXCEPTION 'LEDGER_NEGATIVE_BALANCE' USING ERRCODE = 'check_violation';
  END IF;
  IF landlord_sum > ob."landlordShareCents" OR fee_sum > ob."feeShareCents" THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentLedgerEntry_balance_guard" BEFORE INSERT ON "RentLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION dar_guard_rent_ledger_insert();

-- Owner payouts: cumulative payouts per obligation never exceed the landlord
-- share actually collected (net), and never go below zero.
CREATE OR REPLACE FUNCTION dar_guard_payout_line_insert() RETURNS trigger AS $$
DECLARE
  collected BIGINT;
  paid BIGINT;
  payout_kind "PayoutKind";
BEGIN
  PERFORM 1 FROM "RentObligation" WHERE "id" = NEW."obligationId" FOR UPDATE;
  SELECT "kind" INTO payout_kind FROM "OwnerPayout" WHERE "id" = NEW."payoutId";
  IF (payout_kind = 'PAYOUT' AND NEW."amountCents" <= 0) OR (payout_kind = 'REVERSAL' AND NEW."amountCents" >= 0) THEN
    RAISE EXCEPTION 'PAYOUT_LINE_SIGN' USING ERRCODE = 'check_violation';
  END IF;
  SELECT coalesce(sum("landlordCents"), 0) INTO collected FROM "RentLedgerEntry" WHERE "obligationId" = NEW."obligationId";
  SELECT coalesce(sum("amountCents"), 0) INTO paid FROM "OwnerPayoutLine" WHERE "obligationId" = NEW."obligationId";
  paid := paid + NEW."amountCents";
  IF paid < 0 THEN
    RAISE EXCEPTION 'PAYOUT_NEGATIVE' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."amountCents" > 0 AND paid > collected THEN
    RAISE EXCEPTION 'PAYOUT_EXCEEDS_COLLECTED: owner payouts cannot exceed rent actually collected for the owner' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OwnerPayoutLine_balance_guard" BEFORE INSERT ON "OwnerPayoutLine"
  FOR EACH ROW EXECUTE FUNCTION dar_guard_payout_line_insert();

-- Payout header total must equal the sum of its lines (checked at commit).
CREATE OR REPLACE FUNCTION dar_check_payout_total() RETURNS trigger AS $$
DECLARE
  lines_sum BIGINT;
  header_total BIGINT;
BEGIN
  SELECT "totalCents" INTO header_total FROM "OwnerPayout" WHERE "id" = NEW."payoutId";
  SELECT coalesce(sum("amountCents"), 0) INTO lines_sum FROM "OwnerPayoutLine" WHERE "payoutId" = NEW."payoutId";
  IF lines_sum <> header_total THEN
    RAISE EXCEPTION 'PAYOUT_TOTAL_MISMATCH' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "OwnerPayoutLine_total_check" AFTER INSERT ON "OwnerPayoutLine"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dar_check_payout_total();

-- Sale ledger: net collected stays within [0, amount due]; reversal negates one payment.
CREATE OR REPLACE FUNCTION dar_guard_sale_ledger_insert() RETURNS trigger AS $$
DECLARE
  ob RECORD;
  total BIGINT;
  target RECORD;
BEGIN
  SELECT * INTO ob FROM "SaleObligation" WHERE "id" = NEW."obligationId" FOR UPDATE;
  IF NEW."kind" = 'PAYMENT' AND ob."waivedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'OBLIGATION_WAIVED' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."kind" = 'REVERSAL' THEN
    SELECT * INTO target FROM "SaleLedgerEntry" WHERE "id" = NEW."reversesEntryId";
    IF target IS NULL OR target."kind" <> 'PAYMENT' OR target."obligationId" <> NEW."obligationId"
       OR NEW."amountCents" <> -target."amountCents" THEN
      RAISE EXCEPTION 'REVERSAL_MISMATCH' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM "SaleLedgerEntry" WHERE "reversesEntryId" = NEW."reversesEntryId") THEN
      RAISE EXCEPTION 'ALREADY_REVERSED: this payment has already been reversed' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  SELECT coalesce(sum("amountCents"), 0) + NEW."amountCents" INTO total FROM "SaleLedgerEntry" WHERE "obligationId" = NEW."obligationId";
  IF total < 0 THEN
    RAISE EXCEPTION 'LEDGER_NEGATIVE_BALANCE' USING ERRCODE = 'check_violation';
  END IF;
  IF total > ob."amountDueCents" THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SaleLedgerEntry_balance_guard" BEFORE INSERT ON "SaleLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION dar_guard_sale_ledger_insert();
