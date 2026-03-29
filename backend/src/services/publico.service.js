const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');
const { getNegocio } = require('../db/prisma');
const { signPublicOrderToken, matchesPublicOrderToken } = require('../utils/public-order-access');
const { SUCURSAL_IDS } = require('../constants/sucursales');
const { decimalToNumber: toNumber } = require('../utils/decimal');
const {
  assertActiveMesaPublicSession,
  buildPedidoPaidUpdateData,
  issueMesaPublicSession,
  logPublicAbuseSignal,
  logPublicAudit
} = require('./public-order-security.service');
const {
  isMercadoPagoConfigured,
  createPreference,
  saveTransaction,
  searchPaymentByReference
} = require('./mercadopago.service');
const {
  buildPedidoCobroSummary,
  cancelPendingPaymentsForChannel,
  findOpenPagoForChannel
} = require('./payment-state.service');
const { isPedidoTerminal } = require('./order-state.service');

const PUBLIC_ORDER_RESPONSE_SELECT = {
  id: true,
  tipo: true,
  estado: true,
  mesaId: true,
  clienteNombre: true,
  tipoEntrega: true,
  costoEnvio: true,
  subtotal: true,
  total: true,
  observaciones: true,
  estadoPago: true,
  origen: true,
  operacionConfirmada: true,
  createdAt: true,
  updatedAt: true,
  mesa: {
    select: {
      id: true,
      numero: true
    }
  },
  items: {
    select: {
      id: true,
      productoId: true,
      cantidad: true,
      precioUnitario: true,
      subtotal: true,
      observaciones: true,
      producto: {
        select: {
          id: true,
          nombre: true
        }
      }
    }
  },
  pagos: {
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      monto: true,
      metodo: true,
      canalCobro: true,
      estado: true,
      propinaMonto: true,
      mpPaymentId: true,
      createdAt: true
    }
  }
};

const buildConfigMap = (configs) => {
  const configMap = {};
  configs.forEach((config) => {
    configMap[config.clave] = config.valor;
  });
  return configMap;
};

const sanitizeOptionalText = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizePublicOrderItems = (items = []) => items.map((item, index) => {
  const productoId = Number.parseInt(item.productoId, 10);
  const cantidad = Number.parseInt(item.cantidad, 10);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw createHttpError.badRequest(`El item ${index + 1} tiene un producto invalido`);
  }

  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw createHttpError.badRequest(`El item ${index + 1} tiene una cantidad invalida`);
  }

  return {
    productoId,
    cantidad,
    observaciones: sanitizeOptionalText(item.observaciones)
  };
});

const assertPublicOrderAccess = (pedidoId, accessToken) => {
  if (!matchesPublicOrderToken(accessToken, pedidoId)) {
    throw createHttpError.notFound('Pedido no encontrado');
  }
};

const buildPublicPaymentReturnUrl = ({ frontendUrl, status, pedidoId, accessToken }) => {
  const params = new URLSearchParams({
    pago: status,
    pedido: String(pedidoId),
    token: accessToken
  });

  return `${frontendUrl}/menu?${params.toString()}`;
};

const buildPreferenceData = ({ pedidoId, negocioNombre, items, costoEnvio, accessToken }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');

  const mpItems = items.map((item) => ({
    id: item.productoId.toString(),
    title: item.producto.nombre,
    quantity: item.cantidad,
    unit_price: parseFloat(item.precioUnitario),
    currency_id: 'ARS'
  }));

  if (costoEnvio > 0) {
    mpItems.push({
      id: 'envio',
      title: 'Costo de envio',
      quantity: 1,
      unit_price: costoEnvio,
      currency_id: 'ARS'
    });
  }

  const preferenceData = {
    items: mpItems,
    back_urls: {
      success: buildPublicPaymentReturnUrl({ frontendUrl, status: 'exito', pedidoId, accessToken }),
      failure: buildPublicPaymentReturnUrl({ frontendUrl, status: 'error', pedidoId, accessToken }),
      pending: buildPublicPaymentReturnUrl({ frontendUrl, status: 'pendiente', pedidoId, accessToken })
    },
    external_reference: `pedido-${pedidoId}`,
    notification_url: `${backendUrl}/api/pagos/webhook/mercadopago`,
    statement_descriptor: negocioNombre.substring(0, 22).toUpperCase()
  };

  if (!isLocalhost) {
    preferenceData.auto_return = 'approved';
  }

  return preferenceData;
};

