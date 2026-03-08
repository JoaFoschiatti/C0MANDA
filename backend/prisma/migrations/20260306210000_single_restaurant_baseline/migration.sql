-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'MOZO', 'COCINERO', 'CAJERO', 'DELIVERY');

-- CreateEnum
CREATE TYPE "EstadoMesa" AS ENUM ('LIBRE', 'OCUPADA', 'RESERVADA', 'ESPERANDO_CUENTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoPedido" AS ENUM ('MESA', 'DELIVERY', 'MOSTRADOR', 'ONLINE');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'MERCADOPAGO', 'TARJETA');

-- CreateEnum
CREATE TYPE "CanalCobro" AS ENUM ('CAJA', 'CHECKOUT_WEB', 'QR_PRESENCIAL');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('DELIVERY', 'RETIRO');

-- CreateEnum
CREATE TYPE "OrigenPedido" AS ENUM ('INTERNO', 'MENU_PUBLICO');

-- CreateEnum
CREATE TYPE "TipoComanda" AS ENUM ('COCINA', 'CAJA', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoPrintJob" AS ENUM ('PENDIENTE', 'IMPRIMIENDO', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CLIENTE_PRESENTE', 'NO_LLEGO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoModificador" AS ENUM ('EXCLUSION', 'ADICION');

-- CreateTable
CREATE TABLE "negocios" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "logo" TEXT,
    "bannerUrl" TEXT,
    "colorPrimario" TEXT DEFAULT '#3B82F6',
    "colorSecundario" TEXT DEFAULT '#1E40AF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MOZO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "rol" "Rol" NOT NULL,
    "tarifaHora" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichajes" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "entrada" TIMESTAMP(3) NOT NULL,
    "salida" TIMESTAMP(3),
    "fecha" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "periodoDesde" DATE NOT NULL,
    "periodoHasta" DATE NOT NULL,
    "horasTotales" DECIMAL(10,2) NOT NULL,
    "tarifaHora" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuentos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adicionales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPagar" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "zona" TEXT,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "estado" "EstadoMesa" NOT NULL DEFAULT 'LIBRE',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "posX" INTEGER,
    "posY" INTEGER,
    "rotacion" INTEGER NOT NULL DEFAULT 0,
    "grupoMesaId" INTEGER,
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "mesaId" INTEGER NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "cantidadPersonas" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "imagen" TEXT,
    "categoriaId" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productoBaseId" INTEGER,
    "nombreVariante" TEXT,
    "multiplicadorInsumos" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    "ordenVariante" INTEGER NOT NULL DEFAULT 0,
    "esVariantePredeterminada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modificadores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipo" "TipoModificador" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_modificadores" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "modificadorId" INTEGER NOT NULL,

    CONSTRAINT "producto_modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockActual" DECIMAL(10,3) NOT NULL,
    "stockMinimo" DECIMAL(10,3) NOT NULL,
    "costo" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_ingredientes" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "producto_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" SERIAL NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "loteStockId" INTEGER,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "motivo" TEXT,
    "pedidoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoPedido" NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "mesaId" INTEGER,
    "usuarioId" INTEGER,
    "clienteNombre" TEXT,
    "clienteTelefono" TEXT,
    "clienteDireccion" TEXT,
    "clienteEmail" TEXT,
    "tipoEntrega" "TipoEntrega",
    "costoEnvio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "origen" "OrigenPedido" NOT NULL DEFAULT 'INTERNO',
    "impreso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_item_modificadores" (
    "id" SERIAL NOT NULL,
    "pedidoItemId" INTEGER NOT NULL,
    "modificadorId" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pedido_item_modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "canalCobro" "CanalCobro" NOT NULL DEFAULT 'CAJA',
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "referencia" TEXT,
    "comprobante" TEXT,
    "propinaMonto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "propinaMetodo" "MetodoPago",
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "montoAbonado" DECIMAL(10,2),
    "vuelto" DECIMAL(10,2),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_auditorias" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "accion" TEXT NOT NULL,
    "motivo" TEXT,
    "snapshotAntes" JSONB,
    "snapshotDespues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "horaApertura" TIMESTAMP(3) NOT NULL,
    "horaCierre" TIMESTAMP(3),
    "fondoInicial" DECIMAL(10,2) NOT NULL,
    "totalEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTarjeta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalMP" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "efectivoFisico" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "tipo" "TipoComanda" NOT NULL,
    "status" "EstadoPrintJob" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "contenido" TEXT NOT NULL,
    "anchoMm" INTEGER NOT NULL DEFAULT 80,
    "batchId" TEXT NOT NULL,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_fiscales" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" TEXT,
    "numeroDocumento" TEXT,
    "cuit" TEXT,
    "condicionIva" TEXT,
    "email" TEXT,
    "domicilioFiscal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntos_venta_fiscales" (
    "id" SERIAL NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "descripcion" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacion',
    "cuitEmisor" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puntos_venta_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_fiscales" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "clienteFiscalId" INTEGER,
    "puntoVentaFiscalId" INTEGER,
    "tipoComprobante" TEXT NOT NULL,
    "numeroComprobante" TEXT,
    "cae" TEXT,
    "caeVencimiento" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "payload" JSONB,
    "respuestaArca" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comprobantes_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_stock" (
    "id" SERIAL NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "codigoLote" TEXT NOT NULL,
    "stockInicial" DECIMAL(10,3) NOT NULL,
    "stockActual" DECIMAL(10,3) NOT NULL,
    "costoUnitario" DECIMAL(10,2),
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "ultimaNotificacionVencimiento" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercadopago_configs" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "publicKey" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isOAuth" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones_mercadopago" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER,
    "mpPaymentId" TEXT NOT NULL,
    "mpPreferenceId" TEXT,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "payerEmail" TEXT,
    "paymentMethod" TEXT,
    "paymentTypeId" TEXT,
    "installments" INTEGER,
    "fee" DECIMAL(10,2),
    "netAmount" DECIMAL(10,2),
    "externalReference" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacciones_mercadopago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuarioId_idx" ON "refresh_tokens"("usuarioId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_revokedAt_idx" ON "refresh_tokens"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_dni_key" ON "empleados"("dni");

-- CreateIndex
CREATE INDEX "fichajes_empleadoId_fecha_idx" ON "fichajes"("empleadoId", "fecha");

-- CreateIndex
CREATE INDEX "liquidaciones_empleadoId_idx" ON "liquidaciones"("empleadoId");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_numero_key" ON "mesas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_qrToken_key" ON "mesas"("qrToken");

-- CreateIndex
CREATE INDEX "mesas_estado_idx" ON "mesas"("estado");

-- CreateIndex
CREATE INDEX "mesas_zona_activa_idx" ON "mesas"("zona", "activa");

-- CreateIndex
CREATE INDEX "mesas_grupoMesaId_idx" ON "mesas"("grupoMesaId");

-- CreateIndex
CREATE INDEX "reservas_fechaHora_idx" ON "reservas"("fechaHora");

-- CreateIndex
CREATE INDEX "reservas_mesaId_fechaHora_idx" ON "reservas"("mesaId", "fechaHora");

-- CreateIndex
CREATE INDEX "reservas_estado_idx" ON "reservas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE INDEX "productos_categoriaId_idx" ON "productos"("categoriaId");

-- CreateIndex
CREATE INDEX "productos_productoBaseId_idx" ON "productos"("productoBaseId");

-- CreateIndex
CREATE INDEX "productos_disponible_idx" ON "productos"("disponible");

-- CreateIndex
CREATE UNIQUE INDEX "modificadores_nombre_key" ON "modificadores"("nombre");

-- CreateIndex
CREATE INDEX "producto_modificadores_productoId_idx" ON "producto_modificadores"("productoId");

-- CreateIndex
CREATE INDEX "producto_modificadores_modificadorId_idx" ON "producto_modificadores"("modificadorId");

-- CreateIndex
CREATE UNIQUE INDEX "producto_modificadores_productoId_modificadorId_key" ON "producto_modificadores"("productoId", "modificadorId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_nombre_key" ON "ingredientes"("nombre");

-- CreateIndex
CREATE INDEX "producto_ingredientes_productoId_idx" ON "producto_ingredientes"("productoId");

-- CreateIndex
CREATE INDEX "producto_ingredientes_ingredienteId_idx" ON "producto_ingredientes"("ingredienteId");

-- CreateIndex
CREATE UNIQUE INDEX "producto_ingredientes_productoId_ingredienteId_key" ON "producto_ingredientes"("productoId", "ingredienteId");

-- CreateIndex
CREATE INDEX "movimientos_stock_ingredienteId_idx" ON "movimientos_stock"("ingredienteId");

-- CreateIndex
CREATE INDEX "movimientos_stock_loteStockId_idx" ON "movimientos_stock"("loteStockId");

-- CreateIndex
CREATE INDEX "movimientos_stock_createdAt_idx" ON "movimientos_stock"("createdAt");

-- CreateIndex
CREATE INDEX "movimientos_stock_pedidoId_idx" ON "movimientos_stock"("pedidoId");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- CreateIndex
CREATE INDEX "pedidos_tipo_idx" ON "pedidos"("tipo");

-- CreateIndex
CREATE INDEX "pedidos_createdAt_idx" ON "pedidos"("createdAt");

-- CreateIndex
CREATE INDEX "pedidos_estadoPago_createdAt_idx" ON "pedidos"("estadoPago", "createdAt");

-- CreateIndex
CREATE INDEX "pedidos_mesaId_idx" ON "pedidos"("mesaId");

-- CreateIndex
CREATE INDEX "pedidos_usuarioId_idx" ON "pedidos"("usuarioId");

-- CreateIndex
CREATE INDEX "pedido_items_pedidoId_idx" ON "pedido_items"("pedidoId");

-- CreateIndex
CREATE INDEX "pedido_items_productoId_idx" ON "pedido_items"("productoId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_pedidoItemId_idx" ON "pedido_item_modificadores"("pedidoItemId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_modificadorId_idx" ON "pedido_item_modificadores"("modificadorId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_idempotencyKey_key" ON "pagos"("idempotencyKey");

-- CreateIndex
CREATE INDEX "pagos_pedidoId_idx" ON "pagos"("pedidoId");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE INDEX "pagos_estado_createdAt_idx" ON "pagos"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "pagos_pedidoId_createdAt_idx" ON "pagos"("pedidoId", "createdAt");

-- CreateIndex
CREATE INDEX "pagos_mpPaymentId_idx" ON "pagos"("mpPaymentId");

-- CreateIndex
CREATE INDEX "pedido_auditorias_pedidoId_createdAt_idx" ON "pedido_auditorias"("pedidoId", "createdAt");

-- CreateIndex
CREATE INDEX "pedido_auditorias_usuarioId_idx" ON "pedido_auditorias"("usuarioId");

-- CreateIndex
CREATE INDEX "cierres_caja_fecha_idx" ON "cierres_caja"("fecha");

-- CreateIndex
CREATE INDEX "cierres_caja_usuarioId_fecha_idx" ON "cierres_caja"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "cierres_caja_estado_createdAt_idx" ON "cierres_caja"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "print_jobs_status_nextAttemptAt_idx" ON "print_jobs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "print_jobs_status_claimedAt_idx" ON "print_jobs"("status", "claimedAt");

-- CreateIndex
CREATE INDEX "print_jobs_pedidoId_batchId_idx" ON "print_jobs"("pedidoId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "print_jobs_pedidoId_tipo_batchId_key" ON "print_jobs"("pedidoId", "tipo", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_clave_key" ON "configuraciones"("clave");

-- CreateIndex
CREATE INDEX "clientes_fiscales_cuit_idx" ON "clientes_fiscales"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_venta_fiscales_puntoVenta_key" ON "puntos_venta_fiscales"("puntoVenta");

-- CreateIndex
CREATE INDEX "puntos_venta_fiscales_activo_idx" ON "puntos_venta_fiscales"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_fiscales_pedidoId_key" ON "comprobantes_fiscales"("pedidoId");

-- CreateIndex
CREATE INDEX "comprobantes_fiscales_estado_createdAt_idx" ON "comprobantes_fiscales"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "comprobantes_fiscales_clienteFiscalId_idx" ON "comprobantes_fiscales"("clienteFiscalId");

-- CreateIndex
CREATE INDEX "comprobantes_fiscales_puntoVentaFiscalId_idx" ON "comprobantes_fiscales"("puntoVentaFiscalId");

-- CreateIndex
CREATE INDEX "lotes_stock_ingredienteId_activo_idx" ON "lotes_stock"("ingredienteId", "activo");

-- CreateIndex
CREATE INDEX "lotes_stock_fechaVencimiento_idx" ON "lotes_stock"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "lotes_stock_ultimaNotificacionVencimiento_idx" ON "lotes_stock"("ultimaNotificacionVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_stock_ingredienteId_codigoLote_key" ON "lotes_stock"("ingredienteId", "codigoLote");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_mercadopago_mpPaymentId_key" ON "transacciones_mercadopago"("mpPaymentId");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_createdAt_idx" ON "transacciones_mercadopago"("createdAt");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_status_idx" ON "transacciones_mercadopago"("status");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_pagoId_idx" ON "transacciones_mercadopago"("pagoId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichajes" ADD CONSTRAINT "fichajes_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_productoBaseId_fkey" FOREIGN KEY ("productoBaseId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES "modificadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_loteStockId_fkey" FOREIGN KEY ("loteStockId") REFERENCES "lotes_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "pedido_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES "modificadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_auditorias" ADD CONSTRAINT "pedido_auditorias_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_auditorias" ADD CONSTRAINT "pedido_auditorias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_fiscales" ADD CONSTRAINT "comprobantes_fiscales_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_fiscales" ADD CONSTRAINT "comprobantes_fiscales_clienteFiscalId_fkey" FOREIGN KEY ("clienteFiscalId") REFERENCES "clientes_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_fiscales" ADD CONSTRAINT "comprobantes_fiscales_puntoVentaFiscalId_fkey" FOREIGN KEY ("puntoVentaFiscalId") REFERENCES "puntos_venta_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_stock" ADD CONSTRAINT "lotes_stock_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "ingredientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_mercadopago" ADD CONSTRAINT "transacciones_mercadopago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
