# Auditoria inicial de fraude operativo externo en EC2

Fecha: 2026-04-02

## Resumen ejecutivo

Esta auditoria revisa como un actor externo podria abusar del sistema para causar fraude operativo o degradacion de procesos en la instalacion EC2 declarada en el repo. El foco estuvo en:

- pedidos publicos y pagos web;
- webhook y configuracion de Mercado Pago;
- login y sesiones de operadores;
- bridge de impresion;
- borde publico Nginx/EC2.

La revision se hizo sobre el codigo y la IaC declarada en el repo. No se ejecutaron cambios de comportamiento. Tampoco se pudo correr `npm audit` ni tests locales en esta sesion porque `npm` no esta disponible en `PATH`, y no hubo acceso SSH a una instancia EC2 real.

## Controles ya presentes

Se validaron controles que reducen parte de la superficie:

- Cookies de sesion `httpOnly`, `secure` en produccion y `sameSite: 'strict'` en [backend/src/controllers/auth.controller.js](../../backend/src/controllers/auth.controller.js).
- CORS cerrado a `FRONTEND_URL` y `helmet` activo en [backend/src/app.js](../../backend/src/app.js).
- Rate limiting de aplicacion para login, pedido publico y reintentos de pago en [backend/src/routes/auth.routes.js](../../backend/src/routes/auth.routes.js) y [backend/src/routes/publico.routes.js](../../backend/src/routes/publico.routes.js).
- Verificacion HMAC del webhook de Mercado Pago en [backend/src/controllers/pagos.controller.js](../../backend/src/controllers/pagos.controller.js).
- Validacion de secretos minimos en produccion en [backend/src/config/runtime.js](../../backend/src/config/runtime.js).
- Tipado y validacion de payloads con Zod en rutas publicas y administrativas.

Estos controles ayudan, pero no cierran los vectores detallados mas abajo.

## Mapa de superficie expuesta

| Superficie | Auth actual | Exposicion declarada | Valor para un atacante |
| --- | --- | --- | --- |
| `/api/publico/config`, `/api/publico/menu`, `/api/publico/pedido*` | Publica o token publico | Proxy general `/api/` en Nginx | Crear pedidos, consultar estados, reintentar pagos |
| `/api/pagos/webhook/mercadopago` | HMAC de proveedor | Publica via `/api/` | Alterar conciliacion, forzar side effects, ruido operativo |
| `/api/mercadopago/oauth/callback` | `state` firmado | Publica via `/api/` | Rebinding de cuenta MP si el flujo queda mal atado |
| `/api/auth/login` | Publica | Publica via `/api/` | Credential stuffing contra admin/cajero |
| `/api/impresion/jobs/claim|ack|fail` | `BRIDGE_TOKEN` estatico | Publica via `/api/` | Sabotear cocina/caja si el secreto se filtra |
| `/api/ready` | Publica | Publica via `/api/` | Recon de estado interno del sistema |
| `/uploads/` | Publica | Alias directo Nginx + `express.static` | Exposicion de branding e imagenes subidas |

## Matriz de hallazgos

| ID | Severidad | Hallazgo | Impacto principal |
| --- | --- | --- | --- |
| H-01 | Alta | El token de acceso del pedido publico se expone en respuesta, URL y `localStorage` | Reuso del token, consulta de pedidos ajenos y reintentos de pago desde equipos compartidos o links filtrados |
| H-02 | Alta | El bridge de impresion queda expuesto a internet y depende de un secreto estatico compartido | Sabotaje de impresion si `BRIDGE_TOKEN` se filtra desde la PC Windows o un wrapper de servicio |
| H-03 | Alta | El login sigue siendo vulnerable a credential stuffing distribuido y no hay MFA para roles criticos | Toma de cuenta de admin/cajero y fraude operativo completo |
| H-04 | Media | El `state` OAuth de Mercado Pago es reutilizable y no queda atado al admin que inicio el flujo | Riesgo de rebinding o confused deputy si el `state` se filtra o en ambientes mal configurados |
| H-05 | Media | El webhook de Mercado Pago no es completamente idempotente para side effects | Reenvio de emails, repeticion de eventos y ruido operativo ante replays validos |
| H-06 | Media | Falta endurecimiento de borde en Nginx/EC2 para flujos sensibles | Mas margen para abuso distribuido, recon y exposicion innecesaria |

