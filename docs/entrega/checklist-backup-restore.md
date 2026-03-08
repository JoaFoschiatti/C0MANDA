# Checklist de backup y restore

## Backup

- [ ] `S3_BACKUP_URI` configurado
- [ ] `AWS_REGION` configurado
- [ ] `comanda-backup.timer` activo
- [ ] Backup manual exitoso
- [ ] Archivo visible en S3

## Restore drill

- [ ] Crear base temporal
- [ ] Restaurar dump con `restore-db.sh`
- [ ] Ejecutar `npx prisma migrate deploy`
- [ ] Validar `api/health`
- [ ] Validar `api/ready`
- [ ] Validar login admin
- [ ] Validar `/menu`
- [ ] Validar mesas/pedidos
- [ ] Documentar fecha y resultado del drill
