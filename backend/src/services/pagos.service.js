const { createHttpError } = require('../utils/http-error');
const { createQrOrder } = require('./mercadopago.service');
const {
  buildPedidoCobroSummary,
  cancelPendingPaymentsForChannel
} = require('./payment-state.service');
const { isPedidoTerminal } = require('./order-state.service');

const registrarPago = async (prisma, payload) => {
  const {
    pedidoId,
    monto,
    metodo,
    canalCobro = 'CAJA',
    propinaMonto = 0,
    propinaMetodo = null,
    referencia,
    comprobante,
    montoAbonado
  } = payload;

  const montoPago = parseFloat(monto);
  const montoPropina = parseFloat(propinaMonto || 0);

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (pedido.estado === 'CANCELADO') {
      throw createHttpError.badRequest('No se puede pagar un pedido cancelado');
    }

    if (isPedidoTerminal(pedido.estado) || pedido.estado === 'COBRADO') {
      throw createHttpError.badRequest('No se puede registrar un pago en este pedido');
    }

    const cobroActual = buildPedidoCobroSummary(pedido);
    const pendiente = cobroActual.pendiente;

    if (montoPago > pendiente + 0.01) {
      throw createHttpError.badRequest(`El monto excede el pendiente ($${pendiente.toFixed(2)})`);
    }

    if (metodo !== 'EFECTIVO' && montoAbonado != null) {
      throw createHttpError.badRequest('montoAbonado solo puede registrarse para pagos en efectivo');
    }

    const efectivoEntregado = metodo === 'EFECTIVO' && montoAbonado != null
      ? parseFloat(montoAbonado)
      : null;
    const montoAComparar = montoPago + montoPropina;

    if (metodo === 'EFECTIVO' && efectivoEntregado != null && efectivoEntregado + 0.01 < montoAComparar) {
      throw createHttpError.badRequest('El monto abonado no alcanza para cubrir pago y propina');
    }

    const pago = await tx.pago.create({
      data: {
        pedidoId,
        monto: montoPago,
        metodo,
        canalCobro,
        propinaMonto: montoPropina,
        propinaMetodo: montoPropina > 0 ? (propinaMetodo || metodo) : null,
        referencia,
        comprobante,
        montoAbonado: efectivoEntregado,
        vuelto: metodo === 'EFECTIVO' && efectivoEntregado != null
          ? Math.max(0, efectivoEntregado - montoAComparar)
          : null,
        estado: 'APROBADO'
      }
    });

    const nuevoCobro = buildPedidoCobroSummary({
      total: pedido.total,
      pagos: [...pedido.pagos, pago]
    });
    let mesaUpdated = null;

    if (nuevoCobro.fullyPaid) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: 'COBRADO',
          estadoPago: 'APROBADO'
        }
      });

      if (pedido.mesaId) {
        await tx.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'CERRADA' }
        });
        mesaUpdated = { mesaId: pedido.mesaId, estado: 'CERRADA' };
      }
    }

    const pedidoActualizado = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    return {
      pago,
      pedido: pedidoActualizado,
      totalPagado: nuevoCobro.totalPagado,
      pendiente: nuevoCobro.pendiente,
      mesaUpdated
    };
  }, {
    isolationLevel: 'Serializable'
  });

  return result;
};

