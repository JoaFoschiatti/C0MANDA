# Checklist de puesta en produccion

Seguir primero el flujo canonico de [`../../ops/ec2/README.md`](../../ops/ec2/README.md) o, si despliegas desde la propia EC2 con Codex, [`../../ops/ec2/CODEX-CLI-DEPLOY.md`](../../ops/ec2/CODEX-CLI-DEPLOY.md).

- [ ] Deploy ejecutado con el flujo oficial del repo
- [ ] Confirmar `systemctl status comanda-backend`
- [ ] Confirmar `systemctl list-timers | grep comanda`
- [ ] Confirmar `curl /api/health`
- [ ] Confirmar `curl http://127.0.0.1:3001/api/ready`
- [ ] Abrir `/menu`
- [ ] Login admin operativo
- [ ] Flujo de mesas y pedidos validado
- [ ] Impresion validada si corresponde
- [ ] Webhook de Mercado Pago validado
- [ ] Si ARCA esta habilitado, emitir en homologacion
- [ ] Validar backup de base y restore de `uploads` si corresponde
- [ ] Confirmar que `deploy-app.sh` completo el smoke post-deploy sin fallar
- [ ] Confirmar `HOST=127.0.0.1` en el backend de produccion
- [ ] Confirmar `ALERT_WEBHOOK_URL` o `SENTRY_DSN`
- [ ] Confirmar `BRIDGE_REQUIRED` y allowlist real si la impresion forma parte del alcance
