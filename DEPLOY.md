# Deploy en AWS EC2

Esta pagina es solo un indice. La fuente canonica del deploy vive en `ops/ec2/`.

## Rutas oficiales

- Deploy manual humano: [ops/ec2/README.md](./ops/ec2/README.md)
- Deploy asistido por Codex dentro de la EC2: [ops/ec2/CODEX-CLI-DEPLOY.md](./ops/ec2/CODEX-CLI-DEPLOY.md)
- Variables de entorno y secretos: [backend/docs/ENVIRONMENT.md](./backend/docs/ENVIRONMENT.md)
- Ejemplo de `.env`: [backend/.env.example](./backend/.env.example)

## Checklist de salida

- Preproduccion: [docs/entrega/checklist-preproduccion.md](./docs/entrega/checklist-preproduccion.md)
- Puesta en produccion: [docs/entrega/checklist-puesta-en-produccion.md](./docs/entrega/checklist-puesta-en-produccion.md)
- Backup y restore: [docs/entrega/checklist-backup-restore.md](./docs/entrega/checklist-backup-restore.md)
- Runbook tecnico: [docs/entrega/runbook-tecnico.md](./docs/entrega/runbook-tecnico.md)
- Politica de retencion S3: [docs/entrega/politica-retencion-s3.md](./docs/entrega/politica-retencion-s3.md)

## Nota importante

Para produccion, usa siempre el flujo oficial del repo:

1. preparar host y archivos de `nginx/systemd`;
2. completar `/opt/comanda/backend/.env`;
3. correr `ops/ec2/scripts/preflight-production.sh`;
4. ejecutar `ops/ec2/scripts/deploy-app.sh`;
5. validar health, readiness por loopback y servicios; `deploy-app.sh` ya corre el smoke post-deploy.
