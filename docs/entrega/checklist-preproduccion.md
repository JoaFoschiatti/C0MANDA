# Checklist de preproduccion

Referencia canonica de deploy:

- guia humana: [`../../ops/ec2/README.md`](../../ops/ec2/README.md)
- deploy con Codex en EC2: [`../../ops/ec2/CODEX-CLI-DEPLOY.md`](../../ops/ec2/CODEX-CLI-DEPLOY.md)

- [ ] `backend/.env` completo para produccion
- [ ] `JWT_SECRET` >= 32 caracteres
- [ ] `ENCRYPTION_KEY` de 64 hex
- [ ] `FRONTEND_URL` y `BACKEND_URL` apuntando al dominio real
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` configurado
- [ ] `BRIDGE_TOKEN` configurado
- [ ] `HOST=127.0.0.1` en produccion o fijado por `systemd`
- [ ] `SMOKE_ADMIN_EMAIL` y `SMOKE_ADMIN_PASSWORD` disponibles para el smoke post deploy
- [ ] `ALERT_WEBHOOK_URL` o `SENTRY_DSN` configurado
- [ ] Access Token de Mercado Pago cargado si aplica
- [ ] Credenciales ARCA listas si la entrega incluye facturacion real
- [ ] Nginx configurado
- [ ] Servicios `systemd` instalados
- [ ] Timers de backup y mantenimiento instalados
- [ ] Logs y uploads con permisos de `www-data`
- [ ] `S3_UPLOADS_BACKUP_URI` configurado o politica explicita para respaldar `uploads`
- [ ] Politica de lifecycle S3 versionada aplicada si el bucket respalda dumps/uploads
- [ ] Preflight operativo validado siguiendo la guia canonica de `ops/ec2`
