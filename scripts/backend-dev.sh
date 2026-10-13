#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
export SPRING_PROFILES_ACTIVE=dev
cd backend
exec ./gradlew bootRun --console=plain
