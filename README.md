# Comanda

Sistema de gestion para un restaurante unico, desplegado como instalacion dedicada. La aplicacion opera mesas, cocina, caja, delivery/retiro, menu publico y configuracion del negocio sin logica SaaS en runtime.

## Alcance actual

- Restaurante unico sin multi-tenant ni propietarios por entidad.
- Menu publico canonico en `/menu`.
- QR por mesa en `/menu/mesa/:qrToken`.
- Flujo de salon: `OCUPADA -> ESPERANDO_CUENTA -> CERRADA -> LIBRE`.
- Pagos en caja, checkout web y transferencias manuales por alias de Mercado Pago.
- Facturacion electronica persistida en BD con configuracion de punto de venta y comprobantes pendientes hasta contar con credenciales ARCA del ambiente.

## Abono mensual

El abono mensual de mantenimiento no se cobra ni se controla desde la app.

- Referencia contractual: equivalente en ARS a USD 60.
- Inicio: 30 dias despues de la aceptacion escrita en produccion.
- Calculo: cotizacion vendedor Banco Nacion del dia habil anterior.
- Operacion: factura o link externo y registro administrativo fuera del runtime del restaurante.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- ORM: Prisma
- Pagos: Mercado Pago
- Infraestructura objetivo: AWS EC2 + Nginx + systemd sobre Ubuntu 24.04 amd64

## Desarrollo local

### Flujo recomendado

```bash
copy backend\.env.example backend\.env
npm run setup
npm run dev
```

Este flujo asume:

- PostgreSQL instalado y corriendo localmente.
- `backend/.env` configurado con credenciales validas.
- Arranque desde la raiz del repo.

`npm run dev` orquesta el backend y el frontend en este orden:

1. prepara Prisma (`db:generate`, `db:deploy`);
2. ejecuta `db:bootstrap`;
3. levanta la API;
4. espera a que `http://127.0.0.1:3001/api/ready` responda `200`;
5. recien entonces levanta Vite.

Asi se evita que Vite empiece a proxyear requests a `/api` antes de que el backend exista.

### Backend manual

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate reset --force --skip-seed
npx prisma generate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Si ejecutas solo el frontend, Vite seguira mostrando `http proxy error` mientras el backend no este levantado en `http://localhost:3001`, porque `/api` y `/uploads` dependen del proxy de desarrollo.

## Variables de entorno clave

Ver [backend/.env.example](./backend/.env.example).

Las mas importantes para un ambiente productivo son:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `PUBLIC_ORDER_JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `ENCRYPTION_KEY`
- `MFA_ISSUER`
- `MFA_TRUSTED_DEVICE_DAYS`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `ARCA_CUIT`
- `ARCA_CERT_PATH`
- `ARCA_KEY_PATH`
- `BRIDGE_TOKEN`
- `BRIDGE_ALLOWED_IPS`
- `BRIDGE_SIGNATURE_TTL_SECONDS`
- `S3_BACKUP_URI`
- `S3_UPLOADS_BACKUP_URI`
- `AWS_REGION`

## Endpoints principales

- `GET /api/negocio`
- `PUT /api/negocio`
- `POST /api/mesas/:id/precuenta`
- `POST /api/mesas/:id/liberar`
- `POST /api/pedidos/:id/cerrar`
- `GET /api/publico/menu`
- `GET /api/publico/mesa/:qrToken`
- `POST /api/publico/mesa/:qrToken/pedido`
- `GET /api/pagos/mercadopago/transferencia-config`
- `POST /api/pagos/webhook/mercadopago`
- `POST /api/facturacion/comprobantes`
- `GET /api/facturacion/comprobantes/:id`
- `PUT /api/facturacion/configuracion`

## Produccion

La guia operativa esta en [DEPLOY.md](./DEPLOY.md). El pack ejecutable esta en [ops/ec2/README.md](./ops/ec2/README.md). Hay una guia dedicada para ejecutar deploys desde la propia EC2 con Codex CLI en [ops/ec2/CODEX-CLI-DEPLOY.md](./ops/ec2/CODEX-CLI-DEPLOY.md). El handoff de entrega esta en [docs/entrega](./docs/entrega). El escenario objetivo es:

- EC2 Ubuntu 24.04 amd64 como host principal.
- Si se usan opciones gratuitas de AWS, el host recomendado es `t3.micro`; `t3.small` solo como alivio temporal si el primer deploy queda justo de RAM.
- Nginx sirviendo frontend y actuando como unico borde publico del backend.
- Node.js administrado con systemd.
- PostgreSQL del ambiente actual.
- `3001` y `5432` no deben exponerse a internet; solo `80/443`.
- Backups diarios con `pg_dump` a S3 y prueba periodica de restore.
- Backup opcional y versionado de `uploads` a S3 cuando el negocio guarda imagenes o archivos.
- `openssl`, certificado y clave privada disponibles en el host para WSAA/WSFEv1.

## Notas

- La facturacion electronica requiere credenciales WSAA/WSFEv1 reales del restaurante para emitir CAE.
- El checkout web de Mercado Pago requiere Access Token valido y la cuenta conectada del local.
- El POS puede mostrar alias, titular y CVU configurados para registrar transferencias manuales.
- La entrega operativa incluye health publico en `/api/health` y readiness local en `http://127.0.0.1:3001/api/ready`, ademas del pack EC2, checklist de release y manuales bajo `docs/entrega`.
