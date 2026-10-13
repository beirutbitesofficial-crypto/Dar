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
step 02-install        pnpm install --no-frozen-lockfile
step 03-expo-align     bash -c 'cd apps/mobile && npx expo install --check; echo "--- fix:"; npx expo install --fix'
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
step 20-build-admin    pnpm --filter @dar/admin build
step 21-seed-demo      bash -c 'cd apps/api && npx prisma migrate deploy && SEED_DEMO=true npx tsx prisma/seed.ts'
step 22-expo-export-web bash -c 'cd apps/mobile && npx expo export --platform web --output-dir dist-web'
step 23-expo-export-native bash -c 'cd apps/mobile && npx expo export --platform android --platform ios --output-dir dist-native'
step 24-expo-doctor    bash -c 'cd apps/mobile && npx --yes expo-doctor'
step 25-versions       bash -c 'pnpm list -r --depth 0'
cat "$OUT/summary.txt"
