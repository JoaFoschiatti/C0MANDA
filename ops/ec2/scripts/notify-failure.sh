#!/usr/bin/env bash
set -euo pipefail

LABEL="${1:-unknown}"
RESULT="${SERVICE_RESULT:-exit-code}"
STATUS="${EXIT_STATUS:-${EXIT_CODE:-1}}"
MESSAGE="${2:-}"

if [[ "${RESULT}" == "success" ]]; then
  exit 0
fi

if [[ -z "${MESSAGE}" ]]; then
  MESSAGE="Comanda ${LABEL} fallo con resultado ${RESULT} y estado ${STATUS}"
fi

PAYLOAD=$(cat <<EOF
{"source":"comanda","service":"${LABEL}","service_result":"${RESULT}","exit_status":"${STATUS}","host":"${HOSTNAME:-unknown}","message":"${MESSAGE}"}
EOF
)

if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
  if ! curl -fsS \
    -H 'Content-Type: application/json' \
    -d "${PAYLOAD}" \
    "${ALERT_WEBHOOK_URL}" >/dev/null; then
    echo "No se pudo enviar la alerta para ${LABEL}; se conserva el error original en journald." >&2
  fi
else
  echo "${MESSAGE}" >&2
  echo "ALERT_WEBHOOK_URL no esta configurado; revisa tambien SENTRY_DSN en la app si aplica." >&2
fi

exit 0
