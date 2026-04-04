# Checklist de preproduccion

- [ ] `backend/.env` completo para produccion
- [ ] `JWT_SECRET` >= 32 caracteres
- [ ] `ENCRYPTION_KEY` de 64 hex
- [ ] `FRONTEND_URL` y `BACKEND_URL` apuntando al dominio real
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` configurado
- [ ] `BRIDGE_TOKEN` configurado
- [ ] Access Token de Mercado Pago cargado si aplica
- [ ] Credenciales ARCA listas si la entrega incluye facturacion real
- [ ] Nginx configurado
- [ ] Servicios `systemd` instalados
- [ ] Timers de backup y mantenimiento instalados
- [ ] Logs y uploads con permisos de `www-data`
- [ ] `S3_UPLOADS_BACKUP_URI` configurado o politica explicita para respaldar `uploads`
- [ ] Ejecutar `ops/ec2/scripts/preflight-production.sh`