## Hallazgos detallados

### H-01 - Token de pedido publico expuesto en respuesta, URL y `localStorage`

- Severidad: Alta
- Vector: pedidos publicos + retorno de Mercado Pago
- Impacto: quien obtenga el token puede consultar `/api/publico/pedido/:id` y reintentar `/api/publico/pedido/:id/pagar` para ese pedido. No necesita sesion de operador.
- Precondiciones: acceso al navegador compartido, historial, captura de pantalla, soporte remoto, logs del frontend o cualquier canal que vea la URL o `localStorage`.

**Evidencia**

- El backend devuelve `accessToken` al crear el pedido en [backend/src/routes/publico.routes.js](../../backend/src/routes/publico.routes.js).
- El retorno de Mercado Pago mete `token` en la query string en [backend/src/services/publico.service.js](../../backend/src/services/publico.service.js).
- El frontend persiste ese token en `localStorage` y vuelve a anexarlo a URLs en [frontend/src/utils/public-storage.js](../../frontend/src/utils/public-storage.js).
- Existe ademas un secreto por defecto para tokens publicos fuera de produccion en [backend/src/utils/public-order-access.js](../../backend/src/utils/public-order-access.js).

**Lineas relevantes**

- `backend/src/routes/publico.routes.js:184-190`
- `backend/src/services/publico.service.js:121-162`
- `frontend/src/utils/public-storage.js:14-32`
- `frontend/src/utils/public-storage.js:74-82`
- `backend/src/utils/public-order-access.js:4-7`

**Reproduccion**

1. Crear un pedido publico con Mercado Pago.
2. Observar que la respuesta `201` incluye `accessToken`.
3. Completar el redirect de retorno y verificar que `/menu?...&token=...` queda en la barra de direccion.
4. Verificar que `mp_pedido_pendiente` persiste `accessToken` en `localStorage`.
5. Desde otra sesion o equipo con ese token, invocar:
   - `GET /api/publico/pedido/:id?token=...`
   - `POST /api/publico/pedido/:id/pagar` con `{"token":"..."}`

**Remediacion**

- Mover el token publico fuera de la URL.
- Evitar `localStorage` para ese token; usar almacenamiento efimero en memoria o cookie de vida corta con alcance acotado.
- Hacer el token de un solo uso para iniciar pago, o separar token de lectura y token de reintento de pago.
- Eliminar secretos por defecto para ambientes expuestos, incluso no productivos.

### H-02 - Endpoints del bridge expuestos a internet con secreto estatico compartido

- Severidad: Alta
- Vector: `/api/impresion/jobs/*`
- Impacto: si `BRIDGE_TOKEN` se filtra desde la PC Windows, un atacante remoto puede reclamar jobs, marcarlos como `OK` o `ERROR`, y romper la impresion de cocina/caja sin tocar credenciales web.
- Precondiciones: conocer o robar `BRIDGE_TOKEN`.

**Evidencia**

- Los endpoints `claim`, `ack` y `fail` aceptan solo `BRIDGE_TOKEN` en [backend/src/routes/impresion.routes.js](../../backend/src/routes/impresion.routes.js).
- Nginx publica todo `/api/` sin allowlist por path ni por IP en [ops/ec2/nginx/comanda.conf](../../ops/ec2/nginx/comanda.conf).
- La guia operativa del bridge usa un secreto compartido y HTTPS general, sin mTLS ni allowlist, en [docs/entrega/bridge-windows.md](../../docs/entrega/bridge-windows.md).

**Lineas relevantes**

- `backend/src/routes/impresion.routes.js:18-63`
- `ops/ec2/nginx/comanda.conf:62-70`

**Reproduccion**

1. Obtener `BRIDGE_TOKEN` desde la PC del bridge o su servicio.
2. Invocar `POST /api/impresion/jobs/claim` con `x-bridge-token`.
3. Repetir con `ack` o `fail` para alterar el estado de jobs existentes.
4. Confirmar que la app no exige IP fija, certificado cliente ni segundo factor del bridge.

**Remediacion**

