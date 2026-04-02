# Pack EC2 - Comanda

Paquete canonico para desplegar Comanda en una instancia EC2 Ubuntu 22.04 con `nginx`, `systemd`, frontend estatico y backend Node.

## Estructura

- `nginx/comanda.conf`: configuracion de `nginx` para HTTP + HTTPS, SPA, `/api`, `/api/eventos` y `/uploads`.
- `systemd/comanda-backend.service`: backend Node en `production` con `UPLOADS_DIR=/opt/comanda/uploads`.
- `systemd/comanda-backup.service` y `comanda-backup.timer`: backup diario a S3.
- `systemd/comanda-maintenance.service` y `comanda-maintenance.timer`: mantenimiento periodico.
- `logrotate/comanda`: rotacion de logs locales.
- `scripts/bootstrap-host.sh`: prepara el host.
- `scripts/deploy-app.sh`: clona/actualiza la app, corre migraciones, build de frontend y reinicia servicios.
- `scripts/backup-db.sh`: genera backup y lo sube a S3.
- `scripts/restore-db.sh`: restaura un dump custom de PostgreSQL.
- `scripts/post-deploy-smoke.sh`: smoke basico post deploy.
- `CODEX-CLI-DEPLOY.md`: guia operativa para usar Codex CLI dentro de la EC2 y ejecutar el deploy desde el servidor.

## Flujo recomendado

1. Ejecutar `scripts/bootstrap-host.sh` como `root` en una Ubuntu 22.04 limpia.
2. Clonar el repo en `/opt/comanda` o definir `REPO_URL` para `scripts/deploy-app.sh`.
3. Copiar archivos a sus destinos:
   - `nginx/comanda.conf` -> `/etc/nginx/sites-available/comanda.conf`
   - `systemd/*.service` -> `/etc/systemd/system/`
   - `systemd/*.timer` -> `/etc/systemd/system/`
   - `logrotate/comanda` -> `/etc/logrotate.d/comanda`
4. Crear el symlink de nginx:
   - `ln -s /etc/nginx/sites-available/comanda.conf /etc/nginx/sites-enabled/comanda.conf`
5. Editar `nginx/comanda.conf` y reemplazar `comanda.example.com` por el dominio real.
6. Crear `/opt/comanda/backend/.env` desde `backend/.env.example` y completar secretos reales.
7. Mantener `UPLOADS_DIR=/opt/comanda/uploads` en el `.env` o dejar que lo fuerce el servicio `systemd`.
8. La config de nginx arranca con el certificado snakeoil del sistema para permitir `nginx -t` y `certbot --nginx` desde el primer deploy.
9. Emitir certificados TLS con Let's Encrypt:
   - `certbot --nginx -d tu-dominio.com`
10. Verificar la configuracion:
   - `nginx -t`
   - `systemctl daemon-reload`
11. Ejecutar `scripts/deploy-app.sh`.
12. Correr `scripts/post-deploy-smoke.sh` con `BASE_URL=https://tu-dominio.com`.
13. Probar backup y restore siguiendo `docs/entrega/checklist-backup-restore.md`.

## Convenciones

- App en `/opt/comanda`
- Backend como `www-data`
- Frontend servido desde `/opt/comanda/frontend/dist`
- Uploads persistentes en `/opt/comanda/uploads`
- Logs de app en `/opt/comanda/backend/logs`
- Logs operativos complementarios en journald y `/var/log/comanda`

## Validaciones minimas

- `systemctl status comanda-backend`
- `systemctl status comanda-backup.timer`
- `systemctl status comanda-maintenance.timer`
- `curl -fsS https://tu-dominio.com/api/health`
- `curl -fsS https://tu-dominio.com/api/ready`
- `curl -fsS https://tu-dominio.com/menu`

## Codex CLI en la EC2

Si queres que Codex ejecute el deploy desde la propia instancia, usa la guia dedicada:

- [CODEX-CLI-DEPLOY.md](/C:/Programacion/Comanda/ops/ec2/CODEX-CLI-DEPLOY.md)
