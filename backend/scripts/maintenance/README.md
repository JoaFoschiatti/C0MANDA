# Scripts de Mantenimiento - Comanda

Scripts automatizados para la instalacion unica del restaurante.

## Scripts disponibles

### 1. `cleanup-expired-tokens.js`

Limpia refresh tokens expirados o revocados para prevenir crecimiento innecesario de tablas.

**Limpia:**
- Refresh tokens expirados
- Refresh tokens revocados de mas de 30 dias

**Uso:**
```bash
node scripts/maintenance/cleanup-expired-tokens.js
```

**Recomendacion:** Ejecutar diariamente.
```bash
0 2 * * * cd /path/to/backend && node scripts/maintenance/cleanup-expired-tokens.js >> /var/log/comanda/token-cleanup.log 2>&1
```

### 2. `release-stale-print-jobs.js`

Libera trabajos de impresion bloqueados cuando una impresora muere o pierde conexion.

**Funcionamiento:**
- Busca jobs en estado `IMPRIMIENDO` por mas del timeout configurado
- Si no alcanzo max intentos: libera a `PENDIENTE` para reintento
- Si alcanzo max intentos: marca como `ERROR`

**Uso:**
```bash
node scripts/maintenance/release-stale-print-jobs.js
node scripts/maintenance/release-stale-print-jobs.js 10
```

**Recomendacion:** Ejecutar cada 5 minutos.
```bash
*/5 * * * * cd /path/to/backend && node scripts/maintenance/release-stale-print-jobs.js >> /var/log/comanda/print-jobs.log 2>&1
```

## Configuracion de tareas programadas

### Instalacion con cron

```bash
# Comanda - Limpieza de tokens (diario a las 2 AM)
0 2 * * * cd /opt/comanda/backend && node scripts/maintenance/cleanup-expired-tokens.js >> /var/log/comanda/token-cleanup.log 2>&1

# Comanda - Liberar print jobs bloqueados (cada 5 minutos)
*/5 * * * * cd /opt/comanda/backend && node scripts/maintenance/release-stale-print-jobs.js >> /var/log/comanda/print-jobs.log 2>&1
```

Crear directorio de logs:
```bash
sudo mkdir -p /var/log/comanda
sudo chown usuario:usuario /var/log/comanda
```

## Ejecucion manual

```bash
cd /opt/comanda/backend
node scripts/maintenance/cleanup-expired-tokens.js
node scripts/maintenance/release-stale-print-jobs.js
```

## Monitoreo

```bash
tail -f /var/log/comanda/token-cleanup.log
tail -f /var/log/comanda/print-jobs.log
```

## Consideraciones de seguridad

1. Verificar permisos de los scripts y del directorio de logs.
2. Asegurar que `DATABASE_URL` este configurada.
3. Rotar logs periodicamente con `logrotate`.

## Troubleshooting

### Error de conexion a base de datos

1. Verificar que `.env` existe y tiene `DATABASE_URL`
2. Probar conexion:
```bash
cd backend
npx prisma db execute --stdin < /dev/null
```

### Logs no se generan

```bash
ls -ld /var/log/comanda
sudo mkdir -p /var/log/comanda
sudo chown $USER:$USER /var/log/comanda
```
