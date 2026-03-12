const { createHttpError } = require('../utils/http-error');
const {
  ArcaServiceError,
  emitirComprobanteArca,
  hasArcaRuntimeConfig
} = require('./arca.service');

const DEFAULT_FACTURACION_ALICUOTA = 21;

const upsertConfigValue = (tx, clave, valor) => tx.configuracion.upsert({
  where: { clave },
  update: { valor: String(valor) },
  create: { clave, valor: String(valor) }
});

const upsertClienteFiscal = async (tx, clienteFiscal) => {
  if (!clienteFiscal) {
    return null;
  }

  const {
    nombre,
    tipoDocumento,
    numeroDocumento,
    cuit,
    condicionIva,
    email,
    domicilioFiscal
  } = clienteFiscal;

  if (cuit) {
    const existing = await tx.clienteFiscal.findFirst({
      where: { cuit }
    });

    if (existing) {
      return tx.clienteFiscal.update({
        where: { id: existing.id },
        data: {
          nombre,
          tipoDocumento: tipoDocumento || null,
          numeroDocumento: numeroDocumento || null,
          condicionIva: condicionIva || null,
          email: email || null,
          domicilioFiscal: domicilioFiscal || null
        }
      });
    }
  }

  return tx.clienteFiscal.create({
    data: {
      nombre,
      tipoDocumento: tipoDocumento || null,
      numeroDocumento: numeroDocumento || null,
      cuit: cuit || null,
      condicionIva: condicionIva || null,
      email: email || null,
      domicilioFiscal: domicilioFiscal || null
    }
  });
};

const hasArcaRuntimeConfigFor = (ambiente) => hasArcaRuntimeConfig(ambiente);

const obtenerComprobante = async (prisma, id) => {
  const comprobante = await prisma.comprobanteFiscal.findUnique({
    where: { id },
    include: {
      pedido: {
        include: {
          mesa: true,
          items: { include: { producto: true } },
          pagos: true
        }
      },
      clienteFiscal: true,
      puntoVentaFiscal: true
    }
  });

  if (!comprobante) {
    throw createHttpError.notFound('Comprobante fiscal no encontrado');
  }

  return comprobante;
};

const guardarConfiguracion = async (prisma, payload) => {
  const {
    puntoVenta,
    descripcion,
    ambiente = 'homologacion',
    cuitEmisor,
    activo = true,
    habilitada = true,
    alicuotaIva = DEFAULT_FACTURACION_ALICUOTA
  } = payload;

  const [puntoVentaFiscal] = await prisma.$transaction([
    prisma.puntoVentaFiscal.upsert({
      where: { puntoVenta },
      update: {
        descripcion: descripcion || null,
        ambiente,
        cuitEmisor: cuitEmisor || null,
        activo
      },
      create: {
        puntoVenta,
        descripcion: descripcion || null,
        ambiente,
        cuitEmisor: cuitEmisor || null,
        activo
      }
    }),
    upsertConfigValue(prisma, 'facturacion_habilitada', habilitada),
    upsertConfigValue(prisma, 'facturacion_ambiente', ambiente),
    upsertConfigValue(prisma, 'facturacion_punto_venta', puntoVenta),
    upsertConfigValue(prisma, 'facturacion_cuit_emisor', cuitEmisor || ''),
    upsertConfigValue(prisma, 'facturacion_descripcion', descripcion || ''),
    upsertConfigValue(prisma, 'facturacion_alicuota_iva', alicuotaIva)
  ]);

  return {
    puntoVentaFiscal,
    arcaDisponible: hasArcaRuntimeConfigFor(ambiente),
    message: hasArcaRuntimeConfigFor(ambiente)
      ? 'Configuracion fiscal guardada'
      : 'Configuracion fiscal guardada. Falta configurar credenciales ARCA en el servidor para emitir comprobantes.'
  };
};

