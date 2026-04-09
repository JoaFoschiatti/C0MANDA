# Runbook tecnico

## Despliegue inicial

La ruta canonica de deploy ya no vive en este archivo. Para desplegar:

- guia humana: [`../../ops/ec2/README.md`](../../ops/ec2/README.md)
- deploy asistido por Codex: [`../../ops/ec2/CODEX-CLI-DEPLOY.md`](../../ops/ec2/CODEX-CLI-DEPLOY.md)

Este runbook queda para operacion, redeploy, diagnostico y recovery.

## Redeploy

```bash
cd /opt/comanda
git fetch --all --prune
git checkout main
git pull --ff-only origin main
sudo APP_DIR=/opt/comanda BRANCH=main bash /opt/comanda/ops/ec2/scripts/deploy-app.sh
```

El deploy ya ejecuta el smoke Playwright post deploy y falla si no pasa. Para correrlo a mano:

```bash
APP_DIR=/opt/comanda BASE_URL=https://tu-dominio.com /opt/comanda/ops/ec2/scripts/post-deploy-smoke.sh
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
curl -fsS http://127.0.0.1:3001/api/ready
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

Para un restore drill no destructivo:

```bash
sudo env DATABASE_URL=postgresql://usuario:password@127.0.0.1:5432/comanda?schema=public \
  /opt/comanda/ops/ec2/scripts/restore-drill.sh s3://bucket/comanda.dump http://127.0.0.1:3001/api/ready
```

### Restore de uploads

```bash
sudo AWS_REGION=sa-east-1 bash /opt/comanda/ops/ec2/scripts/restore-uploads.sh s3://bucket/uploads/2026-04-02-120000 /opt/comanda/uploads
```

Despues del restore:
1. correr `npx prisma migrate deploy`;
2. validar login, `/menu`, caja y mesas.
3. aplicar o revisar [la politica S3 versionada](./politica-retencion-s3.md) si el bucket quedo sin lifecycle.

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
