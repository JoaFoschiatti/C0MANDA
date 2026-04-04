# Variables de Entorno - Comanda Backend

Guia resumida para la instalacion unica en EC2.

## Requeridas

- `DATABASE_URL`: conexion PostgreSQL usada por la app.
- `DIRECT_URL`: conexion directa para Prisma y migraciones.
- `JWT_SECRET`: secreto para JWT.
- `PUBLIC_ORDER_JWT_SECRET`: secreto dedicado a tokens publicos de pedido.
- `ENCRYPTION_KEY`: clave AES-256 en hex para credenciales cifradas.
- `FRONTEND_URL`: URL publica del frontend.
- `BACKEND_URL`: URL publica del backend.
- `.env.test` opcional: si existe, los tests backend lo cargan por encima de `.env`.

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
- `S3_UPLOADS_BACKUP_URI`: prefijo S3 opcional para sincronizar `UPLOADS_DIR` junto al backup diario.
- `AWS_REGION`: region AWS del host EC2.

## Opcionales

- `PORT`: default `3001`.
- `NODE_ENV`: `development`, `test` o `production`.
- `UPLOADS_DIR`: directorio absoluto o relativo para archivos servidos en `/uploads`. En EC2 se recomienda `/opt/comanda/uploads`.
- `PUBLIC_ORDER_TOKEN_EXPIRES_IN`: expiracion de tokens publicos de pedido.
- `PUBLIC_ORDERING_PAUSED`: pausa pedidos online publicos sin apagar la API.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: notificaciones por email.
- `SKIP_WEBHOOK_VERIFICATION`: solo para testing local.
- `ARCA_OPENSSL_BIN`: ruta al binario de openssl si no esta en PATH.

## Produccion en EC2

- Servir frontend detras de Nginx.
- Ejecutar backend Node con `systemd`.
- Guardar secretos en AWS Secrets Manager o variables del sistema.
- Terminar TLS en `nginx` con Certbot/Let's Encrypt.
- Usar `UPLOADS_DIR=/opt/comanda/uploads` para desacoplar archivos subidos del arbol del backend.
- No usar valores de desarrollo en produccion.

## Validaciones minimas

- `FRONTEND_URL` debe apuntar al dominio real.
- `BACKEND_URL` debe apuntar al dominio real.
- `ENCRYPTION_KEY` debe tener 64 caracteres hex.
- `JWT_SECRET` debe tener al menos 32 caracteres.
- `PUBLIC_ORDER_JWT_SECRET` debe tener al menos 32 caracteres.
- `BRIDGE_TOKEN` debe tener al menos 16 caracteres.
- `MERCADOPAGO_WEBHOOK_SECRET` debe estar configurado si se usan pagos online.
- `SKIP_WEBHOOK_VERIFICATION` no debe estar en `true` en produccion.
- Si se carga `ARCA_CUIT`, tambien deben existir `ARCA_CERT_PATH` y `ARCA_KEY_PATH`.

## Entorno de tests

- Copiar `.env.test.example` a `.env.test` para aislar Jest en un schema dedicado, por ejemplo `?schema=test`.
- Alternativamente, definir `DATABASE_URL` y `DIRECT_URL` en el entorno o en CI. Si se usa archivo alternativo, exportar `TEST_ENV_FILE=./ruta/al/env`.
- `npm run db:reset:test` resetea ese schema con la baseline actual sin tocar `public`.
