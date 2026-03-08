#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?Falta BASE_URL, por ejemplo https://comanda.midominio.com}"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT

curl -fsS "${BASE_URL}/api/health" >/dev/null
curl -fsS "${BASE_URL}/api/ready" >/dev/null
curl -fsS "${BASE_URL}/menu" >/dev/null

if [[ -n "${SMOKE_ADMIN_EMAIL:-}" && -n "${SMOKE_ADMIN_PASSWORD:-}" ]]; then
  curl -fsS -c "${COOKIE_JAR}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${SMOKE_ADMIN_EMAIL}\",\"password\":\"${SMOKE_ADMIN_PASSWORD}\"}" \
    "${BASE_URL}/api/auth/login" >/dev/null

  curl -fsS -b "${COOKIE_JAR}" "${BASE_URL}/api/auth/perfil" >/dev/null
fi

echo "Smoke post deploy completado"
