#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/comanda}"
SOURCE="${1:-${RESTORE_SOURCE:-}}"
READINESS_URL="${2:-${READINESS_URL:-}}"

if [[ -z "${SOURCE}" ]]; then
  echo "Uso: restore-drill.sh <dump-path-o-s3-uri> [readiness-url]" >&2
  exit 1
fi

: "${DATABASE_URL:?Falta DATABASE_URL para crear la base temporal}"

DB_URL_NO_QUERY="${DATABASE_URL%%\?*}"
DB_QUERY=""
if [[ "${DATABASE_URL}" == *"?"* ]]; then
  DB_QUERY="?${DATABASE_URL#*\?}"
fi

TEMP_DB="comanda_restore_drill_$(date +%Y%m%d_%H%M%S)"
TEMP_URL="${DB_URL_NO_QUERY%/*}/${TEMP_DB}${DB_QUERY}"

cleanup() {
  dropdb "${DB_URL_NO_QUERY}" --if-exists "${TEMP_DB}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

createdb "${DB_URL_NO_QUERY}" "${TEMP_DB}"
bash "${APP_DIR}/ops/ec2/scripts/restore-db.sh" "${SOURCE}" "${TEMP_URL}"

psql "${TEMP_URL}" -c "SELECT 1;" >/dev/null

if [[ -d "${APP_DIR}/backend" ]]; then
  (
    cd "${APP_DIR}/backend"
    DATABASE_URL="${TEMP_URL}" npx prisma migrate status
  )
fi

if [[ -n "${READINESS_URL}" ]]; then
  curl -fsS "${READINESS_URL}" >/dev/null
fi

echo "Restore drill completado sobre ${TEMP_DB}"
