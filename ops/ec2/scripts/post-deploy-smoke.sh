#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/comanda}"
BACKEND_ENV="${BACKEND_ENV:-${APP_DIR}/backend/.env}"

cleanup() {
  local status=$?
  if [[ "${status}" -ne 0 ]]; then
    SERVICE_RESULT="exit-code" EXIT_STATUS="${status}" \
      bash "${APP_DIR}/ops/ec2/scripts/notify-failure.sh" post-deploy-smoke || true
  fi
}

trap cleanup EXIT

if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "Falta ${BACKEND_ENV}. El smoke post-deploy necesita el entorno de produccion." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${BACKEND_ENV}"
set +a

BASE_URL="${BASE_URL:-${FRONTEND_URL:-${BACKEND_URL:-}}}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Falta BASE_URL y tampoco se pudo derivar desde FRONTEND_URL/BACKEND_URL" >&2
  exit 1
fi

if [[ -z "${SMOKE_ADMIN_EMAIL:-}" || -z "${SMOKE_ADMIN_PASSWORD:-}" ]]; then
  echo "Faltan SMOKE_ADMIN_EMAIL y/o SMOKE_ADMIN_PASSWORD para validar login y dashboard" >&2
  exit 1
fi

cd "${APP_DIR}/e2e"
npm ci

PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
BASE_URL="${BASE_URL}" \
SMOKE_ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL}" \
SMOKE_ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD}" \
SMOKE_ADMIN_NAME="${SMOKE_ADMIN_NAME:-${SMOKE_ADMIN_EMAIL}}" \
SMOKE_MENU_EXPECT_TEXT="${SMOKE_MENU_EXPECT_TEXT:-}" \
npm run test:smoke

echo "Smoke post deploy completado"
