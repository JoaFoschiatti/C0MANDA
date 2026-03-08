# Pack EC2 - Comanda

Paquete canonico para desplegar Comanda en una instancia EC2 Linux con `systemd`, `nginx` y backups a S3.

## Estructura

- `nginx/comanda.conf`: server block base.
- `systemd/comanda-backend.service`: backend Node.
- `systemd/comanda-backup.service` y `comanda-backup.timer`: backup diario.
- `systemd/comanda-maintenance.service` y `comanda-maintenance.timer`: mantenimiento periodico.
- `logrotate/comanda`: rotacion de logs locales.
- `scripts/bootstrap-host.sh`: prepara el host.
- `scripts/deploy-app.sh`: clona/actualiza la app y reinicia servicios.
- `scripts/backup-db.sh`: genera backup y lo sube a S3.
- `scripts/restore-db.sh`: restaura un dump custom de PostgreSQL.
- `scripts/post-deploy-smoke.sh`: smoke basico post deploy.

## Flujo recomendado

1. Ejecutar `scripts/bootstrap-host.sh` en una Ubuntu 22.04 limpia.
2. Copiar archivos `systemd`, `nginx` y `logrotate` a sus destinos.
3. Crear `/opt/comanda/backend/.env` usando `backend/.env.example`.
4. Ejecutar `scripts/deploy-app.sh`.
5. Verificar `systemctl status comanda-backend`.
6. Ejecutar `scripts/post-deploy-smoke.sh` con `BASE_URL`.
7. Probar backup y restore siguiendo `docs/entrega/checklist-backup-restore.md`.

## Convenciones

- App en `/opt/comanda`
- Backend como `www-data`
- Frontend servido desde `/opt/comanda/frontend/dist`
- Uploads en `/opt/comanda/uploads`
- Logs de app en `/opt/comanda/backend/logs`
- Logs operativos complementarios en journald y `/var/log/comanda`
