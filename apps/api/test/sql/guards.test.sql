-- Database guard tests. Run with: pnpm test:sql (scripts/test-sql.sh)
-- Each block attempts an invalid operation and asserts the database rejects it.
\set ON_ERROR_STOP 1
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(stmt text, pattern text, label text) RETURNS void AS $$
DECLARE
  failed boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN others THEN
    failed := true;
    IF SQLERRM !~* pattern THEN
      RAISE EXCEPTION 'FAIL %: wrong error "%" (expected /%/)', label, SQLERRM, pattern;
    END IF;
  END;
  IF NOT failed THEN
    RAISE EXCEPTION 'FAIL %: statement succeeded but should have been rejected', label;
  END IF;
  RAISE NOTICE 'ok - %', label;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.ok(label text) RETURNS void AS $$
BEGIN RAISE NOTICE 'ok - %', label; END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO "User" ("id","email","passwordHash","fullName","roles","updatedAt") VALUES
  ('u_owner','owner@test','x','Owner','{CUSTOMER,OWNER}',now()),
  ('u_tenant','tenant@test','x','Tenant','{CUSTOMER}',now()),
  ('u_emp','emp@test','x','Employee','{EMPLOYEE}',now()),
  ('u_emp2','emp2@test','x','Employee 2','{EMPLOYEE}',now()),
  ('u_admin','admin@test','x','Admin','{ADMIN}',now());

SELECT pg_temp.expect_error($q$
  INSERT INTO "Property" ("id","ownerId","status","updatedAt") VALUES ('px','u_owner','PUBLISHED',now())
$q$, 'Property_published_requires_approval', 'a listing cannot be PUBLISHED without an approval record');

INSERT INTO "Property" ("id","ownerId","assignedEmployeeId","status","listingType","propertyType","priceCents","approvedAt","publishedAt","updatedAt")
VALUES ('p1','u_owner','u_emp','PUBLISHED','RENT','APARTMENT',50000, now(), now(), now()),
       ('p2','u_owner','u_emp','PUBLISHED','SALE','APARTMENT',10000000, now(), now(), now());

INSERT INTO "RentalAgreement" ("id","propertyId","landlordId","tenantId","assignedEmployeeId","status","startDate","endDate","dueDay",
  "pricingMode","enteredAmountCents","landlordNetCents","platformFeeCents","tenantTotalCents","settingsVersion","termsVersion","termsSnapshot","createdById","updatedAt")
VALUES ('ag1','p1','u_owner','u_tenant','u_emp','DRAFT','2026-01-01','2026-12-31',1,'NET_PLUS_FEE',50000,50000,5000,55000,1,'v1','{}','u_admin',now());

-- ---------------------------------------------------------------------------
-- Agreements
-- ---------------------------------------------------------------------------
SELECT pg_temp.expect_error($q$
  INSERT INTO "RentalAgreement" ("id","propertyId","landlordId","tenantId","assignedEmployeeId","startDate","endDate","dueDay",
    "pricingMode","enteredAmountCents","landlordNetCents","platformFeeCents","tenantTotalCents","settingsVersion","termsVersion","termsSnapshot","createdById","updatedAt")
  VALUES ('agx','p1','u_owner','u_tenant','u_emp','2026-01-01','2026-12-31',1,'NET_PLUS_FEE',50000,50000,5000,50000,1,'v1','{}','u_admin',now())
$q$, 'terms_consistent', 'agreement: landlord net + fee must equal tenant total (no hidden charges)');

SELECT pg_temp.expect_error($q$
  UPDATE "RentalAgreement" SET "status"='ACTIVE', "activeKey"='p1' WHERE id='ag1'
$q$, 'active_requires_acceptance', 'agreement cannot become ACTIVE without both parties'' recorded acceptance');

UPDATE "RentalAgreement" SET "landlordAcceptedAt"=now(), "landlordAcceptanceChannel"='mobile',
  "tenantAcceptedAt"=now(), "tenantAcceptanceChannel"='mobile', "status"='ACTIVE', "activeKey"='p1' WHERE id='ag1';
SELECT pg_temp.ok('agreement activates once both acceptances are recorded');

