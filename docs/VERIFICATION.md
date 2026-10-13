# Verification status

**Date:** 2026-10-13 · **Environment:** Linux, Node 22.22, PostgreSQL 16, TypeScript 6.0 (local tool), **no npm registry access** (blocked by the build environment's network policy).

Because packages could not be installed, verification was split into what could genuinely be executed and what could not. Nothing below is reported as passing unless it actually ran.

## ✅ Executed and passing

| Check | Result | How |
|---|---|---|
| Shared domain — strict TypeScript (`strict`, `noUncheckedIndexedAccess`) | **0 errors** | `tsc` on `packages/shared/src/{domain,i18n,brand,legal,api-types}` |
| Shared domain tests | **53 / 53 pass** | `tsx --test packages/shared/test/*.test.ts` |
| API unit tests (upload type sniffing, CSV export safety) | **3 / 3 pass** | `tsx --test apps/api/test/unit/*.test.ts` |
| Both migrations applied to a real PostgreSQL 16 | **38 tables, 15 triggers, 31 check/exclusion constraints** | `psql -f` each `migration.sql` |
| Database guard tests | **38 / 38 pass** | `bash scripts/test-sql.sh` |
| Raw SQL used by the dashboard and payout queue | **valid, numbers verified** against test data | run by hand in `psql` |
| Arabic ↔ English dictionaries have identical keys | **enforced by the type system** | `en: Dictionary` typed from `ar` |
| Beirut local-time conversion used by admin forms (DST) | **correct** for UTC+3 (Oct) and UTC+2 (Dec) | executed |
| Syntax of every `.ts`/`.tsx` file (153 files) | **0 errors** | TypeScript `transpileModule` |
| API / admin / mobile against the shared types | **0 real errors** | `tsc` with framework packages stubbed as `any` (catches misuse of shared types/functions; does **not** validate Nest/Prisma/Next/Expo APIs) |

What the tests cover (mapped to the specification):

- Sale commission calculations — exact $100,000 example, final-price basis, asymmetric rates, half-up cent rounding with BigInt, input parsing incl. Arabic digits.
- Rental fee calculations in **both** pricing modes; $50 never silently deducted in the default mode.
- **Existing agreements retain accepted fees after settings change** — domain test (frozen snapshot) **and** database test (trigger rejects editing an active lease's fee).
- Partial payments (landlord share first, then fee), overpayment rejection, idempotent recording, reversals (exact negation, once only), refunds (fee first), **owner payout balances incl. owner debt after a bounced payment**, and DB refusal to pay an owner more than was collected.
- **Duplicate prevention for monthly obligations** — planner idempotency + `UNIQUE(agreementId, periodIndex)` + `ON CONFLICT DO NOTHING` re-run test.
- Month-end anchoring (Jan 31 → Feb 28 → Mar 31), leap years, due-day rules, explicit DAILY proration, amendments, early termination (void/adjust/refund-review flags), renewals.
- **Access boundaries** across owner, customer, employee (assigned/unassigned, with/without collection permission), admin, blocked accounts, visitors.
- **Public payloads exclude private contact information** — allowlist serializer test with a full DB-shaped row containing private columns; recursive forbidden-key guard.
- **Listing approval before public visibility** — every non-published status invisible; DB check forbids `PUBLISHED` without an approval timestamp.
- **Request and agreement status transitions** — listing, lead, viewing and agreement state machines incl. required reasons; DB checks tying `openKey`/`activeKey`/`approvedKey`/`pendingKey` to status; exclusion constraint against double-booked employees.
- Contact detection in Lebanese Arabic/English (Arabic-Indic digits, separators, spelled digits, WhatsApp/social, emails) with no false positives on prices/sizes.

## ⏳ Written but NOT yet executed (requires `pnpm install`)

| Item | Status |
|---|---|
| `pnpm install`, `prisma generate` | not run |
| NestJS compile (`nest build`), real `tsc` with framework types | not run |
| API end-to-end tests (`apps/api/test/e2e/*.e2e.ts`, ~20 scenarios through HTTP incl. EXIF stripping, refresh-token reuse detection, double-booking, payouts, sales) | not run |
| `prisma migrate diff` (hand-written migration vs. `schema.prisma`) | not run — see below |
| Seed script | not run (its domain calls are type-checked) |
| Next.js build of the admin dashboard | not run |
| Expo app on a device/simulator, Arabic RTL and English LTR visual check | not run |
| ESLint | not run |

## First commands to run on your machine

```bash
pnpm install
pnpm --filter @dar/mobile align              # aligns Expo native module versions to SDK 54
pnpm --filter @dar/api exec prisma generate
createdb dar_shadow                          # or via docker: see docker-compose.yml
pnpm db:check                                # must report no differences (see note)
pnpm typecheck
pnpm --filter @dar/api test:e2e              # needs TEST_DATABASE_URL (dar_test)
pnpm test:sql
pnpm build
pnpm dev:mobile                              # then check Arabic (default) and switch to English in Account
```

**Note on `db:check`.** The init migration was written by hand to match Prisma's naming conventions exactly. If `prisma migrate diff` reports any difference, regenerate it: delete `20261013000000_init`, run `prisma migrate dev --create-only --name init`, and keep `20261013000100_financial_guards` (Prisma does not manage CHECK constraints, triggers or exclusion constraints, so it will not try to drop them).

**Dependency versions** were pinned from knowledge of the ecosystem as of mid-2026 because the registry was unreachable: NestJS 11, Prisma 6.16, Next.js 15.5, React 19.1, Expo SDK 54 / React Native 0.81, Zod 3.25, TypeScript 5.9. Run `pnpm outdated` and `expo install --fix` after installing.
