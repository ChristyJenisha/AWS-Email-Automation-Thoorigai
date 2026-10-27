#!/bin/bash
set -eo pipefail

BACKUP_DIR="/home/ubuntu/backups/postgres"
LOG_FILE="/home/ubuntu/backups/backup.log"
CONTAINER_NAME="aws-email-automation-thoorigai-db-1"
DB_USER="tracker"
DB_NAME="bill_tracker"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/bill_tracker_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup for ${DB_NAME}..." >> "${LOG_FILE}"

# Verify DB container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Container ${CONTAINER_NAME} is not running!" >> "${LOG_FILE}"
  exit 1
fi

# Execute pg_dump and gzip
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Verify archive integrity
if gzip -t "${BACKUP_FILE}"; then
  BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: Backup created ${BACKUP_FILE} (${BACKUP_SIZE})" >> "${LOG_FILE}"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup archive verification failed!" >> "${LOG_FILE}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Retention policy: remove backups older than 7 days
DELETED_COUNT=$(find "${BACKUP_DIR}" -type f -name "bill_tracker_*.sql.gz" -mtime +7 | wc -l)
find "${BACKUP_DIR}" -type f -name "bill_tracker_*.sql.gz" -mtime +7 -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Retention policy cleaned ${DELETED_COUNT} old backup(s)." >> "${LOG_FILE}"
