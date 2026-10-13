#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
(cd backend && ./gradlew bootJar --console=plain)
cd frontend
exec npx playwright test --config=playwright.config.ts "$@"
