# Dar · دار — managed real estate brokerage for Lebanon

A complete platform for property **sales and rentals** in Iqlim El Kharroub, Saida, Jiyeh, Naameh and Damour:

| Part | Stack | Folder |
|---|---|---|
| Customer & owner mobile app (iOS + Android) | Expo SDK 54 · React Native 0.81 · TypeScript · Expo Router | `apps/mobile` |
| Administration dashboard (staff & admins) | Next.js 15 (App Router) · React 19 | `apps/admin` |
| Backend API | NestJS 11 · Prisma 6 · PostgreSQL 16 | `apps/api` |
| Shared domain logic, validation, types, branding, translations | TypeScript · Zod | `packages/shared` |

“Dar / دار” is a **placeholder brand**. Name, colors, contact details and bundle IDs live in one file: `packages/shared/src/brand.ts`. Icons/splash in `apps/mobile/assets` are generated placeholders.

> ⚠️ **Read [`docs/VERIFICATION.md`](docs/VERIFICATION.md) first.** This codebase was produced in an environment without npm registry access. The domain logic and the database were tested for real; the NestJS / Next.js / Expo layers were written in full but have **not yet been installed, compiled or run**. The first commands to run are listed there.

---

## How the business works (and where it's enforced)

- **Managed brokerage.** Customers talk to *our staff*, never to owners. There is no owner-contact button, no owner–customer chat, and the public API cannot return owner contacts, exact addresses or precise pins (allowlist serializer + a second check on every public response + tests).
- **Sales commission:** seller **2.5%** + buyer **2.5%** of the **final agreed price** (5% combined brokerage revenue). Example $100,000 → seller pays $2,500 (receives $97,500), buyer pays $2,500 (total $102,500). Excludes taxes/other charges.
- **Rentals:** a **recurring monthly** management/brokerage fee (default **$50**) paid by the tenant. Owner enters net rent $500 → tenant pays $550/month → owner is paid $500 after collection. Alternative mode (admin-configurable for future agreements): total rent entered, explicit fee deducted, owner's net shown before acceptance.
- **Settings changes never touch existing deals.** Every viewing request, closing and lease stores a frozen snapshot of the rules, amounts, terms version and acceptance. PostgreSQL triggers reject edits to active lease terms; amendments are separate records with effective dates.
- **Money is integer cents** everywhere (BigInt in the database). Ledgers are **append-only**: corrections are reversals/refunds, enforced by triggers.
- **Owner payouts are separate** from tenant payments. A tenant paying never marks the owner as paid; the database refuses payouts larger than what was actually collected for that owner.
- **Dashboard money** keeps five figures apart: money collected · brokerage revenue earned · brokerage fees unpaid · rent owed to landlords · landlord payouts.

## Quick start (local)

Prerequisites: Node ≥ 22.12, pnpm 10, Docker (for PostgreSQL + MinIO), Xcode/Android Studio or the Expo Go app.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env          # set your LAN IP for phones
pnpm db:up                                            # PostgreSQL 16 + MinIO (private bucket)
pnpm --filter @dar/api exec prisma migrate deploy
pnpm db:seed                                          # base data + clearly-marked demo data
pnpm dev:api        # http://localhost:4000/health
pnpm dev:admin      # http://localhost:3000
pnpm dev:mobile     # scan the QR code with Expo Go / dev client
```

No Docker? Set `STORAGE_DRIVER=local` in `apps/api/.env` (development-only, refused in production) and point `DATABASE_URL` at any PostgreSQL 14+ with the `btree_gist` extension available.

### Demo accounts (fictional — demo data only)

Password for all: `Dar-demo-2026`

| Role | Email |
|---|---|
| Administrator | `admin@demo.dar.test` |
| Employee (may record collections) | `employee1@demo.dar.test` |
| Employee | `employee2@demo.dar.test` |
| Owner | `owner1@demo.dar.test`, `owner2@demo.dar.test` |
| Customer | `customer1@demo.dar.test`, `customer2@demo.dar.test` |

Demo listings are flagged `demo=true`, carry a **“إعلان تجريبي / Demo listing”** badge in the app and dashboard, use generated “DEMO” photos and fictional addresses. Seeding demo data is skipped in production.

## Scripts

| Command | What it does |
|---|---|
| `pnpm verify` | typecheck → lint → tests → SQL guard tests → builds |
| `pnpm test` | shared domain tests, API unit + end-to-end tests |
| `pnpm test:sql` | applies migrations to `dar_test` and attacks the database guards |
| `pnpm db:check` | confirms the hand-written migrations match `schema.prisma` |
| `pnpm --filter @dar/mobile align` | `expo install --fix` — aligns native module versions with the SDK |

## Documentation

- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — what was tested, actual results, what to run first
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — design, decisions and assumptions
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema, invariants and database-level guards
- [`docs/SECURITY.md`](docs/SECURITY.md) — authorization model, privacy, uploads, sessions
- [`docs/PRIVACY_RETENTION.md`](docs/PRIVACY_RETENTION.md) — account deletion and retention workflow
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — email, phone OTP, OCR, push, maps, payments (status of each)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment, jobs, backups and recovery
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) — App Store / Google Play submission and the credentials & assets you need

Legal text (terms, privacy) is **placeholder** and flagged in-app as pending review by a lawyer qualified in Lebanon. Recorded consent in the app does not by itself guarantee that a commission can be collected.
