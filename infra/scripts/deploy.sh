#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Production Deployment Script - Bill Collection Tracker
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Starting production deployment at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "==> Working directory: $PROJECT_DIR"

# 1. Capture current git commit in case rollback is needed
PREV_COMMIT=$(git rev-parse HEAD || echo "")
echo "$PREV_COMMIT" > .last_good_commit

# 2. Pull latest code
echo "==> Fetching latest changes from Git..."
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git pull origin "$CURRENT_BRANCH"

# 3. Optional: Sync secrets from AWS SSM Parameter Store if configured
if command -v aws >/dev/null 2>&1 && [ -n "${SSM_PARAM_PREFIX:-}" ]; then
  echo "==> Fetching environment parameters from AWS SSM ($SSM_PARAM_PREFIX)..."
  aws ssm get-parameters-by-path \
    --path "$SSM_PARAM_PREFIX" \
    --with-decryption \
    --query "Parameters[*].[Name,Value]" \
    --output text | while read -r name value; do
      key=$(basename "$name")
      echo "$key=$value" >> .env.ssm
    done
  if [ -f .env.ssm ]; then
    mv .env.ssm .env
    chmod 600 .env
  fi
fi

# Ensure .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file is missing. Please configure .env before deploying." >&2
  exit 1
fi

# 4. Run Prisma database migrations in isolated container
echo "==> Applying database migrations..."
docker compose -f docker-compose.prod.yml run --rm api npm run db:deploy --workspace=api

# 5. Build and restart production containers
echo "==> Building and launching production containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# 6. Health check verification with retry loop
echo "==> Verifying service health..."
MAX_ATTEMPTS=12
INTERVAL=5
HEALTHY=false

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo "Polling health endpoint (attempt $i/$MAX_ATTEMPTS)..."
  if curl -sf --max-time 3 http://localhost/health >/dev/null 2>&1 || \
     curl -sf --max-time 3 http://localhost:3001/health >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep $INTERVAL
done

if [ "$HEALTHY" = true ]; then
  echo "==> Deployment SUCCESSFUL! Service is healthy at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  exit 0
else
  echo "ERROR: Health check failed after $((MAX_ATTEMPTS * INTERVAL)) seconds!" >&2
  echo "==> Triggering automatic rollback..."
  ./infra/scripts/rollback.sh
  exit 1
fi
