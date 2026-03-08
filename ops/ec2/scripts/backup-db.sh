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

echo "Backup subido a ${DEST}"
