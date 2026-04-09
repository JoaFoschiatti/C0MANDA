# Print Bridge (Windows)

Servicio local para imprimir jobs desde el backend en cloud usando el spooler de Windows.

## Requisitos
- Windows 10+
- Node.js 18+
- Impresora instalada en Windows y visible en el panel de impresoras
- EPSON TM-T20III conectada por USB a la misma PC donde corre el bridge

## Configuracion

Variables necesarias:

```
BRIDGE_API_URL=https://tu-dominio.com/api
BRIDGE_TOKEN=tu_token_seguro
BRIDGE_ID=pc-caja-1
PRINTER_NAME=EPSON TM-T20III
PRINT_ADAPTER=spooler
POLL_INTERVAL_MS=2000
REQUEST_TIMEOUT_MS=10000
```

Notas importantes:
- El nombre de `PRINTER_NAME` debe coincidir exactamente con el nombre que Windows muestra para la impresora.
- USB funciona sin problemas si Windows ya ve la impresora instalada.
- El bridge puede correr como servicio con NSSM o PM2.
- La cuenta del servicio debe tener permisos para ver y usar la impresora.

## Ejecutar

```
node index.js
```

Antes de correrlo como servicio, probalo en una consola normal para confirmar que el spooler imprime bien.

La guia de entrega y operacion del bridge esta en [docs/entrega/bridge-windows.md](../docs/entrega/bridge-windows.md).
