#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Let's Encrypt SSL Initializer using Certbot
# ==============================================================================

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <domain-name> <email-address>"
  echo "Example: $0 bills.thoorigai.com admin@thoorigai.com"
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Requesting initial Let's Encrypt certificate for $DOMAIN ($EMAIL)..."

# Ensure Nginx is running to serve the ACME challenge
docker compose -f docker-compose.prod.yml up -d nginx

# Run certbot certonly
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "==> Certificate generated successfully!"
echo "==> Now activate HTTPS by copying infra/nginx/conf.d/ssl.conf.template:"
echo "    sed 's/YOUR_DOMAIN_NAME/$DOMAIN/g' infra/nginx/conf.d/ssl.conf.template > infra/nginx/conf.d/ssl.conf"
echo "    docker compose -f docker-compose.prod.yml exec nginx nginx -s reload"