const listarPagosPedido = async (prisma, pedidoId) => {
  const [pagos, pedido] = await Promise.all([
    prisma.pago.findMany({
      where: { pedidoId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { total: true }
    })
  ]);

  const cobro = buildPedidoCobroSummary({
    total: pedido?.total || 0,
    pagos
  });

  return {
    pagos,
    totalPedido: cobro.totalPedido,
    totalPagado: cobro.totalPagado,
    totalPropina: cobro.totalPropina,
    pendiente: cobro.pendiente
  };
};

const crearPreferenciaMercadoPagoMock = async (prisma, pedidoId) => {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { items: { include: { producto: true } } }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  const preferencia = {
    id: `PREF_${pedidoId}_${Date.now()}`,
    init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`,
    sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`
  };

  return {
    preferencia,
    message: 'Para integracion real, configurar credenciales de MercadoPago'
  };
};

const crearOrdenQrPresencial = async (prisma, payload) => {
  const { pedidoId, propinaMonto = 0, propinaMetodo = null } = payload;

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      mesa: true,
      items: { include: { producto: true } },
      pagos: true
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  if (pedido.estado === 'CANCELADO' || pedido.estado === 'CERRADO') {
    throw createHttpError.badRequest('No se puede generar un QR presencial para este pedido');
  }

  const cobroActual = buildPedidoCobroSummary(pedido);
  const pendiente = cobroActual.pendiente;

  if (pendiente <= 0.01) {
    throw createHttpError.badRequest('El pedido ya fue cubierto en su totalidad');
  }

  const configs = await prisma.configuracion.findMany({
    where: {
      clave: { in: ['mercadopago_enabled', 'mercadopago_qr_pos_id', 'mercadopago_qr_mode'] }
    }
  });
  const configMap = Object.fromEntries(configs.map((config) => [config.clave, config.valor]));

  if (configMap.mercadopago_enabled !== 'true') {
    throw createHttpError.badRequest('MercadoPago no esta habilitado para este negocio');
  }

  if (!configMap.mercadopago_qr_pos_id) {
    throw createHttpError.badRequest('Falta configurar el POS de QR presencial de MercadoPago');
  }

  const propina = parseFloat(propinaMonto || 0);
  const totalAmount = pendiente + propina;
  const idempotencyKey = `mp-qr-${pedido.id}-${Date.now()}`;

  const orderResponse = await createQrOrder({
    type: 'qr',
    total_amount: totalAmount.toFixed(2),
    external_reference: `pedido-${pedido.id}`,
    title: pedido.mesa ? `Mesa ${pedido.mesa.numero}` : `Pedido ${pedido.id}`,
    description: pedido.mesa
      ? `Cobro presencial Mesa ${pedido.mesa.numero} - Pedido #${pedido.id}`
      : `Cobro presencial Pedido #${pedido.id}`,
    expiration_time: 'PT15M',
    config: {
      qr: {
        external_pos_id: configMap.mercadopago_qr_pos_id,
        mode: configMap.mercadopago_qr_mode || 'dynamic'
      }
    },
    items: pedido.items.map((item) => ({
      title: item.producto.nombre,
      unit_price: parseFloat(item.precioUnitario).toFixed(2),
      quantity: item.cantidad,
      unit_measure: 'unit',
      external_code: String(item.productoId)
    }))
  }, idempotencyKey);

  const pago = await prisma.$transaction(async (tx) => {
    await cancelPendingPaymentsForChannel(tx, {
      pedidoId,
      canalCobro: 'QR_PRESENCIAL',
      metodo: 'MERCADOPAGO'
    });

    return tx.pago.create({
      data: {
        pedidoId,
        monto: pendiente,
        metodo: 'MERCADOPAGO',
        canalCobro: 'QR_PRESENCIAL',
        estado: 'PENDIENTE',
        referencia: orderResponse.id?.toString() || null,
        comprobante: orderResponse.qr_data || null,
        propinaMonto: propina,
        propinaMetodo: propina > 0 ? (propinaMetodo || 'MERCADOPAGO') : null,
        idempotencyKey
      }
    });
  });

  return {
    pago,
    orderId: orderResponse.id?.toString() || null,
    status: orderResponse.status || 'created',
    qrData: orderResponse.qr_data || null,
    totalAmount,
    pendiente,
    propinaMonto: propina
  };
};

module.exports = {
  registrarPago,
  listarPagosPedido,
  crearPreferenciaMercadoPagoMock,
  crearOrdenQrPresencial
};
