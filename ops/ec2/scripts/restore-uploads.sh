#!/usr/bin/env bash
set -euo pipefail

SOURCE="${1:-}"
TARGET_DIR="${2:-${UPLOADS_DIR:-}}"

if [[ -z "${SOURCE}" || -z "${TARGET_DIR}" ]]; then
  echo "Uso: restore-uploads.sh <source-dir-o-s3-prefix> <target-dir>"
  exit 1
fi

mkdir -p "${TARGET_DIR}"

if [[ "${SOURCE}" == s3://* ]]; then
  : "${AWS_REGION:?Falta AWS_REGION para restore desde S3}"
  aws s3 sync "${SOURCE%/}/" "${TARGET_DIR%/}/" --region "${AWS_REGION}" --delete
else
  if [[ ! -d "${SOURCE}" ]]; then
    echo "No existe el directorio origen: ${SOURCE}" >&2
    exit 1
  fi

  find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "${SOURCE%/}/." "${TARGET_DIR%/}/"
fi

echo "Restore de uploads completado sobre ${TARGET_DIR}"