SELECT pg_temp.expect_error($q$
  UPDATE "RentalAgreement" SET "platformFeeCents"=7500, "tenantTotalCents"=57500 WHERE id='ag1'
$q$, 'AGREEMENT_TERMS_FROZEN', 'active agreement fees cannot be changed silently (settings changes never reach it)');

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentalAgreement" ("id","propertyId","landlordId","tenantId","assignedEmployeeId","status","activeKey","startDate","endDate","dueDay",
    "pricingMode","enteredAmountCents","landlordNetCents","platformFeeCents","tenantTotalCents","settingsVersion","termsVersion","termsSnapshot","createdById",
    "landlordAcceptedAt","tenantAcceptedAt","updatedAt")
  VALUES ('ag2','p1','u_owner','u_tenant','u_emp','ACTIVE','p1','2026-01-01','2026-12-31',1,'NET_PLUS_FEE',50000,50000,5000,55000,1,'v1','{}','u_admin',now(),now(),now())
$q$, 'activeKey_key', 'only one ACTIVE agreement per property');

-- ---------------------------------------------------------------------------
-- Obligations: duplicates, deletion, silent edits
-- ---------------------------------------------------------------------------
INSERT INTO "RentObligation" ("id","agreementId","periodIndex","periodStart","periodEnd","dueDate","landlordShareCents","feeShareCents","totalCents")
VALUES ('ob1','ag1',0,'2026-01-01','2026-01-31','2026-01-01',50000,5000,55000),
       ('ob2','ag1',1,'2026-02-01','2026-02-28','2026-02-01',50000,5000,55000);

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentObligation" ("id","agreementId","periodIndex","periodStart","periodEnd","dueDate","landlordShareCents","feeShareCents","totalCents")
  VALUES ('ob1dup','ag1',0,'2026-01-01','2026-01-31','2026-01-01',50000,5000,55000)
$q$, 'agreementId_periodIndex_key', 'duplicate monthly obligation for the same period is impossible');

-- Idempotent generation pattern used by the API:
INSERT INTO "RentObligation" ("id","agreementId","periodIndex","periodStart","periodEnd","dueDate","landlordShareCents","feeShareCents","totalCents")
VALUES ('ob1again','ag1',0,'2026-01-01','2026-01-31','2026-01-01',50000,5000,55000) ON CONFLICT ("agreementId","periodIndex") DO NOTHING;
DO $$ BEGIN
  IF (SELECT count(*) FROM "RentObligation" WHERE "agreementId"='ag1') <> 2 THEN RAISE EXCEPTION 'FAIL: rerun created duplicates'; END IF;
END $$;
SELECT pg_temp.ok('re-running generation (ON CONFLICT DO NOTHING) leaves exactly one row per period');

SELECT pg_temp.expect_error($q$ DELETE FROM "RentObligation" WHERE id='ob2' $q$, 'APPEND_ONLY', 'obligations cannot be deleted');
SELECT pg_temp.expect_error($q$ UPDATE "RentObligation" SET "landlordShareCents"=45000, "totalCents"=50000 WHERE id='ob2' $q$,
  'OBLIGATION_ADJUSTMENT_REQUIRES_RECORD', 'obligation amounts cannot be changed without a recorded adjustment');
SELECT pg_temp.expect_error($q$ UPDATE "RentObligation" SET "dueDate"='2026-02-05' WHERE id='ob2' $q$,
  'OBLIGATION_IDENTITY_IMMUTABLE', 'obligation period and due date are immutable');

-- ---------------------------------------------------------------------------
-- Rent ledger: partial payments, overpayment, reversal, append-only
-- ---------------------------------------------------------------------------
INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey")
VALUES ('le1','ob1','PAYMENT',30000,0,30000,'CASH','2026-01-02','u_emp','k1');
SELECT pg_temp.ok('partial payment recorded');

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey")
  VALUES ('le_dup','ob1','PAYMENT',1000,0,1000,'CASH','2026-01-02','u_emp','k1')
$q$, 'idempotencyKey_key', 'the same payment cannot be recorded twice (idempotency key)');

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey")
  VALUES ('le_over','ob1','PAYMENT',25000,5000,30000,'CASH','2026-01-03','u_emp','k_over')
