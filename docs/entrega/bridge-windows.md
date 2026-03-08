# Bridge Windows

El bridge se ejecuta en una PC Windows del local y consume trabajos de impresion desde el backend cloud.

## Requisitos

- Windows 10 o superior
- Node.js 18+
- Impresora instalada en Windows
- Acceso HTTPS al backend

## Variables requeridas

```env
BRIDGE_API_URL=https://tu-dominio.com/api
BRIDGE_TOKEN=token_seguro_compartido_con_backend
BRIDGE_ID=pc-caja-1
PRINTER_NAME=Nombre exacto de la impresora en Windows
PRINT_ADAPTER=spooler
POLL_INTERVAL_MS=2000
```

## Puesta en marcha

1. Copiar el proyecto o al menos la carpeta `bridge`.
2. Configurar las variables en el entorno o wrapper de servicio.
3. Ejecutar:
```bash
node index.js
```
4. Verificar que el bridge pueda hacer `claim` y `ack` de trabajos.

## Servicio recomendado

Usar NSSM para correrlo como servicio de Windows.

## Troubleshooting

- Si no imprime: verificar `PRINTER_NAME`.
- Si no conecta: verificar `BRIDGE_API_URL`, `BRIDGE_TOKEN` y salida HTTPS.
- Si los jobs quedan en `IMPRIMIENDO`, revisar el timer de mantenimiento del backend.