const buildClienteFiscal = (tipoComprobante, clienteFiscal) => {
  if (clienteFiscal) {
    return clienteFiscal;
  }

  if (String(tipoComprobante || '').trim().toUpperCase() === 'CONSUMIDOR_FINAL') {
    return {
      nombre: 'Consumidor Final',
      condicionIva: 'Consumidor Final',
      tipoDocumento: 'Consumidor Final',
      numeroDocumento: '0'
    };
  }

  return null;
};

const buildPayloadSnapshot = ({ pedido, tipoComprobante, clienteFiscal, puntoVentaFiscal, alicuotaIva }) => ({
  pedidoId: pedido.id,
  tipoComprobante,
  total: pedido.total,
  estadoPedido: pedido.estado,
  mesa: pedido.mesa ? {
    id: pedido.mesa.id,
    numero: pedido.mesa.numero
  } : null,
  puntoVenta: puntoVentaFiscal ? {
    id: puntoVentaFiscal.id,
    puntoVenta: puntoVentaFiscal.puntoVenta,
    ambiente: puntoVentaFiscal.ambiente
  } : null,
  clienteFiscal: clienteFiscal || null,
  alicuotaIva,
  items: pedido.items.map(item => ({
    productoId: item.productoId,
    nombre: item.producto.nombre,
    cantidad: item.cantidad,
    subtotal: item.subtotal
  }))
});

const serializeArcaError = (error) => ({
  code: error.code || 'ARCA_ERROR',
  status: error.status || 500,
  message: error.message,
  details: error.details || [],
  events: error.events || [],
  responseXml: error.responseXml || null,
  requestPayload: error.requestPayload || null
});