$q$, 'PAYMENT_EXCEEDS_BALANCE', 'payments cannot exceed the obligation''s landlord share');

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey")
  VALUES ('le_bad','ob1','PAYMENT',20000,5000,26000,'CASH','2026-01-03','u_emp','k_bad')
$q$, 'amount_is_sum', 'entry amount must equal landlord + fee allocation');

INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey")
VALUES ('le2','ob1','PAYMENT',20000,5000,25000,'BANK_TRANSFER','2026-01-05','u_emp','k2');
SELECT pg_temp.ok('second payment completes the obligation');

SELECT pg_temp.expect_error($q$ UPDATE "RentLedgerEntry" SET "amountCents"=1 WHERE id='le1' $q$, 'APPEND_ONLY', 'ledger entries cannot be edited');
SELECT pg_temp.expect_error($q$ DELETE FROM "RentLedgerEntry" WHERE id='le1' $q$, 'APPEND_ONLY', 'ledger entries cannot be deleted');

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey","reversesEntryId","reason")
  VALUES ('rv_bad','ob1','REVERSAL',-10000,0,-10000,'CASH','2026-01-06','u_admin','k_rv_bad','le2','partial')
$q$, 'REVERSAL_MISMATCH', 'a reversal must exactly negate the original payment');

-- ---------------------------------------------------------------------------
-- Owner payouts
-- ---------------------------------------------------------------------------
INSERT INTO "OwnerPayout" ("id","ownerId","kind","totalCents","method","paidOn","reference","recordedById","idempotencyKey")
VALUES ('po1','u_owner','PAYOUT',50000,'BANK_TRANSFER','2026-01-10','TRX-001','u_admin','pk1');
INSERT INTO "OwnerPayoutLine" ("id","payoutId","obligationId","amountCents") VALUES ('pl1','po1','ob1',50000);
SELECT pg_temp.ok('owner payout equal to collected landlord share');

SELECT pg_temp.expect_error($q$
  INSERT INTO "OwnerPayout" ("id","ownerId","kind","totalCents","method","paidOn","reference","recordedById","idempotencyKey")
  VALUES ('po2','u_owner','PAYOUT',1,'CASH','2026-01-11','TRX-002','u_admin','pk2');
  INSERT INTO "OwnerPayoutLine" ("id","payoutId","obligationId","amountCents") VALUES ('pl2','po2','ob1',1);
$q$, 'PAYOUT_EXCEEDS_COLLECTED', 'cannot pay an owner more than was collected for them');

SELECT pg_temp.expect_error($q$
  INSERT INTO "OwnerPayout" ("id","ownerId","kind","totalCents","method","paidOn","reference","recordedById","idempotencyKey")
  VALUES ('po3','u_owner','PAYOUT',100,'CASH','2026-01-11','TRX-003','u_admin','pk3');
  INSERT INTO "OwnerPayoutLine" ("id","payoutId","obligationId","amountCents") VALUES ('pl3','po3','ob2',100);
$q$, 'PAYOUT_EXCEEDS_COLLECTED', 'tenant has not paid → owner payout is not possible (and never automatic)');

SELECT pg_temp.expect_error($q$
  INSERT INTO "OwnerPayout" ("id","ownerId","kind","totalCents","method","paidOn","reference","recordedById","idempotencyKey")
  VALUES ('po4','u_owner','PAYOUT',100,'CASH','2026-01-11','  ','u_admin','pk4')
$q$, 'reference_required', 'payouts require a reference');

SELECT pg_temp.expect_error($q$ DELETE FROM "OwnerPayout" WHERE id='po1' $q$, 'APPEND_ONLY', 'payouts cannot be deleted');

-- Reversal of a tenant payment after the owner was paid is allowed (history kept),
-- and shows up as owner debt in the application layer.
INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey","reversesEntryId","reason")
VALUES ('rv2','ob1','REVERSAL',-20000,-5000,-25000,'BANK_TRANSFER','2026-01-12','u_admin','k_rv2','le2','Bank transfer bounced');
SELECT pg_temp.ok('reversal of a bounced payment recorded as a new entry');

