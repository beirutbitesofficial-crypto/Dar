#!/usr/bin/env bash
# Starts the built API, admin dashboard and mobile web export against the seeded
# demo database, then captures screenshots of the main journeys with Playwright.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=ci-out; mkdir -p "$OUT/shots" "$OUT/logs"
(cd apps/api && node dist/main.js > "../../$OUT/logs/run-api.log" 2>&1 &)
(cd apps/admin && API_URL=http://localhost:4000 npx next start -p 3000 > "../../$OUT/logs/run-admin.log" 2>&1 &)
if [ -d apps/mobile/dist-web ]; then (npx --yes serve@14 -s apps/mobile/dist-web -l 8081 > "$OUT/logs/run-mobile-web.log" 2>&1 &); fi
for i in $(seq 1 60); do curl -sf localhost:4000/health >/dev/null && curl -sf -o /dev/null localhost:3000/login && break; sleep 2; done
curl -s localhost:4000/health; echo
node scripts/smoke.mjs
