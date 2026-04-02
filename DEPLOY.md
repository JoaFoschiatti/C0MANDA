# Deploy en AWS EC2

La fuente canonica de despliegue es el pack bajo [ops/ec2/README.md](/C:/Programacion/Comanda/ops/ec2/README.md). Esta pagina resume el flujo y las variables minimas.

## Flujo recomendado

1. Preparar el host con [bootstrap-host.sh](/C:/Programacion/Comanda/ops/ec2/scripts/bootstrap-host.sh).
2. Instalar configuraciones:
   - [nginx/comanda.conf](/C:/Programacion/Comanda/ops/ec2/nginx/comanda.conf)
   - [systemd/comanda-backend.service](/C:/Programacion/Comanda/ops/ec2/systemd/comanda-backend.service)
   - [systemd/comanda-backup.service](/C:/Programacion/Comanda/ops/ec2/systemd/comanda-backup.service)
   - [systemd/comanda-backup.timer](/C:/Programacion/Comanda/ops/ec2/systemd/comanda-backup.timer)
   - [systemd/comanda-maintenance.service](/C:/Programacion/Comanda/ops/ec2/systemd/comanda-maintenance.service)
   - [systemd/comanda-maintenance.timer](/C:/Programacion/Comanda/ops/ec2/systemd/comanda-maintenance.timer)
   - [logrotate/comanda](/C:/Programacion/Comanda/ops/ec2/logrotate/comanda)
3. Crear `/opt/comanda/backend/.env` desde [backend/.env.example](/C:/Programacion/Comanda/backend/.env.example).
4. Reemplazar el dominio placeholder en `nginx/comanda.conf`.
5. La config de nginx arranca con el certificado snakeoil del sistema para permitir `nginx -t` y `certbot --nginx` desde el primer bootstrap.
6. Emitir certificados con `certbot --nginx -d tu-dominio.com`.
7. Ejecutar [deploy-app.sh](/C:/Programacion/Comanda/ops/ec2/scripts/deploy-app.sh).
8. Validar `nginx -t`, `systemctl status comanda-backend` y [post-deploy-smoke.sh](/C:/Programacion/Comanda/ops/ec2/scripts/post-deploy-smoke.sh).
9. Registrar evidencia y checklist final en [docs/entrega](/C:/Programacion/Comanda/docs/entrega).

## Variables minimas de produccion

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=...
PUBLIC_ORDER_JWT_SECRET=...
FRONTEND_URL=https://tu-dominio.com
BACKEND_URL=https://tu-dominio.com
ENCRYPTION_KEY=...
MERCADOPAGO_WEBHOOK_SECRET=...
BRIDGE_TOKEN=...
UPLOADS_DIR=/opt/comanda/uploads
S3_BACKUP_URI=s3://tu-bucket-comanda/backups
AWS_REGION=sa-east-1
```

Si se usa facturacion electronica:

```env
ARCA_CUIT=30XXXXXXXXX
ARCA_CERT_PATH=/etc/comanda/arca/cert.pem
ARCA_KEY_PATH=/etc/comanda/arca/key.pem
ARCA_AMBIENTE=homologacion
ARCA_OPENSSL_BIN=openssl
```

## Codex CLI dentro de EC2

Hay una guia dedicada para correr Codex CLI dentro del servidor y pedirle que ejecute el deploy usando solo el repo local:

- [CODEX-CLI-DEPLOY.md](/C:/Programacion/Comanda/ops/ec2/CODEX-CLI-DEPLOY.md)

## Operacion y handoff

- Manual de operacion: [manual-dueno-operacion.md](/C:/Programacion/Comanda/docs/entrega/manual-dueno-operacion.md)
- Runbook tecnico: [runbook-tecnico.md](/C:/Programacion/Comanda/docs/entrega/runbook-tecnico.md)
- Checklists: [docs/entrega](/C:/Programacion/Comanda/docs/entrega)
- Bridge Windows: [bridge-windows.md](/C:/Programacion/Comanda/docs/entrega/bridge-windows.md)
