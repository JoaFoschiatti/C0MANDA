# Instruccion canonica para Codex en EC2

Este es el unico documento que Codex debe usar como instruccion de deploy dentro de la EC2. El objetivo es ejecutar el deploy de produccion desde el repo local en `/opt/comanda`, usando la rama `main` y el flujo oficial del pack `ops/ec2`.

## Prompt exacto para invocar a Codex

Abre `codex` dentro de `/opt/comanda` y dile exactamente esto:

```text
Lee ops/ec2/CODEX-CLI-DEPLOY.md y ejecuta el deploy de produccion siguiendo ese documento. Usa solo el repo local en /opt/comanda, trabaja contra main, no inventes secretos ni dominios y detente si falta algun prerrequisito operativo.
```

## Contexto fijo que Codex debe asumir

- Directorio de trabajo: `/opt/comanda`
- Rama objetivo: `main`
- Fuente de verdad para el deploy: `ops/ec2/`
- El deploy debe usar el flujo oficial del repo, no un flujo alternativo inventado
- Los secretos reales, el dominio, DNS y TLS son prerrequisitos humanos

## Archivos que Codex debe leer antes de ejecutar nada

1. `ops/ec2/README.md`
2. `backend/.env.example`
3. `backend/docs/ENVIRONMENT.md`
4. `ops/ec2/scripts/preflight-production.sh`
5. `ops/ec2/scripts/deploy-app.sh`
6. `ops/ec2/scripts/post-deploy-smoke.sh`
7. `ops/ec2/nginx/comanda.conf`
8. `ops/ec2/systemd/comanda-backend.service`

## Prerrequisitos del host que Codex debe validar

- Ubuntu 24.04 o equivalente compatible
- Acceso shell con `sudo`
- `nginx`, `systemd`, Node 20, `certbot`, `awscli` y `postgresql-client` instalables o ya instalados
- Dominio real apuntando a la IP publica de la EC2
- Repo presente en `/opt/comanda` o permiso explicito para clonarlo ahi
- `/opt/comanda/backend/.env` presente y con secretos reales
- `SMOKE_ADMIN_EMAIL` y `SMOKE_ADMIN_PASSWORD` definidos para el smoke post deploy

Si el host no esta preparado y es el primer deploy, Codex puede usar `ops/ec2/scripts/bootstrap-host.sh`. Si el host ya esta en uso, no debe reinstalar cosas a ciegas sin antes inspeccionar el estado actual.

## Variables obligatorias que Codex debe verificar y por que

- `DATABASE_URL`: la usa la app en runtime para conectarse a PostgreSQL
- `DIRECT_URL`: la usa Prisma para migraciones y operaciones directas
- `JWT_SECRET`: firma tokens del panel interno
- `PUBLIC_ORDER_JWT_SECRET`: firma tokens del flujo publico
- `FRONTEND_URL`: define la URL publica del frontend
- `BACKEND_URL`: define la URL publica del backend
- `HOST`: en produccion debe quedar en `127.0.0.1` para no exponer el backend por fuera de `nginx`
- `ENCRYPTION_KEY`: cifra credenciales sensibles y debe tener 64 hex
- `MERCADOPAGO_WEBHOOK_SECRET`: valida que los webhooks sean legitimos
- `BRIDGE_TOKEN`: autentica el bridge de impresion
- `S3_BACKUP_URI`: destino de backups operativos
- `AWS_REGION`: region para los scripts de backup y restore
- `SMOKE_ADMIN_EMAIL`: usuario real para validar login post deploy
- `SMOKE_ADMIN_PASSWORD`: password real para validar dashboard post deploy
- `ALERT_WEBHOOK_URL` o `SENTRY_DSN`: produccion requiere al menos un sink de alertas

Variables importantes adicionales:

- `UPLOADS_DIR=/opt/comanda/uploads`
- `BRIDGE_REQUIRED=false` hasta que exista una allowlist real del bridge
- `BRIDGE_ALLOWED_IPS` con la IP o rango real del bridge cuando aplique
- `S3_UPLOADS_BACKUP_URI` si tambien se van a respaldar uploads

## Secuencia exacta que Codex debe seguir

1. Ir a `/opt/comanda`.
2. Confirmar que el repo existe y que puede trabajar sobre `main`.
3. Sincronizar el repo:

