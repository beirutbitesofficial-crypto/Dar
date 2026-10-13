# Deployment

## Components
| Component | Suggested hosting | Notes |
|---|---|---|
| API (`apps/api`) | Any Node 22 container host (Render, Fly.io, Railway, ECS, a VPS) | Stateless; 512 MB RAM is enough to start; `sharp` needs a glibc/musl-compatible build. |
| Admin (`apps/admin`) | Vercel or the same container host | Server-side only env: `API_URL`, `COOKIE_SECURE=true`. |
| PostgreSQL 16 | Managed (Neon, Supabase, RDS, Crunchy) | Must allow `btree_gist`. Enable point-in-time recovery. |
| Object storage | S3-compatible private bucket | Block public access; enable versioning. |
| Mobile | EAS Build + App Store / Google Play | See RELEASE_CHECKLIST.md. |

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
