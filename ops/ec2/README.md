# Pack EC2 - Comanda

Esta carpeta es la fuente canonica del deploy en EC2. Hay dos recorridos oficiales:

- Deploy humano paso a paso: este archivo
- Deploy asistido por Codex dentro de la EC2: [CODEX-CLI-DEPLOY.md](./CODEX-CLI-DEPLOY.md)

## Que incluye este pack

- `nginx/comanda.conf`: proxy, TLS inicial, SPA, `/api`, `/api/eventos` y `/uploads`
- `systemd/comanda-backend.service`: backend Node en `production` con `HOST=127.0.0.1`
- `systemd/comanda-backup.service` y `comanda-backup.timer`: backup diario
- `systemd/comanda-maintenance.service` y `comanda-maintenance.timer`: mantenimiento periodico
- `logrotate/comanda`: rotacion de logs locales
- `scripts/bootstrap-host.sh`: prepara un host limpio
- `scripts/preflight-production.sh`: valida `.env`, placeholders, alertas, bridge y backup antes del deploy
- `scripts/deploy-app.sh`: actualiza el repo, aplica migraciones, compila frontend, reinicia servicios y corre smoke
- `scripts/post-deploy-smoke.sh`: smoke Playwright post deploy
- `scripts/restore-drill.sh`: restore no destructivo sobre una base temporal
- `scripts/notify-failure.sh`: alertas operativas para backend, backup, maintenance y smoke
- `s3-lifecycle-policy.json`: politica base de retencion S3

## Flujo humano recomendado

1. Preparar el host con `sudo bash ops/ec2/scripts/bootstrap-host.sh` si es una EC2 nueva.
2. Instalar configuraciones:
   - `ops/ec2/nginx/comanda.conf` -> `/etc/nginx/sites-available/comanda.conf`
   - `ops/ec2/systemd/*.service` -> `/etc/systemd/system/`
   - `ops/ec2/systemd/*.timer` -> `/etc/systemd/system/`
   - `ops/ec2/logrotate/comanda` -> `/etc/logrotate.d/comanda`
3. Crear el symlink de `nginx` en `sites-enabled`.
4. Reemplazar `comanda.example.com` por el dominio real en `nginx/comanda.conf`.
5. Crear `/opt/comanda/backend/.env` desde [`../../backend/.env.example`](../../backend/.env.example).
6. Completar secretos y variables guiandote por [`../../backend/docs/ENVIRONMENT.md`](../../backend/docs/ENVIRONMENT.md).
7. Confirmar `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `ALERT_WEBHOOK_URL` o `SENTRY_DSN`, `HOST=127.0.0.1` y `UPLOADS_DIR=/opt/comanda/uploads`.
8. Validar `nginx -t`.
9. Emitir o renovar TLS con `certbot --nginx -d tu-dominio.com`.
10. Correr el preflight oficial:

```bash
sudo APP_DIR=/opt/comanda bash ops/ec2/scripts/preflight-production.sh
```

11. Ejecutar el deploy oficial:

```bash
sudo APP_DIR=/opt/comanda BRANCH=main bash ops/ec2/scripts/deploy-app.sh
```

12. Verificar:
   - `systemctl --no-pager --full status comanda-backend`
   - `systemctl --no-pager --full status comanda-backup.timer`
   - `systemctl --no-pager --full status comanda-maintenance.timer`
   - `curl -fsS https://tu-dominio.com/api/health`
   - `curl -fsS http://127.0.0.1:3001/api/ready`
   - `curl -fsS https://tu-dominio.com/menu`

## Reglas operativas importantes

- No expongas el backend directo a internet; en produccion debe quedar detras de `nginx` con `HOST=127.0.0.1`.
- No publiques con placeholders en `.env`; `preflight-production.sh` ya falla si los encuentra.
- `deploy-app.sh` ya corre `npx prisma migrate deploy`; no hace falta una migracion manual extra.
- `deploy-app.sh` ya corre `post-deploy-smoke.sh`; si el smoke falla, el deploy debe considerarse fallido.
- `/api/ready` se valida por loopback, no de forma publica.
- Si el bridge de impresion forma parte del alcance, reemplaza las allowlists de ejemplo en `nginx/comanda.conf` y completa `BRIDGE_ALLOWED_IPS`.

## Operacion y handoff

- Deploy con Codex dentro de la EC2: [CODEX-CLI-DEPLOY.md](./CODEX-CLI-DEPLOY.md)
- Runbook tecnico: [`../../docs/entrega/runbook-tecnico.md`](../../docs/entrega/runbook-tecnico.md)
- Checklist de preproduccion: [`../../docs/entrega/checklist-preproduccion.md`](../../docs/entrega/checklist-preproduccion.md)
- Checklist de puesta en produccion: [`../../docs/entrega/checklist-puesta-en-produccion.md`](../../docs/entrega/checklist-puesta-en-produccion.md)
- Checklist de backup y restore: [`../../docs/entrega/checklist-backup-restore.md`](../../docs/entrega/checklist-backup-restore.md)
- Politica de retencion S3: [`../../docs/entrega/politica-retencion-s3.md`](../../docs/entrega/politica-retencion-s3.md)
