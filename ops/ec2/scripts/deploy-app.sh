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

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  echo "Falta ${APP_DIR}/backend/.env. Copialo desde backend/.env.example antes del deploy."
  exit 1
fi

APP_DIR="${APP_DIR}" bash "${APP_DIR}/ops/ec2/scripts/preflight-production.sh"

cd "${APP_DIR}/backend"
npm ci --omit=dev
npx prisma generate
node scripts/maintenance/check-user-email-collisions.js
npx prisma migrate deploy
npm run db:bootstrap

cd "${APP_DIR}/frontend"
npm ci
npm run build

mkdir -p "${APP_DIR}/backend/logs" "${APP_DIR}/uploads" /var/log/comanda /var/www/certbot
chown -R www-data:www-data "${APP_DIR}/backend/logs" "${APP_DIR}/uploads" /var/log/comanda

systemctl daemon-reload
systemctl enable --now comanda-backend
systemctl enable --now comanda-backup.timer
systemctl enable --now comanda-maintenance.timer
systemctl restart comanda-backend
nginx -t
systemctl reload nginx

APP_DIR="${APP_DIR}" bash "${APP_DIR}/ops/ec2/scripts/post-deploy-smoke.sh"

echo "Deploy completado. Estado actual:"
systemctl --no-pager --full status comanda-backend
