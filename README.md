# Comanda

Sistema de gestion para un restaurante unico, desplegado como instalacion dedicada. La aplicacion opera mesas, cocina, caja, delivery/retiro, menu publico y configuracion del negocio sin logica SaaS en runtime.

## Alcance actual

- Restaurante unico sin multi-tenant ni propietarios por entidad.
- Menu publico canonico en `/menu`.
- QR por mesa en `/menu/mesa/:qrToken`.
- Flujo de salon: `OCUPADA -> ESPERANDO_CUENTA -> CERRADA -> LIBRE`.
- Pagos en caja, checkout web y QR presencial de Mercado Pago.
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
- Infraestructura objetivo: AWS EC2 + Nginx + systemd

## Desarrollo local

### Backend

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

## Variables de entorno clave

Ver [backend/.env.example](/C:/Programacion/Comanda/backend/.env.example).

Las mas importantes para un ambiente productivo son:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `ENCRYPTION_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `ARCA_CUIT`
- `ARCA_CERT_PATH`
- `ARCA_KEY_PATH`
- `BRIDGE_TOKEN`
- `S3_BACKUP_URI`
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
- `POST /api/pagos/qr/orden`
- `POST /api/pagos/webhook/mercadopago`
- `POST /api/facturacion/comprobantes`
- `GET /api/facturacion/comprobantes/:id`
- `PUT /api/facturacion/configuracion`

## Produccion

La guia operativa esta en [DEPLOY.md](/C:/Programacion/Comanda/DEPLOY.md). El pack ejecutable esta en [ops/ec2/README.md](/C:/Programacion/Comanda/ops/ec2/README.md). El handoff de entrega esta en [docs/entrega](/C:/Programacion/Comanda/docs/entrega). El escenario objetivo es:

- EC2 Linux como host principal.
- Nginx sirviendo frontend y actuando como reverse proxy del backend.
- Node.js administrado con systemd.
- PostgreSQL del ambiente actual.
- Backups diarios con `pg_dump` a S3 y prueba periodica de restore.
- `openssl`, certificado y clave privada disponibles en el host para WSAA/WSFEv1.

## Notas

- La facturacion electronica requiere credenciales WSAA/WSFEv1 reales del restaurante para emitir CAE.
- El QR presencial requiere Access Token valido de Mercado Pago y `external_pos_id` configurado.
- La entrega operativa incluye health `/api/health`, readiness `/api/ready`, pack EC2, checklist de release y manuales bajo `docs/entrega`.
