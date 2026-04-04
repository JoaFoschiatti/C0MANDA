#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL}"
: "${S3_BACKUP_URI:?Falta S3_BACKUP_URI}"
: "${AWS_REGION:?Falta AWS_REGION}"

STAMP="$(date +%F-%H%M%S)"
FILE="/tmp/comanda-${STAMP}.dump"
DEST="${S3_BACKUP_URI%/}/${STAMP}.dump"

pg_dump --format=custom --file="${FILE}" "${DATABASE_URL}"
aws s3 cp "${FILE}" "${DEST}" --region "${AWS_REGION}"
rm -f "${FILE}"

if [[ -n "${S3_UPLOADS_BACKUP_URI:-}" ]]; then
  : "${UPLOADS_DIR:?Falta UPLOADS_DIR para sincronizar uploads}"

  if [[ ! -d "${UPLOADS_DIR}" ]]; then
    echo "No existe UPLOADS_DIR=${UPLOADS_DIR}" >&2
    exit 1
  fi

  UPLOADS_DEST="${S3_UPLOADS_BACKUP_URI%/}/${STAMP}/"
  aws s3 sync "${UPLOADS_DIR%/}/" "${UPLOADS_DEST}" --region "${AWS_REGION}" --delete
  echo "Uploads sincronizados a ${UPLOADS_DEST}"
fi

echo "Backup subido a ${DEST}"
