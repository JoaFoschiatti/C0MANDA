const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');
const { getNegocio } = require('../db/prisma');
const { signPublicOrderToken, matchesPublicOrderToken } = require('../utils/public-order-access');
const { SUCURSAL_IDS } = require('../constants/sucursales');
const { decimalToNumber: toNumber } = require('../utils/decimal');
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
    include: {
      productos: {
        where: {
          disponible: true,
          productoBaseId: null
        },
        orderBy: { nombre: 'asc' },
        include: {
          ingredientes: {
            include: {
              ingrediente: {
                include: {
                  stocks: {
                    where: {
                      sucursalId,
                      activo: true
                    }
                  }
                }
              }
            }
          },
          variantes: {
            where: { disponible: true },
            orderBy: { ordenVariante: 'asc' },
            include: {
              ingredientes: {
                include: {
                  ingrediente: {
                    include: {
                      stocks: {
                        where: {
                          sucursalId,
                          activo: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return categorias
    .map((categoria) => ({
      ...categoria,
      productos: (categoria.productos || [])
        .map((producto) => ({
          ...producto,
          variantes: (producto.variantes || []).filter((variante) => productHasStockInSucursal(variante, sucursalId))
        }))
        .filter((producto) => productHasStockInSucursal(producto, sucursalId))
    }))
    .filter((categoria) => categoria.productos.length > 0);
};

const createPublicOrder = async (prisma, { negocio, body }) => {
  const {
    items,
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    clienteEmail,
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

  const pedido = await prisma.pedido.create({
    data: {
      tipo: 'DELIVERY',
      sucursalId: SUCURSAL_IDS.DELIVERY,
      tipoEntrega,
      clienteNombre: clienteNombreValue,
      clienteTelefono: clienteTelefonoValue,
      clienteDireccion: tipoEntrega === 'DELIVERY' ? clienteDireccionValue : null,
      clienteEmail: clienteEmailValue,
      costoEnvio,
      subtotal,
      total,
      observaciones: observacionesValue,
      origen: 'MENU_PUBLICO',
      estadoPago: 'PENDIENTE',
      items: {
        create: itemsData
      }
    },
    include: {
      items: {
        include: { producto: true }
      }
    }
  });
  const accessToken = signPublicOrderToken(pedido.id);

  let initPoint = null;

  if (metodoPago === 'MERCADOPAGO') {
    try {
      const preferenceData = buildPreferenceData({
        pedidoId: pedido.id,
        negocioNombre: negocio.nombre,
        items: pedido.items,
        costoEnvio,
        accessToken
      });

      const mpResponse = await createPreference(preferenceData);

      const idempotencyKey = `mp-${pedido.id}-${Date.now()}`;
      await prisma.pago.create({
        data: {
          pedidoId: pedido.id,
          monto: total,
          metodo: 'MERCADOPAGO',
          canalCobro: 'CHECKOUT_WEB',
          estado: 'PENDIENTE',
          mpPreferenceId: mpResponse.id,
          idempotencyKey
        }
      });

      initPoint = mpResponse.init_point;
    } catch (mpError) {
      logger.error('Error al crear preferencia MP, eliminando pedido', { error: mpError, pedidoId: pedido.id });
      await prisma.pedidoItem.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      throw createHttpError.internal('Error al conectar con MercadoPago. Por favor intenta de nuevo.');
    }
  }

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

  return {
    negocio,
    pedido,
    costoEnvio,
    total,
    initPoint,
    accessToken,
    shouldSendEmail,
    events: [
      {
        topic: 'pedido.updated',
        payload: {
          id: pedido.id,
          estado: pedido.estado,
          tipo: pedido.tipo,
          mesaId: pedido.mesaId || null,
          updatedAt: pedido.updatedAt || new Date().toISOString()
        }
      }
    ]
  };
};

const startMercadoPagoPaymentForOrder = async (prisma, { negocio, pedidoId, accessToken }) => {
  assertPublicOrderAccess(pedidoId, accessToken);

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

            pedidoActualizado = await tx.pedido.update({
              where: { id: pedidoId },
              data: cobroActualizado.fullyPaid
                ? {
                  estadoPago: 'APROBADO',
                  estado: 'COBRADO'
                }
                : {
                  estadoPago: 'PENDIENTE'
                },
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

  return { pedido, events };
};

const getPublicTableSession = async (prisma, qrToken) => {
  const mesa = await prisma.mesa.findUnique({
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

  return mesa;
};

const createPublicTableOrder = async (prisma, { qrToken, body }) => {
  const { items, clienteNombre, observaciones } = body;
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
    const pedidoAbierto = await tx.pedido.findFirst({
      where: {
        mesaId: mesa.id,
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
          clienteNombre: clienteNombreValue,
          subtotal,
          total: subtotal,
          observaciones: observacionesValue,
          origen: 'MENU_PUBLICO',
          estadoPago: 'PENDIENTE',
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

    return pedido;
  });

  return {
    mesa,
    pedido: result,
    events: [
      {
        topic: 'pedido.updated',
        payload: {
          id: result.id,
          estado: result.estado,
          tipo: result.tipo,
          mesaId: result.mesaId || null,
          updatedAt: result.updatedAt || new Date().toISOString()
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
