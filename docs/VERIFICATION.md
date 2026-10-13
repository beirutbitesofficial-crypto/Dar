# Verification status

**Last full run:** 2026-10-13 · GitHub Actions (`.github/workflows/ci.yml`, Ubuntu 24.04, Node 22, PostgreSQL 16 service) · every step passing.

The whole pipeline is scripted in `scripts/ci-verify.sh`, and it runs on every push to `main`. Each step's exit code and full log are published to the `ci-results` branch together with the screenshots, so results can be audited after the fact. Nothing below is reported as passing unless it ran.

## Results

| Step | Result |
|---|---|
| `pnpm install --frozen-lockfile` (committed `pnpm-lock.yaml`) | ✅ |
| `expo install --check` (native modules aligned to SDK 54) | ✅ no mismatches |
| `prisma generate` | ✅ |
| `prisma migrate diff` — hand-written migrations vs `schema.prisma` | ✅ **empty diff** (schema and migrations match exactly) |
| Typecheck — shared · API · admin · mobile (strict) | ✅ 0 errors in all four |
| ESLint — shared · API · admin · mobile (`expo lint`) | ✅ 0 errors |
| Shared domain tests | ✅ **53 / 53** |
| API unit tests (upload type sniffing, CSV safety) | ✅ **3 / 3** |
| API end-to-end tests (real Nest app + PostgreSQL over HTTP) | ✅ **18 / 18** |
| Database guard tests (triggers, checks, exclusion constraints) | ✅ **38 / 38** |
| Production builds — shared · API (`nest build`) · admin (`next build`) | ✅ |
| Demo seed (`SEED_DEMO=true`) against a fresh database | ✅ |
| `expo export` — **iOS and Android** JS bundles | ✅ |
| `expo export` — web (preview build) | ✅ |
| Expo Doctor | ✅ **18 / 18 checks** |
| Smoke test — built API + `next start` + mobile web build, driven by Playwright | ✅ every page renders, no console errors (see below) |

### End-to-end API tests (18)

- registers with a Lebanese phone that is stored but never marked verified
- rejects invalid phones and weak passwords
- rotates refresh tokens and revokes the family when an old token is reused
- the admin dashboard login is refused to non-staff accounts
- viewing request requires the current fee disclosure, is idempotent, and creates an assigned lead + conversation
- creates a lease with $500 net + $50 fee and activates it only after both acceptances
- monthly obligation generation never duplicates (including concurrent runs)
- existing agreements keep their accepted fee after the global settings change
- partial payments, overpayment rejection, idempotent recording and reversal
- dashboard keeps collected rent, revenue, unpaid fees, owed rent and payouts separate
- sale closing uses the final agreed price, needs admin approval, and tracks buyer/seller separately
- a listing is invisible to the public until an admin approves it
- public responses never include owner contact, exact address or precise coordinates
- uploaded photos have their EXIF/GPS metadata removed
- owner details: admin and assigned employee only (audited); not other employees or customers
- editing a published listing holds sensitive changes for review; the approved version stays public
- contact details typed into a description are flagged for moderation
- employees see only their own leads

The domain and SQL suites cover the rest of the specification's test list (commission and rental arithmetic in both pricing modes, month-end anchoring, proration, amendments, early termination, owner payout balances incl. owner debt after a bounced payment, state machines, contact detection with Arabic digits). See `packages/shared/test` and `apps/api/test/sql`.

### Screens checked (smoke test)

The smoke test signs in through the real forms and captures every dashboard section as admin, the employee's restricted view, and the mobile app as visitor, customer and owner in Arabic (RTL) and English (LTR). A selection is in [`docs/screenshots`](screenshots/). Figures shown on the overview were checked by hand against the seed data (collected $4,450 · revenue $3,350 · unpaid fees $3,350 · owed to landlords $700 · payouts $400).

## Fixed during verification

Running the code for real surfaced these, all fixed:

- `@dar/shared` was not built before the API was type-checked (it now builds on install via `prepare`).
- Expo could not evaluate `app.config.ts` importing shared TypeScript (now loaded through `tsx/cjs`).
- `ALREADY_REVERSED` returned 422 instead of 409 Conflict.
- An e2e test changed global pricing and leaked it into later suites (now restored; the sale test asserts the spec's 2.5% / $100,000 example).
- **Mobile web:** RTL bootstrapping reloaded forever on web (forceRTL is a no-op there); the web build now sets the document direction. Native builds were not affected.
- **Mobile web:** token storage used SecureStore, which has no web implementation; web previews now use session storage, while native keeps Keychain/Keystore.
- Arabic prices rendered as "$US 600"; amounts are now isolated left-to-right (`$600`).
- Counts read "1 Bathrooms" / "1 حمامات"; now singular/plural aware. English addresses no longer use the Arabic comma.
- Admin dashboard: ~150 hard-coded English labels, statuses and confirmations are now Arabic by default with English on the language switch; employees opening an admin-only URL see a clear notice instead of an error page.
- Metro config drifted from Expo defaults (Expo Doctor); `react-native` 0.81.4 → 0.81.5 per `expo install --check`; ESLint configs added for admin and mobile.

## Not verified here (needs devices, accounts or credentials)

| Item | Why | How to verify |
|---|---|---|
| Running on a physical iPhone / Android device or simulator | No simulator in CI | `pnpm dev:mobile` with Expo Go, or `eas build --profile preview` |
| Native-only modules: maps, image picker, push notifications, SecureStore | Exercised only through the JS bundle build | Preview build on devices |
| S3/MinIO storage driver | CI uses the local driver | `pnpm db:up` (MinIO) and upload a photo |
| Email delivery, phone OTP, OCR, payment provider | Unconfigured by design (see `INTEGRATIONS.md`) | Add credentials |
| App Store / Google Play submission | Needs developer accounts and signing | `RELEASE_CHECKLIST.md` |

## Dependency versions (as installed and tested)

| Package | Version |
|---|---|
| Node.js | 22 LTS (CI) · `engines: >=22.12` |
| pnpm | 10.28.0 |
| TypeScript | 5.9.3 |
| Zod | 3.25.76 |
| NestJS | 11.2.7 (CLI 11.0.24) |
| Prisma / @prisma/client | 6.19.3 |
| PostgreSQL | 16 |
| argon2 · sharp · helmet | 0.44.0 · 0.34.5 · 8.3.0 |
| AWS SDK S3 client | 3.1150.0 |
| Next.js · React | 15.5.27 · 19.1.0 |
| Expo SDK · React Native | 54.0.37 · 0.81.5 |
| expo-router | 6.0.24 |
| TanStack Query | 5.104.2 |
| Jest · ts-jest · supertest | 30.5.2 · 29.4.14 · 7.3.1 |
| ESLint · typescript-eslint | 9.39.5 · 8.71.2 |
| Playwright (smoke test only) | 1.64.0 |

Exact versions of everything are in `pnpm-lock.yaml`.