const resolvePublicSucursalId = (sucursalId = null) => {
  const parsed = Number.parseInt(sucursalId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : SUCURSAL_IDS.DELIVERY;
};

const getStockForSucursal = (stocks = [], sucursalId) => {
  const stock = stocks.find((item) => item.sucursalId === sucursalId && item.activo !== false);
  return toNumber(stock?.stockActual || 0);
};

const getRequiredIngredientAmount = (producto, productoIngrediente, cantidad = 1) => {
  const multiplicador = toNumber(producto?.multiplicadorInsumos || 1);
  return toNumber(productoIngrediente?.cantidad || 0) * cantidad * multiplicador;
};

const productHasStockInSucursal = (producto, sucursalId, cantidad = 1) => {
  const ingredientes = producto?.ingredientes || [];

  if (ingredientes.length === 0) {
    return true;
  }

  return ingredientes.every((productoIngrediente) => (
    getStockForSucursal(productoIngrediente.ingrediente?.stocks || [], sucursalId) + 0.0001 >=
      getRequiredIngredientAmount(producto, productoIngrediente, cantidad)
  ));
};

const assertProductsAvailableForSucursal = (productos, sucursalId, items = []) => {
  const productoById = new Map(productos.map((producto) => [producto.id, producto]));
  const requerimientos = new Map();

  items.forEach((item) => {
    const producto = productoById.get(item.productoId);
    if (!producto) {
      throw createHttpError.badRequest('Algunos productos no estan disponibles');
    }

    if (!productHasStockInSucursal(producto, sucursalId, item.cantidad)) {
      throw createHttpError.badRequest(`El producto "${producto.nombre}" no tiene stock suficiente en esta sucursal`);
    }

    for (const productoIngrediente of producto.ingredientes || []) {
      const current = requerimientos.get(productoIngrediente.ingredienteId) || {
        ingredienteNombre: productoIngrediente.ingrediente?.nombre || 'Ingrediente',
        requerido: 0,
        disponible: getStockForSucursal(productoIngrediente.ingrediente?.stocks || [], sucursalId)
      };

      current.requerido += getRequiredIngredientAmount(producto, productoIngrediente, item.cantidad);
      requerimientos.set(productoIngrediente.ingredienteId, current);
    }
  });

  for (const requirement of requerimientos.values()) {
    if (requirement.disponible + 0.0001 < requirement.requerido) {
      throw createHttpError.badRequest(
        `Stock insuficiente de ${requirement.ingredienteNombre} en esta sucursal`
      );
    }
  }
};

const buildPublicMenuProductSelect = (sucursalId) => ({
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  imagen: true,
  multiplicadorInsumos: true,
  ingredientes: {
    select: {
      ingredienteId: true,
      cantidad: true,
      ingrediente: {
        select: {
          nombre: true,
          stocks: {
            where: {
              sucursalId,
              activo: true
            },
            select: {
              sucursalId: true,
              activo: true,
              stockActual: true
            }
          }
        }
      }
    }
  },
  variantes: {
    where: { disponible: true },
    orderBy: { ordenVariante: 'asc' },
    select: {
      id: true,
      nombreVariante: true,
      precio: true,
      imagen: true,
      esVariantePredeterminada: true,
      multiplicadorInsumos: true,
      ingredientes: {
        select: {
          ingredienteId: true,
          cantidad: true,
          ingrediente: {
            select: {
              nombre: true,
              stocks: {
                where: {
                  sucursalId,
                  activo: true
                },
                select: {
                  sucursalId: true,
                  activo: true,
                  stockActual: true
                }
              }
            }
          }
        }
      }
    }
  }
});

const mapPublicMenuVariant = (variant) => ({
  id: variant.id,
  nombreVariante: variant.nombreVariante,
  precio: variant.precio,
  imagen: variant.imagen,
  esVariantePredeterminada: variant.esVariantePredeterminada
});

const mapPublicMenuProduct = (producto, sucursalId) => ({
  id: producto.id,
  nombre: producto.nombre,
  descripcion: producto.descripcion,
  precio: producto.precio,
  imagen: producto.imagen,
  variantes: (producto.variantes || [])
    .filter((variant) => productHasStockInSucursal(variant, sucursalId))
    .map(mapPublicMenuVariant)
});

const isClientRequestIdConstraintError = (error) => {
  if (error?.code !== 'P2002') {
    return false;
  }

  const targets = Array.isArray(error?.meta?.target)
    ? error.meta.target
    : [error?.meta?.target].filter(Boolean);

  return targets.some((target) => String(target).includes('clientRequestId'));
};

const getPublicPedidoResponse = (prisma, pedidoId) => prisma.pedido.findUnique({
  where: { id: pedidoId },
  select: PUBLIC_ORDER_RESPONSE_SELECT
});

const getPublicPedidoEmailPayload = (prisma, pedidoId) => prisma.pedido.findUnique({
  where: { id: pedidoId },
  select: {
    id: true,
    clienteNombre: true,
    clienteEmail: true,
    clienteDireccion: true,
    tipoEntrega: true,
    costoEnvio: true,
    total: true,
    observaciones: true,
    estadoPago: true,
    items: {
      select: {
        cantidad: true,
        subtotal: true,
        producto: {
          select: {
            nombre: true
          }
        }
      }
    }
  }
});

const buildPublicCreateOrderResult = async (prisma, {
  negocio,
  pedido,
  metodoPago,
  shouldSendEmail = false,
  publishEvents = false
}) => {
  const accessToken = signPublicOrderToken(pedido.id);
  let initPoint = null;

  if (metodoPago === 'MERCADOPAGO' && pedido.estadoPago !== 'APROBADO' && !isPedidoTerminal(pedido.estado)) {
    try {
      const paymentResult = await startMercadoPagoPaymentForOrder(prisma, {
        negocio,
        pedidoId: pedido.id,
        accessToken,
        skipAccessValidation: true
      });
      initPoint = paymentResult.initPoint;
    } catch (error) {
      if (!['El pedido ya esta pagado', 'El pedido ya fue cubierto en su totalidad'].includes(error?.message)) {
        throw error;
      }
    }
  }

  const [refreshedPedido, emailPayload] = await Promise.all([
    getPublicPedidoResponse(prisma, pedido.id),
    shouldSendEmail ? getPublicPedidoEmailPayload(prisma, pedido.id) : Promise.resolve(null)
  ]);

  return {
    negocio,
    pedido: refreshedPedido,
    emailPayload,
    costoEnvio: toNumber(refreshedPedido?.costoEnvio || pedido.costoEnvio),
    total: toNumber(refreshedPedido?.total || pedido.total),
    initPoint,
    accessToken,
    shouldSendEmail,
    events: publishEvents
      ? [{
          topic: 'pedido.updated',
          payload: {
            id: refreshedPedido.id,
            estado: refreshedPedido.estado,
            tipo: refreshedPedido.tipo,
            mesaId: refreshedPedido.mesaId || null,
            updatedAt: refreshedPedido.updatedAt || new Date().toISOString()
          }
        }]
      : []
  };
};

const getPublicConfig = async (prisma, negocioOverride = null) => {
  const negocio = negocioOverride || await getNegocio();
  if (!negocio) {
    throw createHttpError.serviceUnavailable('El negocio no esta bootstrappeado');
  }

  const configs = await prisma.configuracion.findMany();
  const configMap = buildConfigMap(configs);

  const mpRealmenteConfigurado = await isMercadoPagoConfigured();
  const mpHabilitado = configMap.mercadopago_enabled === 'true' && mpRealmenteConfigurado;
  const efectivoHabilitado = configMap.efectivo_enabled !== 'false';

  return {
    negocio: {
      nombre: negocio.nombre,
      logo: negocio.logo,
      bannerUrl: negocio.bannerUrl,
      colorPrimario: negocio.colorPrimario,
      colorSecundario: negocio.colorSecundario,
      telefono: negocio.telefono,
      direccion: negocio.direccion
    },
    config: {
      tienda_abierta: configMap.tienda_abierta !== 'false',
      horario_apertura: configMap.horario_apertura || '11:00',
      horario_cierre: configMap.horario_cierre || '23:00',
      costo_delivery: parseFloat(configMap.costo_delivery || '0'),
      delivery_habilitado: configMap.delivery_habilitado !== 'false',
      direccion_retiro: configMap.direccion_retiro || negocio.direccion,
      mercadopago_enabled: mpHabilitado,
      efectivo_enabled: efectivoHabilitado,
      whatsapp_numero: configMap.whatsapp_numero || null,
      nombre_negocio: configMap.nombre_negocio || negocio.nombre,
      tagline_negocio: configMap.tagline_negocio || '',
      banner_imagen: configMap.banner_imagen || negocio.bannerUrl
    }
  };
};

const getPublicMenu = async (prisma, options = {}) => {
  const sucursalId = resolvePublicSucursalId(options.sucursalId);

  const categorias = await prisma.categoria.findMany({
    where: { activa: true },
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      nombre: true,
      productos: {
        where: {
          disponible: true,
          productoBaseId: null
        },
        orderBy: { nombre: 'asc' },
        select: buildPublicMenuProductSelect(sucursalId)
      }
    }
  });

  return categorias
    .map((categoria) => ({
      id: categoria.id,
      nombre: categoria.nombre,
      productos: (categoria.productos || [])
        .filter((producto) => productHasStockInSucursal(producto, sucursalId))
        .map((producto) => mapPublicMenuProduct(producto, sucursalId))
    }))
    .filter((categoria) => categoria.productos.length > 0);
};