```bash
git fetch --all --prune
git checkout main
git pull --ff-only origin main
```

4. Leer los archivos canonicos listados arriba.
5. Validar que `/opt/comanda/backend/.env` exista y no tenga placeholders.
6. Si falta cualquier secreto, dominio, DNS o credencial de smoke, detenerse y pedirlo.
7. Si es el primer deploy y faltan paquetes/base del host, ejecutar:

```bash
sudo bash ops/ec2/scripts/bootstrap-host.sh
```

8. Validar que `ops/ec2/nginx/comanda.conf` ya tenga el dominio real en lugar de `comanda.example.com`.
9. Instalar los archivos operativos si faltan o estan desactualizados:
   - `ops/ec2/nginx/comanda.conf` -> `/etc/nginx/sites-available/comanda.conf`
   - `ops/ec2/systemd/*.service` -> `/etc/systemd/system/`
   - `ops/ec2/systemd/*.timer` -> `/etc/systemd/system/`
   - `ops/ec2/logrotate/comanda` -> `/etc/logrotate.d/comanda`
10. Validar el symlink de `nginx` hacia `sites-enabled`.
11. Ejecutar `nginx -t` antes de cualquier reload.
12. Emitir o validar TLS con `certbot --nginx` solo cuando el dominio real ya resuelve correctamente.
13. Ejecutar el preflight oficial:

```bash
sudo APP_DIR=/opt/comanda bash ops/ec2/scripts/preflight-production.sh
```

14. Ejecutar el deploy oficial sin cambiar el flujo:

```bash
sudo APP_DIR=/opt/comanda BRANCH=main bash ops/ec2/scripts/deploy-app.sh
```

15. Recordar que `deploy-app.sh` ya hace esto:
   - instala dependencias
   - ejecuta `npx prisma migrate deploy`
   - corre `npm run db:bootstrap`
   - compila frontend
   - habilita/reinicia servicios
   - valida y recarga `nginx`
   - ejecuta el smoke post deploy
16. Al terminar, validar manualmente:

```bash
curl -fsS https://tu-dominio.com/api/health
curl -fsS http://127.0.0.1:3001/api/ready
curl -fsS https://tu-dominio.com/menu >/dev/null
sudo systemctl --no-pager --full status comanda-backend
sudo systemctl --no-pager --full status comanda-backup.timer
sudo systemctl --no-pager --full status comanda-maintenance.timer
```

## Guardrails obligatorios para Codex

- No resetear ni borrar la base de datos
- No inventar secretos, dominios, IPs ni certificados
- No reemplazar el flujo oficial del repo por comandos manuales alternativos
- No dejar TLS pendiente si el deploy es de produccion publico
- No seguir si `/opt/comanda/backend/.env` falta o tiene placeholders
- No seguir si faltan `SMOKE_ADMIN_EMAIL` o `SMOKE_ADMIN_PASSWORD`
- No seguir si `preflight-production.sh` falla
- No dejar `HOST` distinto de `127.0.0.1` en produccion
- No poner `BRIDGE_REQUIRED=true` si `nginx` sigue con allowlists de ejemplo o `BRIDGE_ALLOWED_IPS` sigue en loopback

## Casos en los que Codex debe detenerse y pedir ayuda

- Falta `backend/.env`
- Faltan secretos o siguen en placeholder
- El dominio no resuelve a la EC2
- `certbot --nginx` no puede emitir o renovar certificados
- El repo local no existe y no se dio `REPO_URL`
- La base parece apuntar a un entorno incorrecto
- El smoke falla por credenciales invalidas o por una regresion real

## Formato de salida que Codex debe entregar al final

El resumen final debe incluir:

- pasos ejecutados
- resultado de `nginx -t`
- estado de `comanda-backend`, `comanda-backup.timer` y `comanda-maintenance.timer`
- confirmacion de migraciones aplicadas
- resultado del smoke post deploy
- checks HTTP aprobados: `/api/health`, `/api/ready`, `/menu`
- riesgos reales pendientes, si existe alguno

## Verificacion humana minima despues del deploy

Si Codex informa exito, valida tambien esto:

```bash
curl -fsS https://tu-dominio.com/api/health
curl -fsS http://127.0.0.1:3001/api/ready
curl -fsS https://tu-dominio.com/menu >/dev/null
sudo systemctl --no-pager --full status comanda-backend
```
