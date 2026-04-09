# Checklist de backup y restore

## Backup

- [ ] `S3_BACKUP_URI` configurado
- [ ] `S3_UPLOADS_BACKUP_URI` configurado o decision explicita de no respaldar `uploads`
- [ ] `AWS_REGION` configurado
- [ ] Politica `ops/ec2/s3-lifecycle-policy.json` aplicada al bucket
- [ ] `comanda-backup.timer` activo
- [ ] Backup manual exitoso
- [ ] Archivo visible en S3
- [ ] Uploads restaurables desde directorio local o S3 si el negocio los utiliza

## Restore drill

- [ ] Crear base temporal
- [ ] Restaurar dump con `restore-db.sh`
- [ ] Ejecutar `restore-drill.sh` sobre esa base temporal
- [ ] Ejecutar `npx prisma migrate deploy`
- [ ] Restaurar `uploads` con `restore-uploads.sh` si corresponde
- [ ] Validar `api/health`
- [ ] Validar `http://127.0.0.1:3001/api/ready`
- [ ] Validar login admin
- [ ] Validar `/menu`
- [ ] Validar mesas/pedidos
- [ ] Documentar fecha y resultado del drill