const createPublicOrder = async (prisma, { negocio, body, requestMeta = {} }) => {
  const {
    items,
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    clienteEmail,
    clientRequestId,
    tipoEntrega,
    metodoPago,
    montoAbonado,
    observaciones
  } = body;
  const normalizedItems = normalizePublicOrderItems(items);
  const clienteNombreValue = sanitizeOptionalText(clienteNombre);
  const clienteTelefonoValue = sanitizeOptionalText(clienteTelefono);
  const clienteDireccionValue = sanitizeOptionalText(clienteDireccion);
  const clienteEmailValue = sanitizeOptionalText(clienteEmail);
  const clientRequestIdValue = sanitizeOptionalText(clientRequestId);
  const observacionesValue = sanitizeOptionalText(observaciones);

  const configs = await prisma.configuracion.findMany({
    where: {
      clave: {
        in: ['tienda_abierta', 'delivery_habilitado', 'costo_delivery', 'efectivo_enabled', 'mercadopago_enabled']
      }
    }
  });
  const configMap = buildConfigMap(configs);
  const tiendaAbierta = configMap.tienda_abierta !== 'false';
  const deliveryHabilitado = configMap.delivery_habilitado !== 'false';
  const efectivoHabilitado = configMap.efectivo_enabled !== 'false';
  const mercadopagoHabilitado = configMap.mercadopago_enabled === 'true';

  if (!Array.isArray(normalizedItems) || normalizedItems.length === 0) {
    throw createHttpError.badRequest('El pedido debe tener al menos un producto');
  }

  if (!clienteNombreValue || !clienteTelefonoValue) {
    throw createHttpError.badRequest('Nombre y telefono son requeridos');
  }

  if (tipoEntrega === 'DELIVERY' && !clienteDireccionValue) {
    throw createHttpError.badRequest('La direccion es requerida para delivery');
  }

  if (!tiendaAbierta) {
    throw createHttpError.badRequest('La tienda esta cerrada en este momento');
  }

  if (tipoEntrega === 'DELIVERY' && !deliveryHabilitado) {
    throw createHttpError.badRequest('El delivery no esta disponible en este momento');
  }

  if (metodoPago === 'EFECTIVO' && !efectivoHabilitado) {
    throw createHttpError.badRequest('El pago en efectivo no esta disponible en este momento');
  }

  if (metodoPago !== 'EFECTIVO' && montoAbonado != null) {
    throw createHttpError.badRequest('montoAbonado solo puede enviarse para pedidos en efectivo');
  }

  if (metodoPago === 'MERCADOPAGO') {
    if (!mercadopagoHabilitado) {
      throw createHttpError.badRequest('MercadoPago no esta disponible en este momento');
    }
    const mpConfigurado = await isMercadoPagoConfigured();
    if (!mpConfigurado) {
      throw createHttpError.badRequest(
        'MercadoPago no esta configurado para este negocio. Solo se acepta pago en efectivo.'
      );
    }
  }

  let costoEnvio = 0;
  if (tipoEntrega === 'DELIVERY') {
    costoEnvio = configMap.costo_delivery ? parseFloat(configMap.costo_delivery) : 0;
  }

  const productoIds = [...new Set(normalizedItems.map((item) => item.productoId))];
  const productos = await prisma.producto.findMany({
    where: {
      id: { in: productoIds },
      disponible: true
    },
    include: {
      ingredientes: {
        include: {
          ingrediente: {
            include: {
              stocks: {
                where: {
                  sucursalId: SUCURSAL_IDS.DELIVERY,
                  activo: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (productos.length !== productoIds.length) {
    throw createHttpError.badRequest('Algunos productos no estan disponibles');
  }

  assertProductsAvailableForSucursal(productos, SUCURSAL_IDS.DELIVERY, normalizedItems);

  let subtotal = 0;
  const itemsData = normalizedItems.map((item) => {
    const producto = productos.find((candidate) => candidate.id === item.productoId);
    const cantidad = item.cantidad;
    const precioUnitario = parseFloat(producto.precio);
    const itemSubtotal = precioUnitario * cantidad;
    subtotal += itemSubtotal;

    return {
      productoId: producto.id,
      cantidad,
      precioUnitario,
      subtotal: itemSubtotal,
      observaciones: item.observaciones || null
    };
  });

  const total = subtotal + costoEnvio;

  if (metodoPago === 'EFECTIVO' && montoAbonado != null && parseFloat(montoAbonado) + 0.01 < total) {
    throw createHttpError.badRequest('El monto abonado no alcanza para cubrir el pedido');
  }

  let pedido;

  try {
    pedido = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        sucursalId: SUCURSAL_IDS.DELIVERY,
        tipoEntrega,
        clienteNombre: clienteNombreValue,
        clienteTelefono: clienteTelefonoValue,
        clienteDireccion: tipoEntrega === 'DELIVERY' ? clienteDireccionValue : null,
        clienteEmail: clienteEmailValue,
        clientRequestId: clientRequestIdValue,
        costoEnvio,
        subtotal,
        total,
        observaciones: observacionesValue,
        origen: 'MENU_PUBLICO',
        estadoPago: 'PENDIENTE',
        operacionConfirmada: false,
        items: {
          create: itemsData
        }
      },
      select: {
        id: true,
        total: true,
        costoEnvio: true,
        clienteEmail: true,
        estado: true,
        estadoPago: true
      }
    });
  } catch (error) {
    if (!clientRequestIdValue || !isClientRequestIdConstraintError(error)) {
      throw error;
    }

    const existingPedido = await prisma.pedido.findUnique({
      where: { clientRequestId: clientRequestIdValue },
      select: {
        id: true,
        origen: true,
        total: true,
        costoEnvio: true,
        clienteEmail: true,
        estado: true,
        estadoPago: true
      }
    });

    if (!existingPedido || existingPedido.origen !== 'MENU_PUBLICO') {
      throw error;
    }

    return buildPublicCreateOrderResult(prisma, {
      negocio,
      pedido: existingPedido,
      metodoPago,
      shouldSendEmail: false,
      publishEvents: false
    });
  }

  logPublicAudit({
    action: 'public-order-created',
    requestMeta,
    pedidoId: pedido.id,
    clientRequestId: clientRequestIdValue,
    phone: clienteTelefonoValue,
    cause: `${tipoEntrega}:${metodoPago}`
  });

  if (metodoPago === 'EFECTIVO' && montoAbonado) {
    const vuelto = parseFloat(montoAbonado) - total;
    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: total,
        metodo: 'EFECTIVO',
        canalCobro: 'CHECKOUT_WEB',
        estado: 'PENDIENTE',
        montoAbonado: parseFloat(montoAbonado),
        vuelto: vuelto > 0 ? vuelto : 0
      }
    });
  }

  const shouldSendEmail = Boolean(pedido.clienteEmail && metodoPago !== 'MERCADOPAGO');
  try {
    return await buildPublicCreateOrderResult(prisma, {
      negocio,
      pedido,
      metodoPago,
      shouldSendEmail,
      publishEvents: true
    });
  } catch (error) {
    if (metodoPago === 'MERCADOPAGO') {
      logger.error('Error al crear preferencia MP, eliminando pedido', { error, pedidoId: pedido.id });
      await prisma.pedidoItem.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      throw createHttpError.internal('Error al conectar con MercadoPago. Por favor intenta de nuevo.');
    }

    throw error;
  }
};

const startMercadoPagoPaymentForOrder = async (prisma, {
  negocio,
  pedidoId,
  accessToken,
  skipAccessValidation = false
}) => {
  if (!skipAccessValidation) {
    assertPublicOrderAccess(pedidoId, accessToken);
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      items: { include: { producto: true } },
      pagos: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  if (pedido.origen !== 'MENU_PUBLICO') {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  if (pedido.estadoPago === 'APROBADO' || pedido.estado === 'COBRADO' || isPedidoTerminal(pedido.estado)) {
    throw createHttpError.badRequest('El pedido ya esta pagado');
  }

  const cobroActual = buildPedidoCobroSummary(pedido);
  if (cobroActual.fullyPaid) {
    throw createHttpError.badRequest('El pedido ya fue cubierto en su totalidad');
  }

  const config = await prisma.configuracion.findFirst({
    where: { clave: 'mercadopago_enabled' }
  });
  if (config?.valor !== 'true') {
    throw createHttpError.badRequest('MercadoPago no esta disponible en este momento');
  }

  const mpConfigurado = await isMercadoPagoConfigured();
  if (!mpConfigurado) {
    throw createHttpError.badRequest(
      'MercadoPago no esta configurado para este negocio. Solo se acepta pago en efectivo.'
    );
  }

  const preferenceData = buildPreferenceData({
    pedidoId,
    negocioNombre: negocio.nombre,
    items: pedido.items,
    costoEnvio: parseFloat(pedido.costoEnvio),
    accessToken
  });

  let response;
  try {
    response = await createPreference(preferenceData);
  } catch (error) {
    if (error.message?.includes('no esta configurado')) {
      throw createHttpError.badRequest(error.message);
    }
    throw error;
  }

  const idempotencyKey = `mp-${pedidoId}-${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    await cancelPendingPaymentsForChannel(tx, {
      pedidoId,
      canalCobro: 'CHECKOUT_WEB',
      metodo: 'MERCADOPAGO'
    });

    await tx.pago.create({
      data: {
        pedidoId,
        monto: cobroActual.pendiente,
        metodo: 'MERCADOPAGO',
        canalCobro: 'CHECKOUT_WEB',
        estado: 'PENDIENTE',
        mpPreferenceId: response.id,
        idempotencyKey
      }
    });
  });

  return {
    preferenceId: response.id,
    initPoint: response.init_point,
    sandboxInitPoint: response.sandbox_init_point
  };
};

const getPublicOrderStatus = async (prisma, { pedidoId, accessToken }) => {
  assertPublicOrderAccess(pedidoId, accessToken);

  let pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      items: { include: { producto: true } },
      pagos: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  if (pedido.origen !== 'MENU_PUBLICO') {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  const events = [];

  if (pedido.estadoPago === 'PENDIENTE') {
    const pagoMP = findOpenPagoForChannel(pedido.pagos, 'CHECKOUT_WEB', 'MERCADOPAGO');

    if (pagoMP) {
      const externalReference = `pedido-${pedidoId}`;
      const pagoAprobado = await searchPaymentByReference(externalReference);

      if (pagoAprobado) {
        const transactionResult = await prisma.$transaction(async (tx) => {
          const pagoActualizado = await tx.pago.update({
            where: { id: pagoMP.id },
            data: {
              estado: 'APROBADO',
              mpPaymentId: pagoAprobado.id.toString()
            }
          });

          let pedidoActualizado = pedido;
          if (!isPedidoTerminal(pedido.estado)) {
            const pagosActualizados = pedido.pagos.map((pago) => (
              pago.id === pagoMP.id
                ? { ...pago, estado: 'APROBADO', mpPaymentId: pagoAprobado.id.toString() }
                : pago
            ));
            const cobroActualizado = buildPedidoCobroSummary({
              total: pedido.total,
              pagos: pagosActualizados
            });
            const pedidoData = buildPedidoPaidUpdateData(pedido, cobroActualizado);

            pedidoActualizado = await tx.pedido.update({
              where: { id: pedidoId },
              data: pedidoData,
              include: {
                items: { include: { producto: true } },
                pagos: {
                  orderBy: { createdAt: 'desc' }
                }
              }
            });
          } else {
            logger.warn('Se aprobo un pago publico para un pedido terminal. Requiere revision manual.', {
              pedidoId,
              estado: pedido.estado
            });

            pedidoActualizado = {
              ...pedido,
              pagos: pedido.pagos.map((pago) => (
                pago.id === pagoMP.id
                  ? { ...pago, estado: 'APROBADO', mpPaymentId: pagoAprobado.id.toString() }
                  : pago
              ))
            };
          }

          await saveTransaction(pagoAprobado, pagoMP.id);

          return {
            pagoActualizado,
            pedidoActualizado
          };
        });

        if (!isPedidoTerminal(pedido.estado)) {
          if (pedido.origen === 'MENU_PUBLICO' && pedido.operacionConfirmada === false
            && transactionResult.pedidoActualizado.operacionConfirmada === true) {
            logPublicAudit({
              action: 'public-order-promoted-to-operation',
              pedidoId,
              phone: pedido.clienteTelefono,
              cause: 'payment-approved'
            });
          }

          events.push({
            topic: 'pedido.updated',
            payload: {
              id: pedidoId,
              estado: transactionResult.pedidoActualizado.estado,
              estadoPago: transactionResult.pedidoActualizado.estadoPago,
              tipo: pedido.tipo,
              mesaId: pedido.mesaId || null,
              updatedAt: new Date().toISOString()
            }
          });
        }

        pedido = transactionResult.pedidoActualizado;
      }
    }
  }

  const publicPedido = await getPublicPedidoResponse(prisma, pedidoId);

  return { pedido: publicPedido, events };
};

const getPublicTableSession = async (prisma, qrToken, requestMeta = {}) => prisma.$transaction(async (tx) => {
  const mesa = await tx.mesa.findUnique({
    where: { qrToken },
    select: {
      id: true,
      numero: true,
      sucursalId: true,
      zona: true,
      capacidad: true,
      estado: true,
      activa: true
    }
  });

  if (!mesa || !mesa.activa) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  const session = await issueMesaPublicSession(tx, { mesaId: mesa.id });

  logPublicAudit({
    action: 'mesa-qr-session-issued',
    requestMeta,
    mesaId: mesa.id,
    qrToken,
    cause: mesa.estado
  });

  return {
    mesa,
    session: {
      token: session.sessionToken,
      expiresAt: session.expiresAt
    }
  };
});

const createPublicTableOrder = async (prisma, { qrToken, body, requestMeta = {} }) => {
  const { items, clienteNombre, observaciones, sessionToken } = body;
  const normalizedItems = normalizePublicOrderItems(items);
  const clienteNombreValue = sanitizeOptionalText(clienteNombre);
  const observacionesValue = sanitizeOptionalText(observaciones);

  if (!Array.isArray(normalizedItems) || normalizedItems.length === 0) {
    throw createHttpError.badRequest('El pedido debe tener al menos un producto');
  }

  if (!clienteNombreValue) {
    throw createHttpError.badRequest('El nombre es requerido para identificar el pedido de mesa');
  }

  const mesa = await prisma.mesa.findUnique({
    where: { qrToken },
    select: {
      id: true,
      numero: true,
      sucursalId: true,
      estado: true,
      activa: true
    }
  });

  if (!mesa || !mesa.activa) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  if (['ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado)) {
    throw createHttpError.badRequest('La mesa no admite nuevos pedidos en este momento. Solicita asistencia al personal.');
  }

  if (mesa.estado === 'RESERVADA') {
    throw createHttpError.badRequest('La mesa no esta disponible para pedidos en este momento.');
  }

  const productoIds = [...new Set(normalizedItems.map((item) => item.productoId))];
  const productos = await prisma.producto.findMany({
    where: {
      id: { in: productoIds },
      disponible: true
    },
    include: {
      ingredientes: {
        include: {
          ingrediente: {
            include: {
              stocks: {
                where: {
                  sucursalId: mesa.sucursalId,
                  activo: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (productos.length !== productoIds.length) {
    throw createHttpError.badRequest('Algunos productos no estan disponibles');
  }

  assertProductsAvailableForSucursal(productos, mesa.sucursalId, normalizedItems);

  let subtotal = 0;
  const itemsData = normalizedItems.map((item) => {
    const producto = productos.find((candidate) => candidate.id === item.productoId);
    const cantidad = item.cantidad;
    const precioUnitario = parseFloat(producto.precio);
    const itemSubtotal = precioUnitario * cantidad;
    subtotal += itemSubtotal;

    return {
      productoId: producto.id,
      cantidad,
      precioUnitario,
      subtotal: itemSubtotal,
      observaciones: item.observaciones || null
    };
  });

  const result = await prisma.$transaction(async (tx) => {
    let session;
    try {
      session = await assertActiveMesaPublicSession(tx, {
        mesaId: mesa.id,
        sessionToken
      });
    } catch (error) {
      logPublicAbuseSignal({
        action: 'mesa-qr-invalid-session',
        requestMeta,
        mesaId: mesa.id,
        qrToken,
        cause: error.message
      });
      throw error;
    }

    const pedidoAbierto = await tx.pedido.findFirst({
      where: {
        mesaId: mesa.id,
        mesaPublicSessionId: session.id,
        estado: {
          notIn: ['CANCELADO', 'COBRADO', 'CERRADO']
        }
      },
      include: {
        items: { include: { producto: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let pedido;

    if (pedidoAbierto) {
      await tx.pedidoItem.createMany({
        data: itemsData.map((item) => ({
          pedidoId: pedidoAbierto.id,
          ...item
        }))
      });

        pedido = await tx.pedido.update({
          where: { id: pedidoAbierto.id },
          data: {
            subtotal: { increment: subtotal },
            total: { increment: subtotal },
          clienteNombre: pedidoAbierto.clienteNombre || clienteNombreValue,
          observaciones: observacionesValue
            ? [pedidoAbierto.observaciones, observacionesValue].filter(Boolean).join(' | ')
            : pedidoAbierto.observaciones
        },
        include: {
          items: { include: { producto: true } },
          mesa: true
        }
      });
    } else {
        pedido = await tx.pedido.create({
          data: {
            tipo: 'MESA',
            sucursalId: mesa.sucursalId,
            mesaId: mesa.id,
            mesaPublicSessionId: session.id,
            clienteNombre: clienteNombreValue,
            subtotal,
            total: subtotal,
            observaciones: observacionesValue,
            origen: 'MENU_PUBLICO',
            estadoPago: 'PENDIENTE',
            operacionConfirmada: true,
            items: {
              create: itemsData
            }
        },
        include: {
          items: { include: { producto: true } },
          mesa: true
        }
      });
    }

      await tx.mesa.update({
        where: { id: mesa.id },
        data: { estado: 'OCUPADA' }
      });

      return {
        pedido,
        session
      };
    });

  logPublicAudit({
    action: 'mesa-qr-order-created',
    requestMeta,
    pedidoId: result.pedido.id,
    mesaId: mesa.id,
    qrToken,
    cause: `items:${normalizedItems.length}`
  });

  return {
    mesa,
    pedido: result.pedido,
    events: [
      {
        topic: 'pedido.updated',
        payload: {
            id: result.pedido.id,
            estado: result.pedido.estado,
            tipo: result.pedido.tipo,
            mesaId: result.pedido.mesaId || null,
            updatedAt: result.pedido.updatedAt || new Date().toISOString()
        }
      },
      {
        topic: 'mesa.updated',
        payload: {
          mesaId: mesa.id,
          estado: 'OCUPADA',
          updatedAt: new Date().toISOString()
        }
      }
    ]
  };
};

module.exports = {
  getPublicConfig,
  getPublicMenu,
  createPublicOrder,
  startMercadoPagoPaymentForOrder,
  getPublicOrderStatus,
  getPublicTableSession,
  createPublicTableOrder
};