- Restringir estos endpoints por IP/VPN o moverlos a un host privado.
- Reemplazar el secreto compartido por credenciales por bridge, rotables y auditables.
- Considerar mTLS o firmas por request con nonce/expiracion.
- Generar alertas de reclamos desde IPs no esperadas o `bridgeId` anomalo.

### H-03 - Login expuesto a credential stuffing distribuido y sin MFA

- Severidad: Alta
- Vector: `/api/auth/login`
- Impacto: toma de cuenta de `ADMIN` o `CAJERO`, con capacidad de alterar pagos, configuracion de Mercado Pago, impresion, usuarios y negocio.
- Precondiciones: credenciales reutilizadas o filtradas; multiples IPs.

**Evidencia**

- El rate limit de login es `10` intentos por `15` minutos y su llave es `email + IP` en [backend/src/routes/auth.routes.js](../../backend/src/routes/auth.routes.js).
- No se observa MFA, device binding, CAPTCHA ni bloqueo progresivo por cuenta en el repo.

**Lineas relevantes**

- `backend/src/routes/auth.routes.js:17-31`

**Reproduccion**

1. Distribuir intentos contra el mismo email desde multiples IPs.
2. Verificar que el limite aplica por combinacion `email|ip`, no por cuenta global.
3. Confirmar que no hay segundo factor para perfiles criticos.

**Remediacion**

- Agregar MFA al menos para `ADMIN` y `CAJERO`.
- Aplicar bloqueo progresivo por cuenta ademas del limite por IP.
- Complementar con `limit_req` o WAF en Nginx/edge.
- Registrar y alertar intentos fallidos por cuenta, ASN y geografia.

### H-04 - `state` OAuth reusable y no ligado al admin que inicia el flujo

- Severidad: Media
- Vector: callback OAuth de Mercado Pago
- Impacto: un `state` valido dentro de la ventana de 10 minutos puede reutilizarse; si se filtra o se usa en un ambiente expuesto con secreto debil, puede terminar vinculando una cuenta de Mercado Pago fuera del contexto esperado.
- Precondiciones: acceso a un `state` valido, o ambiente no productivo expuesto sin `JWT_SECRET`.

**Evidencia**

- El `state` se firma solo con `timestamp` y HMAC; no guarda nonce server-side ni referencia al usuario/sesion en [backend/src/services/mercadopago-config.service.js](../../backend/src/services/mercadopago-config.service.js).
- El callback acepta cualquier `code + state` valido y guarda la configuracion en [backend/src/controllers/mercadopago-oauth.controller.js](../../backend/src/controllers/mercadopago-oauth.controller.js).
- Si `JWT_SECRET` falta fuera de produccion, el `state` cae a `dev-secret` en [backend/src/services/mercadopago-config.service.js](../../backend/src/services/mercadopago-config.service.js).

**Lineas relevantes**

- `backend/src/services/mercadopago-config.service.js:7-23`
- `backend/src/services/mercadopago-config.service.js:35-50`
- `backend/src/controllers/mercadopago-oauth.controller.js:10-59`

**Reproduccion**

1. Obtener una URL de autorizacion desde un admin valido.
2. Reusar el mismo `state` dentro de 10 minutos con otro `code`.
3. Verificar que el callback no exige que el mismo admin ni la misma sesion complete el flujo.

**Remediacion**

- Guardar nonce de un solo uso en backend.
- Atar el `state` al usuario admin y a su sesion.
- Eliminar cualquier fallback a secretos por defecto en ambientes expuestos.
- Registrar quien inicio y quien completo el flujo de conexion.

### H-05 - Webhook de Mercado Pago con idempotencia incompleta para side effects

- Severidad: Media
- Vector: replay de webhook valido
- Impacto: aunque no deberia duplicar `Pago`, un replay `approved` puede volver a disparar eventos y reenvio de email, generando ruido operativo, reclamos o acciones repetidas.
- Precondiciones: redelivery legitimo del proveedor o replay de una request valida.

**Evidencia**

- El controlador busca o actualiza el `Pago` y luego vuelve a correr `finalizeApprovedPedido` cada vez que llega `approved` en [backend/src/controllers/pagos.controller.js](../../backend/src/controllers/pagos.controller.js).
- Tras finalizar, vuelve a emitir eventos y puede reenviar email si existe `clienteEmail`.

**Lineas relevantes**

