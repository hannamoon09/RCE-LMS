#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DB_USERNAME:?Load the development .env}"
: "${DB_PASSWORD:?Load the development .env}"
: "${DEV_SEED_PASSWORD:?Set the development seed password}"
docker compose up -d --wait postgres
if [[ "$(docker compose exec -T postgres psql -U "$DB_USERNAME" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'rce_lms_e2e'")" != "1" ]]; then
  docker compose exec -T postgres createdb -U "$DB_USERNAME" rce_lms_e2e
fi
# This literal database is reserved for disposable browser fixtures. Never reset DB_URL.
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USERNAME" -d rce_lms_e2e \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null
export DB_URL="jdbc:postgresql://localhost:${DB_PORT:-5432}/rce_lms_e2e"
export SPRING_PROFILES_ACTIVE=dev
export SESSION_COOKIE_SECURE=false
export PORT=8081
export FILE_STORAGE_PATH="$PWD/backend-data/e2e-uploads"
task_java="${JAVA_HOME:+$JAVA_HOME/bin/}java"
if [[ -z "${JAVA_HOME:-}" && -x /usr/libexec/java_home ]]; then
  task_java="$(/usr/libexec/java_home -v 21)/bin/java"
fi
exec "$task_java" -jar backend/build/libs/rce-lms-backend-0.1.0.jar
