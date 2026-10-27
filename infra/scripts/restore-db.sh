#!/bin/bash
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/backup.sql.gz"
  echo "Example: $0 /home/ubuntu/backups/postgres/bill_tracker_20261027_040400.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="aws-email-automation-thoorigai-db-1"
DB_USER="tracker"
DB_NAME="bill_tracker"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found at ${BACKUP_FILE}"
  exit 1
fi

echo "Restoring database ${DB_NAME} from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"
echo "Database restore completed successfully!"
