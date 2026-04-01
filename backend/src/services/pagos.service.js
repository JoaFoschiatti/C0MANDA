const { createHttpError } = require('../utils/http-error');
const {
  buildPedidoCobroSummary,
} = require('./payment-state.service');
const { isPedidoTerminal } = require('./order-state.service');
const {
  buildPedidoPaidUpdateData,
  shouldCloseMesaOnPaid
} = require('./public-order-security.service');

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
      const pedidoData = buildPedidoPaidUpdateData(pedido, nuevoCobro);

      await tx.pedido.update({
        where: { id: pedidoId },
        data: pedidoData
      });

      if (shouldCloseMesaOnPaid(pedido, nuevoCobro)) {
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

const obtenerConfiguracionTransferenciaMercadoPago = async (prisma) => {
  const configuraciones = await prisma.configuracion.findMany({
    where: {
      clave: {
        in: [
          'mercadopago_transfer_alias',
          'mercadopago_transfer_titular',
          'mercadopago_transfer_cvu'
        ]
      }
    }
  });

  const configMap = Object.fromEntries(configuraciones.map((config) => [config.clave, config.valor]));

  return {
    alias: configMap.mercadopago_transfer_alias || '',
    titular: configMap.mercadopago_transfer_titular || '',
    cvu: configMap.mercadopago_transfer_cvu || ''
  };
};

module.exports = {
  registrarPago,
  listarPagosPedido,
  crearPreferenciaMercadoPagoMock,
  obtenerConfiguracionTransferenciaMercadoPago
};
