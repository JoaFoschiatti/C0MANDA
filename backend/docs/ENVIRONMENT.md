# Variables de Entorno - Comanda Backend

Guia resumida para la instalacion unica en EC2.

## Requeridas

- `DATABASE_URL`: conexion PostgreSQL usada por la app.
- `DIRECT_URL`: conexion directa para Prisma y migraciones.
- `JWT_SECRET`: secreto para JWT.
- `ENCRYPTION_KEY`: clave AES-256 en hex para credenciales cifradas.
- `FRONTEND_URL`: URL publica del frontend.

## Mercado Pago

- `MERCADOPAGO_WEBHOOK_SECRET`: valida webhooks.
- `MP_APP_ID`: app id de Mercado Pago.
- `MP_APP_SECRET`: app secret de Mercado Pago.

Estas credenciales son globales para la instalacion; no existe configuracion por instalacion.

## Impresion local

- `BRIDGE_TOKEN`: autenticacion del bridge de impresion.
- `PRINT_WIDTH_MM`
- `PRINT_MAX_RETRIES`
- `PRINT_BACKOFF_MS`
- `PRINT_CLAIM_TTL_MS`

## Backups operativos

- `S3_BACKUP_URI`: bucket o prefijo destino para backups diarios.
- `AWS_REGION`: region AWS del host EC2.

## Opcionales

- `PORT`: default `3001`.
- `NODE_ENV`: `development`, `test` o `production`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: notificaciones por email.
- `SKIP_WEBHOOK_VERIFICATION`: solo para testing local.
- `ARCA_OPENSSL_BIN`: ruta al binario de openssl si no esta en PATH.

## Produccion en EC2

- Servir frontend detras de Nginx.
- Ejecutar backend Node con `systemd` o PM2.
- Guardar secretos en AWS Secrets Manager o variables del sistema.
- No usar valores de desarrollo en produccion.

## Validaciones minimas

- `FRONTEND_URL` debe apuntar al dominio real.
- `BACKEND_URL` debe apuntar al dominio real.
- `ENCRYPTION_KEY` debe tener 64 caracteres hex.
- `JWT_SECRET` debe tener al menos 32 caracteres.
- `BRIDGE_TOKEN` debe tener al menos 16 caracteres.
- `MERCADOPAGO_WEBHOOK_SECRET` debe estar configurado si se usan pagos online.
- `SKIP_WEBHOOK_VERIFICATION` no debe estar en `true` en produccion.
- Si se carga `ARCA_CUIT`, tambien deben existir `ARCA_CERT_PATH` y `ARCA_KEY_PATH`.