SELECT pg_temp.expect_error($q$
  INSERT INTO "RentLedgerEntry" ("id","obligationId","kind","landlordCents","feeCents","amountCents","method","receivedOn","recordedById","idempotencyKey","reversesEntryId","reason")
  VALUES ('rv3','ob1','REVERSAL',-20000,-5000,-25000,'BANK_TRANSFER','2026-01-12','u_admin','k_rv3','le2','again')
$q$, 'ALREADY_REVERSED', 'a payment can only be reversed once');

DO $$ DECLARE l BIGINT; f BIGINT; n INT; BEGIN
  SELECT sum("landlordCents"), sum("feeCents"), count(*) INTO l, f, n FROM "RentLedgerEntry" WHERE "obligationId"='ob1';
  IF l <> 30000 OR f <> 0 OR n <> 3 THEN RAISE EXCEPTION 'FAIL: unexpected balance % % %', l, f, n; END IF;
END $$;
SELECT pg_temp.ok('balances after reversal: landlord 300.00 collected, fee 0, 3 entries kept');

-- ---------------------------------------------------------------------------
-- Pricing settings history & audit log are append-only
-- ---------------------------------------------------------------------------
INSERT INTO "PricingSettings" ("id","version","saleBuyerBps","saleSellerBps","rentalMonthlyFeeCents","rentalPricingMode","termsVersion","changeReason")
VALUES ('ps1',1,250,250,5000,'NET_PLUS_FEE','v1','initial');
SELECT pg_temp.expect_error($q$ UPDATE "PricingSettings" SET "rentalMonthlyFeeCents"=7500 WHERE id='ps1' $q$, 'APPEND_ONLY', 'past pricing settings cannot be rewritten');
SELECT pg_temp.expect_error($q$
  INSERT INTO "PricingSettings" ("id","version","saleBuyerBps","saleSellerBps","rentalMonthlyFeeCents","rentalPricingMode","termsVersion","changeReason")
  VALUES ('ps2',2,10001,250,5000,'NET_PLUS_FEE','v2','bad')
$q$, 'bps_range', 'commission rates are bounded 0–100%');

INSERT INTO "AuditLog" ("id","actorId","action","entityType","entityId") VALUES ('al1','u_admin','test','User','u_owner');
SELECT pg_temp.expect_error($q$ DELETE FROM "AuditLog" WHERE id='al1' $q$, 'APPEND_ONLY', 'audit log cannot be deleted');

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
INSERT INTO "SaleClosing" ("id","propertyId","sellerId","buyerId","status","approvedKey","finalPriceCents","closingDate","sellerBps","buyerBps",
  "sellerCommissionCents","buyerCommissionCents","termsSnapshot","settingsVersion","termsVersion","buyerAcceptedAt","buyerAcceptanceChannel",
  "sellerAcceptedAt","sellerAcceptanceChannel","requestedById","approvedById","approvedAt","updatedAt")
VALUES ('sc1','p2','u_owner','u_tenant','APPROVED','p2',10000000,'2026-03-01',250,250,250000,250000,'{}',1,'v1',now(),'mobile',now(),'mobile','u_emp','u_admin',now(),now());
INSERT INTO "SaleObligation" ("id","closingId","party","amountDueCents") VALUES ('so_b','sc1','BUYER',250000),('so_s','sc1','SELLER',250000);

SELECT pg_temp.expect_error($q$ UPDATE "SaleClosing" SET "buyerCommissionCents"=200000 WHERE id='sc1' $q$, 'CLOSING_TERMS_FROZEN', 'approved closing commissions are frozen');
SELECT pg_temp.expect_error($q$
  INSERT INTO "SaleClosing" ("id","propertyId","sellerId","buyerId","status","approvedKey","finalPriceCents","closingDate","sellerBps","buyerBps",
    "sellerCommissionCents","buyerCommissionCents","termsSnapshot","settingsVersion","termsVersion","buyerAcceptedAt","buyerAcceptanceChannel",
    "sellerAcceptedAt","sellerAcceptanceChannel","requestedById","updatedAt")
  VALUES ('sc2','p2','u_owner','u_tenant','APPROVED','p2',9000000,'2026-03-02',250,250,225000,225000,'{}',1,'v1',now(),'mobile',now(),'mobile','u_emp',now())
$q$, 'approvedKey_key', 'a property cannot have two approved sale closings');

