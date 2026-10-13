#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Rollback Script - Bill Collection Tracker
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Initiating rollback sequence..."

if [ -f .last_good_commit ]; then
  TARGET_COMMIT=$(cat .last_good_commit)
  if [ -n "$TARGET_COMMIT" ]; then
    echo "==> Rolling back repository to commit: $TARGET_COMMIT"
    git checkout -f "$TARGET_COMMIT"
  fi
fi

echo "==> Rebuilding and restarting containers from rollback commit..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "==> Checking health after rollback..."
sleep 10
if curl -sf http://localhost/health >/dev/null 2>&1 || \
   curl -sf http://localhost:3001/health >/dev/null 2>&1; then
  echo "==> Rollback completed successfully. System returned to healthy state."
  exit 0
else
  echo "CRITICAL: System remained degraded after rollback. Inspect container logs with:" >&2
  echo "  docker compose -f docker-compose.prod.yml logs --tail=100" >&2
  exit 1
fi
