#!/usr/bin/env bash
# Runs every verification step, records each step's exit code and log in ci-out/.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=ci-out; mkdir -p "$OUT/logs"; : > "$OUT/summary.txt"
step() {
  local name="$1"; shift
  local start=$(date +%s)
  echo "::group::$name"
  ( "$@" ) > "$OUT/logs/$name.log" 2>&1
  local code=$?
  tail -n 60 "$OUT/logs/$name.log"
  echo "::endgroup::"
  printf '%-28s exit=%-3s %4ss\n' "$name" "$code" "$(( $(date +%s) - start ))" | tee -a "$OUT/summary.txt"
  return 0
}
export PATH="$PWD/node_modules/.bin:$PATH"

step 01-createdb       bash -c 'psql -h localhost -U dar -d dar -c "CREATE DATABASE dar_shadow" && psql -h localhost -U dar -d dar -c "CREATE DATABASE dar_test" && psql -h localhost -U dar -d dar -c "CREATE EXTENSION IF NOT EXISTS btree_gist"'
step 02-install        bash -c 'pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile'
cp apps/api/.env.example apps/api/.env && sed -i -e "s/^STORAGE_DRIVER=.*/STORAGE_DRIVER=local/" -e "s#^CORS_ORIGINS=.*#CORS_ORIGINS=http://localhost:3000,http://localhost:8081#" apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
printf "EXPO_PUBLIC_API_URL=http://localhost:4000\n" > apps/mobile/.env
step 02b-build-shared  pnpm --filter @dar/shared build
step 03-expo-align     bash -c 'cd apps/mobile && npx expo install --check; echo "--- fix:"; npx expo install --fix'
git diff -- apps/mobile/package.json > "$OUT/expo-align.diff"
step 04-prisma-generate pnpm --filter @dar/api exec prisma generate
step 05-migrate-diff   pnpm --filter @dar/api exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script
step 06-typecheck-shared pnpm --filter @dar/shared typecheck
step 07-typecheck-api  pnpm --filter @dar/api typecheck
step 08-typecheck-admin pnpm --filter @dar/admin typecheck
step 09-typecheck-mobile pnpm --filter @dar/mobile typecheck
step 10-lint-shared    pnpm --filter @dar/shared lint
step 11-lint-api       pnpm --filter @dar/api lint
step 12-lint-admin     pnpm --filter @dar/admin lint
step 13-lint-mobile    pnpm --filter @dar/mobile lint
step 14-test-shared    pnpm --filter @dar/shared test
step 15-test-api-unit  pnpm --filter @dar/api test:unit
step 16-test-api-e2e   pnpm --filter @dar/api test:e2e
step 17-test-sql       bash scripts/test-sql.sh
step 18-build-shared   pnpm --filter @dar/shared build
step 19-build-api      pnpm --filter @dar/api build
step 19b-build-api-hostinger bash -c "pnpm run build && pnpm run build:api"
step 20-build-admin    pnpm --filter @dar/admin build
step 20b-base-seed-sql  bash -c 'psql -h localhost -U dar -d dar -c "CREATE DATABASE dar_base" && cd apps/api && DATABASE_URL=postgresql://dar:dar_local_dev@localhost:5432/dar_base npx prisma migrate deploy && DATABASE_URL=postgresql://dar:dar_local_dev@localhost:5432/dar_base SEED_DEMO=false npx tsx prisma/seed.ts && pg_dump -h localhost -U dar -d dar_base --data-only --inserts --column-inserts --no-owner --no-privileges --exclude-table=_prisma_migrations > ../../ci-out/base-seed.sql && wc -l ../../ci-out/base-seed.sql'
step 21-seed-demo      bash -c 'cd apps/api && npx prisma migrate deploy && SEED_DEMO=true npx tsx prisma/seed.ts'
step 22-expo-export-web bash -c 'cd apps/mobile && npx expo export --platform web --output-dir dist-web'
step 23-expo-export-native bash -c 'cd apps/mobile && npx expo export --platform android --platform ios --output-dir dist-native'
step 24-playwright     npx playwright install --with-deps chromium
step 25-smoke          bash scripts/ci-smoke.sh
step 26-expo-doctor    bash -c 'cd apps/mobile && npx --yes expo-doctor'
step 27-versions       bash -c 'pnpm list -r --depth 0'
cat "$OUT/summary.txt"