INSERT INTO "SaleLedgerEntry" ("id","obligationId","kind","amountCents","method","receivedOn","recordedById","idempotencyKey")
VALUES ('se1','so_b','PAYMENT',100000,'CASH','2026-03-02','u_admin','sk1');
SELECT pg_temp.expect_error($q$
  INSERT INTO "SaleLedgerEntry" ("id","obligationId","kind","amountCents","method","receivedOn","recordedById","idempotencyKey")
  VALUES ('se2','so_b','PAYMENT',150001,'CASH','2026-03-02','u_admin','sk2')
$q$, 'PAYMENT_EXCEEDS_BALANCE', 'buyer commission payments cannot exceed the buyer obligation');
SELECT pg_temp.expect_error($q$
  INSERT INTO "SaleLedgerEntry" ("id","obligationId","kind","amountCents","method","receivedOn","recordedById","idempotencyKey")
  VALUES ('se3','so_s','REFUND',-1,'CASH','2026-03-02','u_admin','sk3')
$q$, 'LEDGER_NEGATIVE_BALANCE', 'cannot refund more than was collected');

-- ---------------------------------------------------------------------------
-- Leads & viewings
-- ---------------------------------------------------------------------------
INSERT INTO "Lead" ("id","propertyId","customerId","assignedEmployeeId","status","source","openKey","updatedAt")
VALUES ('l1','p1','u_tenant','u_emp','ASSIGNED','VIEWING_REQUEST','p1:u_tenant',now());
SELECT pg_temp.expect_error($q$
  INSERT INTO "Lead" ("id","propertyId","customerId","status","source","openKey","updatedAt")
  VALUES ('l2','p1','u_tenant','NEW','MESSAGE','p1:u_tenant',now())
$q$, 'openKey_key', 'one open lead per customer and property (no conflicting duplicates)');
SELECT pg_temp.expect_error($q$ UPDATE "Lead" SET "status"='LOST', "openKey"=NULL WHERE id='l1' $q$, 'lost_requires_reason', 'lost leads require a reason');

INSERT INTO "ViewingRequest" ("id","propertyId","customerId","assignedEmployeeId","status","preferredSlots","scheduledAt","scheduledEndsAt",
  "disclosedKind","disclosedAmountCents","termsVersion","settingsVersion","acceptedAt","idempotencyKey","updatedAt")
VALUES ('v1','p1','u_tenant','u_emp','CONFIRMED','[]','2026-10-20 07:00','2026-10-20 07:45','RENT',55000,'v1',1,now(),'vk1',now());
SELECT pg_temp.expect_error($q$
  INSERT INTO "ViewingRequest" ("id","propertyId","customerId","assignedEmployeeId","status","preferredSlots","scheduledAt","scheduledEndsAt",
    "disclosedKind","disclosedAmountCents","termsVersion","settingsVersion","acceptedAt","idempotencyKey","updatedAt")
  VALUES ('v2','p2','u_owner','u_emp','CONFIRMED','[]','2026-10-20 07:30','2026-10-20 08:15','SALE',250000,'v1',1,now(),'vk2',now())
$q$, 'no_double_booking', 'an employee cannot have overlapping confirmed viewings');
INSERT INTO "ViewingRequest" ("id","propertyId","customerId","assignedEmployeeId","status","preferredSlots","scheduledAt","scheduledEndsAt",
  "disclosedKind","disclosedAmountCents","termsVersion","settingsVersion","acceptedAt","idempotencyKey","updatedAt")
VALUES ('v3','p2','u_owner','u_emp2','CONFIRMED','[]','2026-10-20 07:30','2026-10-20 08:15','SALE',250000,'v1',1,now(),'vk3',now());
SELECT pg_temp.ok('a different employee can take the same time slot');

\echo 'ALL SQL GUARD TESTS PASSED'
