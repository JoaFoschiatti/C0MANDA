# Checklist de puesta en produccion

- [ ] Ejecutar `ops/ec2/scripts/deploy-app.sh`
- [ ] Confirmar `systemctl status comanda-backend`
- [ ] Confirmar `systemctl list-timers | grep comanda`
- [ ] Confirmar `curl /api/health`
- [ ] Confirmar `curl /api/ready`
- [ ] Abrir `/menu`
- [ ] Login admin operativo
- [ ] Flujo de mesas y pedidos validado
- [ ] Impresion validada si corresponde
- [ ] Webhook de Mercado Pago validado
- [ ] Si ARCA esta habilitado, emitir en homologacion
- [ ] Ejecutar `ops/ec2/scripts/post-deploy-smoke.sh`
