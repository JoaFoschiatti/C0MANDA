# Reporte de release

## Fecha

- Fecha operativa: 2026-03-07
- Ambiente validado: pre-entrega local
- Host de validacion: Windows + PostgreSQL local + Chrome/Playwright

## Corridas ejecutadas

### Backend

- `npm test -- --runInBand`: OK, `41/41` suites y `177/177` tests
- `npm run lint`: OK con `6` warnings no bloqueantes preexistentes en tests y utilidades
- `npx prisma validate`: OK
- `npx prisma generate`: OK

### Frontend

- `npm test -- --run`: OK, `30/30` archivos y `73/73` tests
- `npm run lint`: OK
- `npm run build`: OK

### E2E / Release

- `PLAYWRIGHT_RELEASE_LABEL=2026-03-07 npx playwright test`: OK, `30/30` tests
- Evidencia automatica y capturas locales no se versionan en git; si se conservan, deben archivarse fuera del repo o en el sistema de CI.

## Validacion visual manual

Pasada manual corta con navegador real sobre:

- `login`
- `dashboard`
- `menu`
- `menu/mesa`
- `tareas`

Capturas y artefactos:

- no versionar `e2e/artifacts/` en el repo principal;
- si una entrega necesita evidencia visual, exportarla y adjuntarla al release o al sistema de tickets.

## Estado

- Resultado tecnico: APTO PARA PRE-ENTREGA
- Bloqueos abiertos del repo: ninguno
- Dependencias externas pendientes:
  - credenciales live de Mercado Pago
  - credenciales/certificados ARCA si la facturacion real entra en alcance
  - despliegue y smoke final sobre la EC2 definitiva del cliente
