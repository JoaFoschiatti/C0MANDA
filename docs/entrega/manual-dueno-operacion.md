# Manual del dueno y operacion

## Acceso inicial

1. Ingresar a `/login` con el usuario administrador entregado.
2. Cambiar la contrasena inicial.
3. Revisar `Configuracion` y completar datos del negocio, Mercado Pago y facturacion si corresponde.

## Operacion diaria

### Apertura de caja

1. Entrar a `Caja`.
2. Abrir caja con el monto inicial.
3. Verificar impresora y conectividad del bridge si usan ticket fisico.

### Mesas y pedidos

1. Usar `Mesas` para abrir una mesa.
2. Crear pedidos desde el panel admin.
3. Cuando el cliente pide la cuenta, usar la accion `Cuenta`.
4. Cobrar y luego cerrar el pedido.
5. Liberar la mesa cuando el estado pase a `CERRADA`.

### Cobro manual

1. Para cobros en Mercado Pago desde caja, compartir alias/CVU/titular y registrar la referencia al confirmar la transferencia.
2. Si falta informacion de cobro, revisar `Pedidos`.

### Reservas

1. Crear la reserva en `Reservas`.
2. Al llegar el cliente, asignar mesa y actualizar estado si aplica.

### Lotes vencidos

1. Ir a `Ingredientes`.
2. Revisar alertas por vencimiento.
3. Un administrador debe descartar manualmente el lote vencido con motivo.

## Que hacer ante fallas

### La impresora no responde

1. Verificar la PC Windows del bridge.
2. Confirmar que la impresora este encendida y conectada.
3. Reiniciar el bridge si hace falta.
4. Reimprimir desde el pedido si el comprobante no salio.

### Un cobro falla o queda pendiente

1. Revisar `Pedidos` y `Tareas`.
2. Confirmar si el pago aparece en Mercado Pago o si el cliente envio el comprobante de transferencia.
3. No cerrar la mesa hasta confirmar el estado del pago.

### El sistema no deja operar

1. Verificar conexion a internet.
2. Contactar al soporte tecnico con captura de pantalla y hora del incidente.
