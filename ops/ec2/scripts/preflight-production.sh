#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/comanda}"
BACKEND_ENV="${BACKEND_ENV:-${APP_DIR}/backend/.env}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/comanda.conf}"

required_vars=(
  DATABASE_URL
  DIRECT_URL
  JWT_SECRET
  PUBLIC_ORDER_JWT_SECRET
  FRONTEND_URL
  BACKEND_URL
  ENCRYPTION_KEY
  MERCADOPAGO_WEBHOOK_SECRET
  BRIDGE_TOKEN
  S3_BACKUP_URI
  AWS_REGION
)

warnings=()
errors=()

add_error() {
  errors+=("$1")
}

add_warning() {
  warnings+=("$1")
}

contains_placeholder() {
  local value="$1"
  [[ -z "${value}" ]] && return 0
  [[ "${value}" == *CHANGE_THIS* ]] \
    || [[ "${value}" == *change_this* ]] \
    || [[ "${value}" == *usuario:password* ]] \
    || [[ "${value}" == *APP_USR-xxxx* ]] \
    || [[ "${value}" == *tu-bucket-comanda* ]] \
    || [[ "${value}" == *tu-dominio.com* ]]
}

if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "No existe el archivo de entorno: ${BACKEND_ENV}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${BACKEND_ENV}"
set +a

for key in "${required_vars[@]}"; do
  value="${!key:-}"
  if [[ -z "${value}" ]]; then
    add_error "Falta ${key} en ${BACKEND_ENV}"
    continue
  fi

  if contains_placeholder "${value}"; then
    add_error "${key} sigue usando un placeholder"
  fi
done

if [[ -n "${JWT_SECRET:-}" && "${#JWT_SECRET}" -lt 32 ]]; then
  add_error "JWT_SECRET debe tener al menos 32 caracteres"
fi

if [[ -n "${PUBLIC_ORDER_JWT_SECRET:-}" && "${#PUBLIC_ORDER_JWT_SECRET}" -lt 32 ]]; then
  add_error "PUBLIC_ORDER_JWT_SECRET debe tener al menos 32 caracteres"
fi

if [[ -n "${BRIDGE_TOKEN:-}" && "${#BRIDGE_TOKEN}" -lt 16 ]]; then
  add_error "BRIDGE_TOKEN debe tener al menos 16 caracteres"
fi

if [[ -z "${HOST:-}" ]]; then
  add_warning "HOST no esta definido en backend/.env; systemd deberia fijarlo a 127.0.0.1"
elif [[ "${HOST}" != "127.0.0.1" ]]; then
  add_error "HOST debe ser 127.0.0.1 en produccion"
fi

if [[ -z "${SMOKE_ADMIN_EMAIL:-}" || -z "${SMOKE_ADMIN_PASSWORD:-}" ]]; then
  add_error "Faltan SMOKE_ADMIN_EMAIL y SMOKE_ADMIN_PASSWORD para el smoke post-deploy"
fi

if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
  if [[ ! "${ENCRYPTION_KEY}" =~ ^[a-fA-F0-9]{64}$ ]]; then
    add_error "ENCRYPTION_KEY debe tener 64 caracteres hexadecimales"
  fi

  if [[ "${ENCRYPTION_KEY}" =~ ^0+$ ]]; then
    add_error "ENCRYPTION_KEY no puede ser el placeholder de ceros"
  fi
fi

