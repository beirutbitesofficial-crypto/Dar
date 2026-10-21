# Deployment

## Components
| Component | Suggested hosting | Notes |
|---|---|---|
| API (`apps/api`) | Any Node 22 container host (Render, Fly.io, Railway, ECS, a VPS) | Stateless; 512 MB RAM is enough to start; `sharp` needs a glibc/musl-compatible build. |
| Admin (`apps/admin`) | Vercel or the same container host | Server-side only env: `API_URL`, `COOKIE_SECURE=true`. |
| PostgreSQL 16+ | **Supabase project `dar` (set up, see below)** · or Neon, RDS, Crunchy | Must allow `btree_gist`. Enable point-in-time recovery before go-live. |
| Object storage | S3-compatible private bucket | Block public access; enable versioning. |
| Mobile | EAS Build + App Store / Google Play | See RELEASE_CHECKLIST.md. |

## Production database (Supabase) — set up

| | |
|---|---|
| Project | `dar` (ref `wgdkavethechliefrbsp`), region **eu-central-1 (Frankfurt)**, organization "24i", free plan |
| Schema | all migrations in `apps/api/prisma/migrations` applied and recorded in `_prisma_migrations`, so `prisma migrate deploy` only runs newer ones |
| Data | base reference data only (31 locations, 18 amenities, pricing v1: 2.5% + 2.5%, $50/month, legal drafts, 18 notification templates). **No users, no demo data.** |
| Public API lockdown | row-level security on every table with no policies, and no grants to `anon`/`authenticated`, so Supabase's auto-generated REST/GraphQL API cannot read or write Dar's data. Only the Dar API (connecting as `postgres`, the table owner) can. Do **not** add RLS policies or use the Supabase JS client against these tables. |
| Linter | security: only the intended "RLS enabled, no policy" notices. Performance: informational only. |

**Connecting the API.** In the Supabase dashboard, use **Connect → Session pooler** and copy the URI (port 5432, user `postgres.wgdkavethechliefrbsp`). The direct `db.<ref>.supabase.co` host is IPv6-only and many hosts cannot reach it. The database password was generated when the project was created and is not stored anywhere. Set a new one under **Project Settings → Database → Reset database password** and put it in the URI. Use that URI as `DATABASE_URL`. For bursts of traffic later, the transaction pooler (port 6543) works too: append `?pgbouncer=true&connection_limit=5`.

**Backups.** The free plan has no point-in-time recovery. Before real customer money is recorded, either upgrade to Pro (daily backups, PITR add-on) or schedule the weekly `pg_dump -Fc` described below. Free projects are also paused after a week without activity, which a live API prevents.

**Adding the first administrator** (after registering normally through the app or `POST /v1/auth/register`), in the Supabase SQL editor:
```sql
UPDATE "User" SET roles = ARRAY['ADMIN']::"Role"[] WHERE email = 'you@yourdomain.com';
```

## Steps
```bash
# 1. Database
DATABASE_URL=... pnpm --filter @dar/api exec prisma migrate deploy
SEED_DEMO=false NODE_ENV=production DATABASE_URL=... pnpm db:seed   # base data only

# 2. API
pnpm --filter @dar/shared build && pnpm --filter @dar/api build
NODE_ENV=production node apps/api/dist/main.js
```
Required production env (see `apps/api/.env.example`): `DATABASE_URL`, `JWT_ACCESS_SECRET` and `TOKEN_HASH_PEPPER` (≥ 48 random bytes each, different), `CORS_ORIGINS` (admin origin), `TRUST_PROXY=true` behind a load balancer, `S3_*`, `PUBLIC_API_URL`, `EMAIL_DRIVER=smtp` + `SMTP_URL` once implemented. The API refuses to start with placeholder secrets or dev-only drivers.

## API on Hostinger (Node.js web app)

The API runs on Hostinger's Node.js hosting without compiling anything: password hashing uses `@node-rs/argon2`, which ships prebuilt binaries.

**Build settings** (Websites → the site → Node.js → Settings):

| Field | Value |
|---|---|
| Application type | Other |
| Root directory | `/` (repository root, so the shared package is included) |
| Package manager | pnpm |
| Node.js version | 22 |
| Build script | `build:api` |
| Output directory | empty |
| Entry file | `apps/api/dist/main.js` |

**Environment variables:** add every variable from `apps/api/.env.example` in the Node.js app's environment settings (production values: `NODE_ENV=production`, `TRUST_PROXY=true`, Supabase `DATABASE_URL`, R2 `S3_*`, `EMAIL_DRIVER=none`). Hostinger provides `PORT`; don't set it yourself.

**Database migrations** are not run by the build. Apply new migrations from your computer with `DATABASE_URL=... pnpm --filter @dar/api exec prisma migrate deploy` before deploying code that needs them.

**Sleeping apps and the daily job.** Hostinger may stop an idle app. The daily job runs at 06:05 Beirut when the app is awake, and again on any start after 06:05 if today's run hasn't happened (the `JobRun` lock prevents doubles). To keep it awake, add an hPanel cron job every 10 minutes: `curl -fsS https://<api-domain>/health > /dev/null`.

## Jobs
The daily job (06:05 Beirut) ends expired leases, generates obligations 35 days ahead, and sends rent reminders. It is safe to run on several instances (a `JobRun` row per day acts as a lock, and every write is idempotent), but set `JOBS_ENABLED=true` on one instance to keep logs clean. Missed days are caught up automatically because generation is “everything up to today + 35 days”.

## Backups & recovery
- **Database:** managed daily snapshots + PITR (≥ 7 days) and a weekly logical dump (`pg_dump -Fc`) copied to a different provider/region, encrypted. Keep 12 monthly dumps.
- **Objects:** bucket versioning + a lifecycle rule; nightly replication to a second bucket.
- **Restore drill (quarterly):** restore the latest dump into a staging database, run `pnpm test:sql` against it (guards intact), compare ledger totals (`/v1/admin/exports/rent-ledger.csv`) with production.
- **Recovery order:** database → API (migrations are already applied) → verify `/health` → admin → mobile needs no action.
- Ledger tables are append-only, so a restored database plus the audit log is sufficient to reconcile any post-backup activity recorded on paper/bank statements.

## Monitoring
- `GET /health` for uptime checks (also reports integration status).
- Alert on HTTP 5xx rate, job failures (`JobRun.finishedAt` missing after 07:00), and `Notification.pushStatus = FAILED` growth.
