#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
: "${DB_USERNAME:?Set DB_USERNAME}"
: "${DB_PASSWORD:?Set DB_PASSWORD}"
docker compose up -d --wait postgres
# Only this dedicated local test database is created. Tests never use the application database.
if [[ "$(docker compose exec -T postgres psql -U "$DB_USERNAME" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'rce_lms_test'")" != "1" ]]; then
  docker compose exec -T postgres createdb -U "$DB_USERNAME" rce_lms_test
fi
export TEST_DB_URL="${TEST_DB_URL:-jdbc:postgresql://localhost:${DB_PORT:-5432}/rce_lms_test}"
if [[ "$TEST_DB_URL" != */rce_lms_test ]]; then
  echo 'Refusing to run integration tests: TEST_DB_URL must end with /rce_lms_test.' >&2
  exit 1
fi
cd backend
exec ./gradlew test "$@" build --console=plain