const crearComprobante = async (prisma, payload) => {
  const { pedidoId, tipoComprobante, observaciones, clienteFiscal } = payload;
  const preparedClienteFiscal = buildClienteFiscal(tipoComprobante, clienteFiscal);
  let alicuotaIva = DEFAULT_FACTURACION_ALICUOTA;

  const prepared = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
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

    const existente = await tx.comprobanteFiscal.findUnique({
      where: { pedidoId },
      include: {
        clienteFiscal: true,
        puntoVentaFiscal: true
      }
    });

    if (existente) {
      return {
        existing: true,
        comprobante: existente
      };
    }

    const [puntoVentaFiscal, alicuotaConfig] = await Promise.all([
      tx.puntoVentaFiscal.findFirst({
        where: { activo: true },
        orderBy: { puntoVenta: 'asc' }
      }),
      tx.configuracion.findUnique({
        where: { clave: 'facturacion_alicuota_iva' }
      })
    ]);

    alicuotaIva = Number.parseFloat(alicuotaConfig?.valor || DEFAULT_FACTURACION_ALICUOTA);
    const cliente = await upsertClienteFiscal(tx, preparedClienteFiscal);
    const payloadSnapshot = buildPayloadSnapshot({
      pedido,
      tipoComprobante,
      clienteFiscal: preparedClienteFiscal,
      puntoVentaFiscal,
      alicuotaIva
    });
    const estado = puntoVentaFiscal
      ? (hasArcaRuntimeConfigFor(puntoVentaFiscal.ambiente) ? 'PENDIENTE_ENVIO' : 'PENDIENTE_CONFIGURACION_ARCA')
      : 'PENDIENTE_PUNTO_VENTA';

    const comprobante = await tx.comprobanteFiscal.create({
      data: {
        pedidoId,
        clienteFiscalId: cliente?.id || null,
        puntoVentaFiscalId: puntoVentaFiscal?.id || null,
        tipoComprobante,
        estado,
        observaciones: observaciones || null,
        payload: payloadSnapshot
      },
      include: {
        clienteFiscal: true,
        puntoVentaFiscal: true
      }
    });

    return {
      existing: false,
      comprobante,
      pedido,
      puntoVentaFiscal,
      clienteFiscal: preparedClienteFiscal,
      shouldEmit: Boolean(puntoVentaFiscal && hasArcaRuntimeConfigFor(puntoVentaFiscal.ambiente)),
      payloadSnapshot,
      pendingMessage: puntoVentaFiscal
        ? 'Comprobante fiscal creado en estado pendiente. Falta configurar credenciales ARCA para emitirlo.'
        : 'Comprobante fiscal creado en estado pendiente hasta configurar un punto de venta fiscal.'
    };
  });

  if (prepared.existing) {
    return {
      comprobante: prepared.comprobante,
      emitido: Boolean(prepared.comprobante.cae),
      message: 'El pedido ya tiene un comprobante fiscal asociado'
    };
  }

  if (!prepared.shouldEmit) {
    return {
      comprobante: prepared.comprobante,
      emitido: false,
      message: prepared.pendingMessage
    };
  }

  try {
    const arcaResponse = await emitirComprobanteArca({
      ambiente: prepared.puntoVentaFiscal.ambiente,
      pointOfSale: prepared.puntoVentaFiscal.puntoVenta,
      tipoComprobante,
      clienteFiscal: prepared.clienteFiscal,
      total: prepared.pedido.total,
      fechaComprobante: new Date(),
      alicuotaIva
    });

    const comprobante = await prisma.comprobanteFiscal.update({
      where: { id: prepared.comprobante.id },
      data: {
        estado: arcaResponse.observations.length > 0 ? 'AUTORIZADO_CON_OBSERVACIONES' : 'AUTORIZADO',
        numeroComprobante: arcaResponse.numeroComprobante,
        cae: arcaResponse.cae,
        caeVencimiento: arcaResponse.caeExpirationDate,
        payload: {
          ...prepared.payloadSnapshot,
          arcaRequest: arcaResponse.requestPayload
        },
        respuestaArca: {
          responseSummary: arcaResponse.responseSummary,
          events: arcaResponse.events,
          observations: arcaResponse.observations,
          responseXml: arcaResponse.responseXml
        }
      },
      include: {
        clienteFiscal: true,
        puntoVentaFiscal: true
      }
    });

    return {
      comprobante,
      emitido: true,
      message: arcaResponse.observations.length > 0
        ? 'Comprobante fiscal emitido con observaciones.'
        : 'Comprobante fiscal emitido correctamente.',
      observations: arcaResponse.observations,
      events: arcaResponse.events
    };
  } catch (error) {
    const data = serializeArcaError(error);
    await prisma.comprobanteFiscal.update({
      where: { id: prepared.comprobante.id },
      data: {
        estado: error instanceof ArcaServiceError && error.code === 'ARCA_REJECTED'
          ? 'RECHAZADO_ARCA'
          : 'ERROR_ARCA',
        respuestaArca: data
      }
    });

    throw error;
  }
};

const listarComprobantes = async (prisma, query) => {
  const { estado, tipoComprobante, desde, hasta, limit = 20, offset = 0 } = query;
  const where = {};
  if (estado) where.estado = estado;
  if (tipoComprobante) where.tipoComprobante = tipoComprobante;
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setDate(hastaDate.getDate() + 1);
      where.createdAt.lt = hastaDate;
    }
  }

  const [comprobantes, total] = await Promise.all([
    prisma.comprobanteFiscal.findMany({
      where,
      include: {
        pedido: { select: { id: true, total: true, estado: true, mesa: { select: { numero: true } } } },
        clienteFiscal: { select: { id: true, nombre: true, cuit: true, condicionIva: true } },
        puntoVentaFiscal: { select: { puntoVenta: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset)
    }),
    prisma.comprobanteFiscal.count({ where })
  ]);

  return { data: comprobantes, total };
};

module.exports = {
  hasArcaRuntimeConfig: hasArcaRuntimeConfigFor,
  obtenerComprobante,
  guardarConfiguracion,
  crearComprobante,
  listarComprobantes
};
