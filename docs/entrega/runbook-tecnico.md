# Runbook tecnico

## Despliegue inicial

1. Preparar el host con `ops/ec2/scripts/bootstrap-host.sh`.
2. Instalar configuraciones de `nginx`, `systemd` y `logrotate`.
3. Crear `/opt/comanda/backend/.env`.
4. Ejecutar `ops/ec2/scripts/deploy-app.sh`.
5. Verificar `systemctl status comanda-backend`.

## Redeploy

```bash
sudo REPO_URL=<repo> BRANCH=main /opt/comanda/ops/ec2/scripts/deploy-app.sh
```

## Rotacion de secretos

1. Actualizar `.env` en el host.
2. Si cambia Mercado Pago o ARCA, validar la configuracion desde UI o endpoint correspondiente.
3. Reiniciar backend:
```bash
sudo systemctl restart comanda-backend
```

## Logs y diagnostico

```bash
sudo journalctl -u comanda-backend -n 200 --no-pager
tail -f /opt/comanda/backend/logs/combined.log
tail -f /opt/comanda/backend/logs/error.log
```

## Health y readiness

```bash
curl -fsS https://tu-dominio.com/api/health
curl -fsS https://tu-dominio.com/api/ready
```

`/api/health` confirma liveness. `/api/ready` valida DB, bootstrap del negocio/admin y escritura de directorios criticos.

## Backup y restore

### Backup manual

```bash
sudo -u www-data /opt/comanda/ops/ec2/scripts/backup-db.sh
```

### Restore a una base temporal

```bash
sudo /opt/comanda/ops/ec2/scripts/restore-db.sh s3://bucket/comanda.dump postgresql://...
```

Despues del restore:
1. correr `npx prisma migrate deploy`;
2. validar login, `/menu`, caja y mesas.

## Reconfiguracion de Mercado Pago

1. Completar `MERCADOPAGO_WEBHOOK_SECRET` en `.env`.
2. Cargar Access Token valido desde `Configuracion`.
3. Probar webhook y pago en el ambiente correspondiente.

## Bridge Windows

Variables requeridas:
- `BRIDGE_API_URL`
- `BRIDGE_TOKEN`
- `BRIDGE_ID`
- `PRINTER_NAME`
- `PRINT_ADAPTER`
- `POLL_INTERVAL_MS`

La guia completa esta en `docs/entrega/bridge-windows.md`.
