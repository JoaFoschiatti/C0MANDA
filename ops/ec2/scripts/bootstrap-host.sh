#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecutar como root o con sudo"
  exit 1
fi

apt-get update
apt-get install -y git nginx openssl postgresql-client awscli logrotate curl ca-certificates gnupg certbot python3-certbot-nginx ssl-cert
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

mkdir -p /opt/comanda/backend/logs
mkdir -p /opt/comanda/uploads
mkdir -p /etc/comanda/arca
mkdir -p /var/log/comanda
mkdir -p /var/www/certbot

chown -R www-data:www-data /opt/comanda /var/log/comanda
systemctl enable --now nginx

echo "Host preparado para Comanda en EC2"