- `backend/src/controllers/pagos.controller.js:251-365`
- `backend/src/controllers/pagos.controller.js:376-393`

**Reproduccion**

1. Enviar un webhook valido `payment.updated` para un pago ya aprobado.
2. Confirmar que el registro de `Pago` no necesariamente se duplica.
3. Verificar si se repiten `eventBus.publish` y `sendOrderConfirmation`.

**Remediacion**

- Persistir identificadores de webhook procesados.
- Hacer que email y eventos salgan solo en transiciones reales de estado.
- Guardar una marca `processedAt` o `lastWebhookStatus` para cortar side effects repetidos.

### H-06 - Falta endurecimiento de borde en Nginx/EC2 para flujos sensibles

- Severidad: Media
- Vector: abuso distribuido y recon del borde publico
- Impacto: el repo no demuestra proteccion de edge para login, pedido publico, webhook ni bridge; tampoco demuestra cierre efectivo de 3001/PostgreSQL mediante security groups o firewall.
- Precondiciones: trafico desde multiples IPs o una mala configuracion de EC2 fuera del repo.

**Evidencia**

- Nginx solo hace proxy general y no define `limit_req`, `limit_conn`, allowlists por path ni restricciones para `/api/ready` en [ops/ec2/nginx/comanda.conf](../../ops/ec2/nginx/comanda.conf).
- `comanda-backend.service` usa `.env` local y el backend escucha con `app.listen(PORT)` sin bind explicito, por lo que el cierre de 3001 depende del host/proxy y no puede probarse desde el repo [ops/ec2/systemd/comanda-backend.service](../../ops/ec2/systemd/comanda-backend.service), [backend/src/server.js](../../backend/src/server.js).
- `app.js` publica `/uploads` y `/api/ready` sin auth, lo que suma recon si el borde no filtra [backend/src/app.js](../../backend/src/app.js).

**Lineas relevantes**

- `ops/ec2/nginx/comanda.conf:48-77`
- `ops/ec2/systemd/comanda-backend.service:9-13`
- `backend/src/server.js:13-18`
- `backend/src/app.js:101-102`
- `backend/src/app.js:143-147`

**Reproduccion**

1. Revisar el `server` Nginx y confirmar ausencia de reglas de rate limiting.
2. Desde internet, validar si solo 80/443 responden y si 3001 o PostgreSQL estan cerrados.
3. Consultar `/api/ready` y verificar la cantidad de informacion operativa expuesta.

**Remediacion**

- Aplicar rate limiting y `limit_conn` en Nginx o WAF para login, pedido publico, webhook y bridge.
- Restringir `/api/impresion/jobs/*` y `/api/ready` por IP o autenticacion de borde.
- Verificar SG/NACL/firewall para garantizar que 3001 y PostgreSQL no sean accesibles desde internet.
- Revisar permisos de `/opt/comanda/backend/.env` y rotacion de secretos.

## Mitigaciones priorizadas

### Urgente

- Sacar el token publico de query string y de `localStorage`.
- Poner allowlist/VPN/mTLS delante de `/api/impresion/jobs/*`.
- Agregar MFA para perfiles `ADMIN` y `CAJERO`.
- Aplicar rate limiting de borde en Nginx para `/api/auth/login`, `/api/publico/pedido`, `/api/publico/pedido/*/pagar` y `/api/pagos/webhook/mercadopago`.

### Importante

- Volver single-use y session-bound el `state` OAuth.
- Hacer realmente idempotentes los side effects del webhook.
- Proteger `/api/ready` o reducir su detalle fuera de redes internas.
- Eliminar secretos por defecto para ambientes no productivos expuestos.

### Hardening

- Alertas por abuso de pedido publico, bridge y login.
- Rotacion periodica de `BRIDGE_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `JWT_SECRET` y `PUBLIC_ORDER_JWT_SECRET`.
- Inventario y validacion periodica de puertos expuestos, certificados y permisos de archivos sensibles.

## Bloqueos y validaciones pendientes

- No se pudo validar el estado real de security groups, firewall, puertos y permisos de archivos porque no hubo acceso SSH a una instancia EC2 real.
- No se pudo correr `npm audit`, tests o smoke locales porque `npm` no esta disponible en esta sesion.
- La auditoria de dependencias queda pendiente para la proxima pasada con Node/npm accesible.