for url_key in FRONTEND_URL BACKEND_URL; do
  url_value="${!url_key:-}"
  if [[ -n "${url_value}" ]]; then
    if [[ "${url_value}" == *localhost* || "${url_value}" == *127.0.0.1* ]]; then
      add_error "${url_key} no puede apuntar a localhost en produccion"
    fi
    if [[ ! "${url_value}" =~ ^https:// ]]; then
      add_warning "${url_key} no usa HTTPS"
    fi
  fi
done

if [[ -n "${S3_UPLOADS_BACKUP_URI:-}" ]]; then
  if contains_placeholder "${S3_UPLOADS_BACKUP_URI}"; then
    add_error "S3_UPLOADS_BACKUP_URI sigue usando un placeholder"
  fi

  if [[ -z "${UPLOADS_DIR:-}" ]]; then
    add_error "S3_UPLOADS_BACKUP_URI requiere UPLOADS_DIR"
  elif [[ ! -d "${UPLOADS_DIR}" ]]; then
    add_error "UPLOADS_DIR no existe en el host: ${UPLOADS_DIR}"
  fi
else
  add_warning "S3_UPLOADS_BACKUP_URI no esta configurado; los uploads no tendran backup versionado"
fi

if [[ -n "${ARCA_CUIT:-}" ]]; then
  for key in ARCA_CERT_PATH ARCA_KEY_PATH; do
    if [[ -z "${!key:-}" ]]; then
      add_error "Falta ${key} para usar ARCA"
    fi
  done
fi

if [[ -z "${ALERT_WEBHOOK_URL:-}" && -z "${SENTRY_DSN:-}" ]]; then
  add_error "Falta un sink de alertas: define ALERT_WEBHOOK_URL o SENTRY_DSN"
elif [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
  add_warning "ALERT_WEBHOOK_URL no esta configurado; las alertas de sistema quedaran solo en journald"
fi

if [[ -z "${MERCADOPAGO_ACCESS_TOKEN:-}" ]]; then
  add_warning "MERCADOPAGO_ACCESS_TOKEN no esta configurado en .env; confirmar que se cargara desde UI"
elif contains_placeholder "${MERCADOPAGO_ACCESS_TOKEN}"; then
  add_error "MERCADOPAGO_ACCESS_TOKEN sigue usando un placeholder"
fi

if [[ -n "${MERCADOPAGO_PUBLIC_KEY:-}" && contains_placeholder "${MERCADOPAGO_PUBLIC_KEY}" ]]; then
  add_error "MERCADOPAGO_PUBLIC_KEY sigue usando un placeholder"
fi

if [[ -n "${SMTP_HOST:-}" ]]; then
  for key in SMTP_PORT SMTP_USER SMTP_PASS EMAIL_FROM; do
    if [[ -z "${!key:-}" ]]; then
      add_error "Falta ${key} para usar SMTP"
    fi
  done
fi

bridge_required="${BRIDGE_REQUIRED:-false}"
bridge_allowed_ips="${BRIDGE_ALLOWED_IPS:-}"
bridge_has_real_ip=false

if [[ -n "${bridge_allowed_ips}" ]]; then
  IFS=',' read -ra bridge_ip_list <<< "${bridge_allowed_ips}"
  for raw_ip in "${bridge_ip_list[@]}"; do
    bridge_ip="${raw_ip//[[:space:]]/}"
    case "${bridge_ip}" in
      ''|127.0.0.1|::1|localhost) ;;
      *) bridge_has_real_ip=true ;;
    esac
  done
fi

if [[ -f "${NGINX_CONF}" ]]; then
  if grep -q 'comanda\.example\.com' "${NGINX_CONF}"; then
    add_error "La configuracion de nginx todavia usa comanda.example.com"
  fi

  if grep -q 'ssl-cert-snakeoil' "${NGINX_CONF}"; then
    add_warning "La configuracion de nginx todavia referencia certificados snakeoil"
  fi

  if [[ "${bridge_required}" == "true" ]]; then
    if [[ "${bridge_has_real_ip}" != true ]]; then
      add_error "BRIDGE_REQUIRED=true pero BRIDGE_ALLOWED_IPS sigue limitado a loopback"
    fi

    if grep -q '# allow 203\.0\.113\.10;' "${NGINX_CONF}" || grep -q '# allow 198\.51\.100\.0/24;' "${NGINX_CONF}"; then
      add_error "BRIDGE_REQUIRED=true pero nginx sigue teniendo allowlists de ejemplo"
    fi
  elif [[ "${bridge_has_real_ip}" != true ]]; then
    add_warning "BRIDGE_ALLOWED_IPS sigue en loopback; el bridge quedara solo local"
  fi
else
  if [[ "${bridge_required}" == "true" ]]; then
    add_error "No se encontro ${NGINX_CONF} y BRIDGE_REQUIRED=true"
  else
    add_warning "No se encontro ${NGINX_CONF}; revisar nginx manualmente"
  fi
fi

if [[ "${#warnings[@]}" -gt 0 ]]; then
  echo "Advertencias:"
  for warning in "${warnings[@]}"; do
    echo "  - ${warning}"
  done
fi

if [[ "${#errors[@]}" -gt 0 ]]; then
  echo "Errores de preflight:"
  for error in "${errors[@]}"; do
    echo "  - ${error}"
  done
  exit 1
fi

echo "Preflight de produccion OK"
