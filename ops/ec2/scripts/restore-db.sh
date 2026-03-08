#!/usr/bin/env bash
set -euo pipefail

SOURCE="${1:-}"
TARGET_URL="${2:-${RESTORE_DATABASE_URL:-}}"

if [[ -z "${SOURCE}" || -z "${TARGET_URL}" ]]; then
  echo "Uso: restore-db.sh <dump-path-o-s3-uri> <restore-database-url>"
  exit 1
fi

LOCAL_FILE="${SOURCE}"
TEMP_FILE=""

if [[ "${SOURCE}" == s3://* ]]; then
  TEMP_FILE="/tmp/comanda-restore-$(date +%s).dump"
  aws s3 cp "${SOURCE}" "${TEMP_FILE}"
  LOCAL_FILE="${TEMP_FILE}"
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname "${TARGET_URL}" "${LOCAL_FILE}"
psql "${TARGET_URL}" -c "SELECT 1;"

if [[ -n "${TEMP_FILE}" && -f "${TEMP_FILE}" ]]; then
  rm -f "${TEMP_FILE}"
fi

echo "Restore completado sobre ${TARGET_URL}"
