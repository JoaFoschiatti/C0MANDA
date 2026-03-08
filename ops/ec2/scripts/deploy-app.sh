#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/comanda}"
BRANCH="${BRANCH:-main}"
REPO_URL="${1:-${REPO_URL:-}}"

if [[ -z "${REPO_URL}" && ! -d "${APP_DIR}/.git" ]]; then
  echo "Falta REPO_URL o primer argumento con la URL del repo"
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" fetch --all --prune
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
fi

cd "${APP_DIR}/backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed

cd "${APP_DIR}/frontend"
npm ci
npm run build

mkdir -p "${APP_DIR}/backend/logs" "${APP_DIR}/uploads" /var/log/comanda
chown -R www-data:www-data "${APP_DIR}/backend/logs" "${APP_DIR}/uploads" /var/log/comanda

systemctl daemon-reload
systemctl enable --now comanda-backend
systemctl enable --now comanda-backup.timer
systemctl enable --now comanda-maintenance.timer
systemctl restart comanda-backend
systemctl reload nginx || true

echo "Deploy completado. Estado actual:"
systemctl --no-pager --full status comanda-backend
