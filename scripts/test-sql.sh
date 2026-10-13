#!/usr/bin/env bash
# Applies all migrations to a throwaway database and runs the SQL guard tests.
# Requires psql and a reachable PostgreSQL. Defaults match docker-compose.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:=postgresql://dar:dar_local_dev@localhost:5432/dar_test}"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'SET client_min_messages=warning; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
for m in apps/api/prisma/migrations/*/migration.sql; do
  echo "applying $(basename "$(dirname "$m")")"
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$m"
done
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f apps/api/test/sql/guards.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
