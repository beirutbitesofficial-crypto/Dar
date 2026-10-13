# Database

PostgreSQL 16 (14+ works; needs the trusted `btree_gist` extension). Schema: `apps/api/prisma/schema.prisma`.

Migrations:

1. `20261013000000_init` — tables, enums, indexes, foreign keys (Prisma conventions).
2. `20261013000100_financial_guards` — rules Prisma can't express. Prisma ignores these objects and will not drop them.

## Guarantees enforced by the database

| Guarantee | Mechanism |
|---|---|
| Ledgers, payouts, deposits, amendments, pricing history and audit log are append-only | `BEFORE UPDATE OR DELETE` triggers → `APPEND_ONLY` |
| Obligations are never deleted; period/due date immutable; amount changes only with a recorded adjustment | trigger `RentObligation_guard` |
| Active/ended lease terms cannot change | trigger `RentalAgreement_terms_guard` |
| Approved sale price/commissions cannot change | trigger `SaleClosing_guard` |
| No duplicate monthly obligations | `UNIQUE(agreementId, periodIndex)` |
| Payments cannot exceed the landlord share or fee share; refunds can't go below zero | trigger with row lock `RentLedgerEntry_balance_guard` |
| A reversal exactly negates one payment on the same obligation, once | trigger + `UNIQUE(reversesEntryId)` |
| Owner payouts ≤ rent actually collected for that owner, per obligation | trigger `OwnerPayoutLine_balance_guard` |
| Payout header equals the sum of its lines | deferred constraint trigger |
| Same request recorded twice is impossible | `UNIQUE(idempotencyKey)` on all money tables and viewing requests |
| Landlord net + fee = tenant total (agreements, amendments, obligations) | CHECK constraints |
| Lease active only with both acceptances; one active lease per property | CHECK + `UNIQUE(activeKey)` |
| One approved sale per property | `UNIQUE(approvedKey)` + CHECK |
| One open lead per customer & property; LOST needs a reason | `UNIQUE(openKey)` + CHECKs |
| An employee can't have overlapping confirmed viewings | `EXCLUDE USING gist` on `tsrange` |
| A listing can't be PUBLISHED without an approval timestamp | CHECK |

Tests for every row above: `apps/api/test/sql/guards.test.sql` (`pnpm test:sql`).

## Money columns

All `*Cents` columns are `BIGINT` integer US cents. Signed ledger rows: PAYMENT positive; REVERSAL and REFUND negative. `RentLedgerEntry.landlordCents + feeCents = amountCents`.

## Reference numbers

`refNo` serials are displayed with a +1000 offset: listings `DAR-1001`, leases `LEASE-1001`, sales `SALE-1001`, payouts `PAY-1001`, receipts `R-1`.
