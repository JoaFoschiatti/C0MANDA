/**
 * Servicio de gestión de pedidos.
 *
 * Este servicio maneja toda la lógica de negocio relacionada con pedidos:
 * - Creación de pedidos con items y modificadores
 * - Cambio de estados (PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO → COBRADO)
 * - Descuento automático de stock de ingredientes
 * - Liberación de mesas al cobrar
 * - Cancelación con reversión de stock
 *
 * @module pedidos.service
 */

const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const printService = require('./print.service');
const { registrarAuditoriaPedido } = require('./pedido-auditoria.service');
const {
  buildAutoLoteCode,
  consumirLotesFIFO,
  registrarEntradaEnLote,
  sincronizarStockIngrediente
} = require('./lotes-stock.service');
const { ensureBaseSucursales } = require('./sucursales.service');
const { SUCURSAL_IDS } = require('../constants/sucursales');
const { buildPedidoCobroSummary } = require('./payment-state.service');
const {
  assertPedidoTransition,
  canAddItemsToPedido
} = require('./order-state.service');

const DEFAULT_PEDIDOS_LIMIT = 50;

const PRINT_JOB_SUMMARY_SELECT = {
  status: true,
  batchId: true,
  createdAt: true,
  lastError: true
};

const PEDIDO_PAGO_LIST_SELECT = {
  id: true,
  monto: true,
  estado: true,
  canalCobro: true,
  referencia: true,
  comprobante: true,
  propinaMonto: true,
  createdAt: true
};

const PEDIDO_PAGO_DETAIL_SELECT = {
  id: true,
  pedidoId: true,
  monto: true,
  metodo: true,
  canalCobro: true,
  estado: true,
  referencia: true,
  comprobante: true,
  propinaMonto: true,
  propinaMetodo: true,
  mpPreferenceId: true,
  mpPaymentId: true,
  montoAbonado: true,
  vuelto: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true
};

const PEDIDO_COMPROBANTE_SELECT = {
  id: true,
  estado: true,
  tipoComprobante: true,
  numeroComprobante: true,
  cae: true,
  caeVencimiento: true,
  createdAt: true
};

const PEDIDO_ITEM_MODIFICADOR_SELECT = {
  id: true,
  modificadorId: true,
  precio: true,
  modificador: {
    select: {
      id: true,
      nombre: true,
      tipo: true,
      precio: true
    }
  }
};

const PEDIDO_ITEM_SELECT = {
  id: true,
  rondaId: true,
  productoId: true,
  cantidad: true,
  precioUnitario: true,
  subtotal: true,
  observaciones: true,
  createdAt: true,
  producto: {
    select: {
      id: true,
      nombre: true,
      precio: true
    }
  },
  modificadores: {
    select: PEDIDO_ITEM_MODIFICADOR_SELECT
  }
};

const PEDIDO_ROUNDA_SELECT = {
  id: true,
  numero: true,
  enviadaCocinaAt: true,
  stockAplicadoAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: PEDIDO_ITEM_SELECT,
    orderBy: { createdAt: 'asc' }
  }
};

const PEDIDO_LIST_SELECT = {
  id: true,
  tipo: true,
  estado: true,
  estadoPago: true,
  origen: true,
  operacionConfirmada: true,
  mesaId: true,
  clienteNombre: true,
  repartidorId: true,
  total: true,
  createdAt: true,
  mesa: {
    select: {
      id: true,
      numero: true
    }
  },
  repartidor: {
    select: {
      id: true,
      nombre: true
    }
  },
  pagos: {
    select: PEDIDO_PAGO_LIST_SELECT
  },
  printJobs: {
    select: PRINT_JOB_SUMMARY_SELECT
  },
  comprobanteFiscal: {
    select: PEDIDO_COMPROBANTE_SELECT
  }
};

const PEDIDO_DETAIL_SELECT = {
  id: true,
  tipo: true,
  estado: true,
  sucursalId: true,
  mesaId: true,
  usuarioId: true,
  clienteNombre: true,
  clienteTelefono: true,
  clienteDireccion: true,
  clienteEmail: true,
  repartidorId: true,
  tipoEntrega: true,
  costoEnvio: true,
  subtotal: true,
  descuento: true,
  total: true,
  observaciones: true,
  estadoPago: true,
  origen: true,
  operacionConfirmada: true,
  impreso: true,
  createdAt: true,
  updatedAt: true,
  sucursal: {
    select: {
      id: true,
      nombre: true,
      codigo: true
    }
  },
  mesa: {
    select: {
      id: true,
      numero: true,
      estado: true,
      sucursalId: true
    }
  },
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true
    }
  },
  repartidor: {
    select: {
      id: true,
      nombre: true
    }
  },
  items: {
    select: {
      ...PEDIDO_ITEM_SELECT,
      ronda: {
        select: {
          id: true,
          numero: true,
          enviadaCocinaAt: true,
          stockAplicadoAt: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  },
  rondas: {
    select: PEDIDO_ROUNDA_SELECT,
    orderBy: { numero: 'asc' }
  },
  pagos: {
    select: PEDIDO_PAGO_DETAIL_SELECT
  },
  printJobs: {
    select: PRINT_JOB_SUMMARY_SELECT
  },
  comprobanteFiscal: {
    select: PEDIDO_COMPROBANTE_SELECT
  }
};

const attachPedidoImpresionSummary = (pedido) => {
  const impresion = printService.getLatestPrintSummary(pedido.printJobs || []);
  const { printJobs: _printJobs, ...rest } = pedido;
  return { ...rest, impresion };
};

const OPEN_PEDIDO_WHERE = {
  estado: { notIn: ['CERRADO', 'CANCELADO'] }
};

const findOpenPedidoByMesa = async (tx, mesaId) => tx.pedido.findFirst({
  where: {
    mesaId,
    ...OPEN_PEDIDO_WHERE
  },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    estado: true,
    mesaId: true
  }
});

const createMesaPedidoConflict = (pedido) => createHttpError.conflict(
  'La mesa ya tiene un pedido abierto',
  pedido ? { pedidoId: pedido.id, mesaId: pedido.mesaId, estado: pedido.estado } : undefined
);

const resolvePedidoSucursal = async (tx, { tipo, mesaId, sucursalId }) => {
  await ensureBaseSucursales(tx);

  if (tipo === 'MESA') {
    const mesa = await tx.mesa.findUnique({
      where: { id: mesaId },
      select: { id: true, sucursalId: true }
    });

    if (!mesa) {
      throw createHttpError.notFound('Mesa no encontrada');
    }

    return {
      mesa,
      sucursalId: mesa.sucursalId
    };
  }

  const fallbackSucursalId = tipo === 'DELIVERY'
    ? SUCURSAL_IDS.DELIVERY
    : SUCURSAL_IDS.SALON;
  const resolvedSucursalId = sucursalId || fallbackSucursalId;

  const sucursal = await tx.sucursal.findUnique({
    where: { id: resolvedSucursalId },
    select: { id: true, activa: true }
  });

  if (!sucursal || sucursal.activa === false) {
    throw createHttpError.badRequest('Sucursal no disponible');
  }

  return {
    mesa: null,
    sucursalId: resolvedSucursalId
  };
};

/**
 * Validates modifier IDs against the available modifiers map and returns
 * the validated modifier objects along with their aggregated price.
 *
 * @private
 * @param {Array<number>} itemModificadores - Modifier IDs requested for the item
 * @param {Map<number, Object>} disponibles - Map of available modifiers keyed by ID
 * @returns {{ mods: Array<Object>, precioModificadores: number }}
 */
const validateAndMapModificadores = (itemModificadores, disponibles) => {
  let precioModificadores = 0;
  const mods = (itemModificadores || []).map(modId => {
    const mod = disponibles.get(modId);
    if (!mod) {
      throw createHttpError.badRequest(`Modificador ${modId} no encontrado`);
    }
    if (!mod.activo) {
      throw createHttpError.badRequest(`Modificador "${mod.nombre}" no está activo`);
    }
    precioModificadores += parseFloat(mod.precio);
    return mod;
  });
  return { mods, precioModificadores };
};

/**
 * Construye los items de un pedido con precios calculados.
 *
 * Esta función auxiliar:
 * 1. Valida que todos los productos existan y estén disponibles
 * 2. Valida que todos los modificadores existan y estén activos
 * 3. Calcula el precio unitario (producto + modificadores)
 * 4. Calcula el subtotal de cada item
 *
 * @private
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Array<Object>} items - Items del pedido
 * @param {number} items[].productoId - ID del producto
 * @param {number} items[].cantidad - Cantidad
 * @param {Array<number>} [items[].modificadores] - IDs de modificadores
 * @param {string} [items[].observaciones] - Observaciones del item
 *
 * @returns {Promise<Object>} Resultado con items procesados
 * @returns {number} returns.subtotal - Subtotal calculado
 * @returns {Array} returns.itemsConPrecio - Items con precios calculados
 * @returns {Array} returns.pedidoItemModificadores - Modificadores por item
 *
 * @throws {HttpError} 400 - Si no hay items
 * @throws {HttpError} 400 - Si un producto no existe o no está disponible
 * @throws {HttpError} 400 - Si un modificador no existe o no está activo
 */
const buildPedidoItems = async (prisma, items) => {
  if (!items || items.length === 0) {
    throw createHttpError.badRequest('El pedido debe tener al menos un item');
  }

  const productIds = [...new Set(items.map(item => item.productoId))];
  const productos = await prisma.producto.findMany({
    where: { id: { in: productIds } },
    select: { id: true, nombre: true, precio: true, disponible: true }
  });

  const productoById = new Map(productos.map(p => [p.id, p]));

  const modificadorIds = [
    ...new Set(items.flatMap(item => (item.modificadores || [])))
  ];

  const modificadores = modificadorIds.length
    ? await prisma.modificador.findMany({
      where: { id: { in: modificadorIds } },
      select: { id: true, nombre: true, precio: true, activo: true }
    })
    : [];

  const modificadorById = new Map(modificadores.map(m => [m.id, m]));

  let subtotal = 0;
  const itemsConPrecio = [];
  const pedidoItemModificadores = [];

  for (const item of items) {
    const producto = productoById.get(item.productoId);
    if (!producto) {
      throw createHttpError.badRequest(`Producto ${item.productoId} no encontrado`);
    }
    if (!producto.disponible) {
      throw createHttpError.badRequest(`Producto "${producto.nombre}" no está disponible`);
    }

    const { mods, precioModificadores } = validateAndMapModificadores(item.modificadores, modificadorById);

    const precioUnitario = parseFloat(producto.precio) + precioModificadores;
    const itemSubtotal = precioUnitario * item.cantidad;
    subtotal += itemSubtotal;

    itemsConPrecio.push({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario,
      subtotal: itemSubtotal,
      observaciones: item.observaciones
    });

    pedidoItemModificadores.push(mods);
  }

  return { subtotal, itemsConPrecio, pedidoItemModificadores };
};

const createPedidoRonda = async (tx, { pedidoId, usuarioId = null, marcaOperativa = false }) => {
  const now = new Date();
  const { _max } = await tx.pedidoRonda.aggregate({
    where: { pedidoId },
    _max: { numero: true }
  });

  return tx.pedidoRonda.create({
    data: {
      pedidoId,
      usuarioId,
      numero: (_max.numero || 0) + 1,
      ...(marcaOperativa
        ? {
            enviadaCocinaAt: now,
            stockAplicadoAt: now
          }
        : {})
    }
  });
};

const createPedidoItemsForRound = async (tx, {
  pedidoId,
  rondaId,
  itemsConPrecio,
  pedidoItemModificadores
}) => {
  const createdItems = await Promise.all(
    itemsConPrecio.map((itemData) => tx.pedidoItem.create({
      data: {
        pedidoId,
        rondaId,
        ...itemData
      }
    }))
  );

  const modificadoresToCreate = [];
  for (let idx = 0; idx < createdItems.length; idx += 1) {
    const pedidoItem = createdItems[idx];
    const mods = pedidoItemModificadores[idx] || [];
    for (const mod of mods) {
      modificadoresToCreate.push({
        pedidoItemId: pedidoItem.id,
        modificadorId: mod.id,
        precio: mod.precio
      });
    }
  }

  if (modificadoresToCreate.length) {
    await tx.pedidoItemModificador.createMany({
      data: modificadoresToCreate
    });
  }

  return createdItems;
};

const getPedidoByIdWithDetail = async (prisma, pedidoId) => {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: PEDIDO_DETAIL_SELECT
  });

  return pedido ? attachPedidoImpresionSummary(pedido) : null;
};

const getPedidoRoundsForOperation = async (tx, pedidoId, where = {}) => tx.pedidoRonda.findMany({
  where: {
    pedidoId,
    ...where
  },
  orderBy: { numero: 'asc' },
  include: {
    items: {
      include: {
        producto: {
          include: {
            ingredientes: true
          }
        },
        modificadores: {
          include: {
            modificador: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    }
  }
});

const applyRoundsStock = async (tx, pedido, rondas = []) => {
  if (!rondas.length) {
    return;
  }

  const ingredienteUpdates = new Map();

  for (const ronda of rondas) {
    for (const item of ronda.items) {
      for (const prodIng of item.producto.ingredientes) {
        const cantidadDescontar = parseFloat(prodIng.cantidad) * item.cantidad;
        const ingredienteId = prodIng.ingredienteId;
        const currentTotal = ingredienteUpdates.get(ingredienteId) || 0;
        ingredienteUpdates.set(ingredienteId, currentTotal + cantidadDescontar);
      }
    }
  }

  for (const [ingredienteId, cantidadTotal] of ingredienteUpdates.entries()) {
    const ingrediente = await tx.ingrediente.findUnique({
      where: { id: ingredienteId },
      select: { id: true, nombre: true, stockActual: true }
    });

    const ingredienteSincronizado = await sincronizarStockIngrediente(
      tx,
      ingrediente,
      pedido.sucursalId,
      new Date()
    );
    const stockActual = parseFloat(ingredienteSincronizado?.stockActual || 0);

    if (stockActual < cantidadTotal) {
      throw createHttpError.badRequest(
        `Stock insuficiente de ${ingrediente.nombre} para completar el pedido. Disponible: ${stockActual}, Necesario: ${cantidadTotal}`
      );
    }

    await consumirLotesFIFO(tx, {
      ingredienteId,
      sucursalId: pedido.sucursalId,
      cantidad: cantidadTotal,
      motivo: `Pedido #${pedido.id}`,
      pedidoId: pedido.id,
      tipoMovimiento: 'SALIDA'
    });
  }

  await tx.pedidoRonda.updateMany({
    where: { id: { in: rondas.map((ronda) => ronda.id) } },
    data: { stockAplicadoAt: new Date() }
  });
};

const markRoundsSentToKitchen = async (prisma, rondaIds = []) => {
  if (!rondaIds.length) {
    return;
  }

  await prisma.pedidoRonda.updateMany({
    where: { id: { in: rondaIds } },
    data: { enviadaCocinaAt: new Date() }
  });
};

const resolvePedidoEstadoAfterItemsAdded = (estadoActual) => {
  if (estadoActual === 'PENDIENTE' || estadoActual === 'EN_PREPARACION') {
    return estadoActual;
  }

  return 'EN_PREPARACION';
};

/**
 * Crea un nuevo pedido con sus items y modificadores.
 *
 * Este servicio maneja la creación completa de un pedido incluyendo:
 * - Validación de productos y disponibilidad
 * - Cálculo de precios con modificadores
 * - Actualización del estado de la mesa a OCUPADA (si aplica)
 * - Creación de items con sus modificadores en una transacción
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma global
 * @param {Object} payload - Datos del pedido
 * @param {('MESA'|'DELIVERY'|'MOSTRADOR')} payload.tipo - Tipo de pedido
 * @param {number} [payload.mesaId] - ID de mesa (requerido si tipo='MESA')
 * @param {number} [payload.usuarioId] - ID del usuario que crea el pedido
 * @param {Array<Object>} payload.items - Items del pedido
 * @param {number} payload.items[].productoId - ID del producto
 * @param {number} payload.items[].cantidad - Cantidad (mínimo 1)
 * @param {Array<number>} [payload.items[].modificadores] - IDs de modificadores
 * @param {string} [payload.items[].observaciones] - Observaciones del item
 * @param {string} [payload.clienteNombre] - Nombre del cliente (delivery)
 * @param {string} [payload.clienteTelefono] - Teléfono del cliente
 * @param {string} [payload.clienteDireccion] - Dirección de entrega
 * @param {string} [payload.observaciones] - Observaciones generales
 *
 * @returns {Promise<Object>} Resultado de la creación
 * @returns {Object} returns.pedido - Pedido creado con relaciones incluidas
 * @returns {Object|null} returns.mesaUpdated - Info de mesa actualizada o null
 *
 * @throws {HttpError} 400 - Mesa requerida para pedidos de tipo MESA
 * @throws {HttpError} 404 - Mesa no encontrada
 * @throws {HttpError} 400 - Producto no disponible
 *
 * @example
 * const result = await crearPedido(prisma, {
 *   tipo: 'MESA',
 *   mesaId: 1,
 *   usuarioId: 5,
 *   items: [
 *     { productoId: 10, cantidad: 2, modificadores: [1, 3] },
 *     { productoId: 15, cantidad: 1, observaciones: 'Sin cebolla' }
 *   ]
 * });
 */
const crearPedido = async (prisma, payload) => {
  const {
    tipo,
    mesaId,
    sucursalId,
    items,
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    observaciones,
    usuarioId
  } = payload;

  if (tipo === 'MESA' && !mesaId) {
    throw createHttpError.badRequest('Mesa requerida para pedidos de tipo MESA');
  }

  const { subtotal, itemsConPrecio, pedidoItemModificadores } = await buildPedidoItems(prisma, items);

  const { pedidoId, mesaUpdated } = await prisma.$transaction(async (tx) => {
    let mesaUpdatedLocal = null;
    const pedidoScope = await resolvePedidoSucursal(tx, {
      tipo,
      mesaId,
      sucursalId
    });

    if (tipo === 'MESA' && mesaId) {
      const pedidoAbierto = await findOpenPedidoByMesa(tx, mesaId);
      if (pedidoAbierto) {
        throw createMesaPedidoConflict(pedidoAbierto);
      }

      await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: 'OCUPADA' }
      });

      mesaUpdatedLocal = { mesaId, estado: 'OCUPADA' };
    }

    const pedido = await tx.pedido.create({
      data: {
        tipo,
        sucursalId: pedidoScope.sucursalId,
        mesaId: tipo === 'MESA' ? mesaId : null,
        usuarioId,
        clienteNombre,
        clienteTelefono,
        clienteDireccion,
        subtotal,
        total: subtotal,
        observaciones
      }
    });

    const ronda = await createPedidoRonda(tx, {
      pedidoId: pedido.id,
      usuarioId
    });

    await createPedidoItemsForRound(tx, {
      pedidoId: pedido.id,
      rondaId: ronda.id,
      itemsConPrecio,
      pedidoItemModificadores
    });

    return { pedidoId: pedido.id, mesaUpdated: mesaUpdatedLocal };
  });

  const pedidoCompleto = await getPedidoByIdWithDetail(prisma, pedidoId);

  return { pedido: pedidoCompleto, mesaUpdated };
};

/**
 * Cambia el estado de un pedido y ejecuta acciones asociadas.
 *
 * Flujo de estados válidos:
 * ```
 * PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO → COBRADO
 *     ↓              ↓           ↓         ↓
 * CANCELADO    CANCELADO    CANCELADO  CANCELADO
 * ```
 *
 * Acciones automáticas por estado:
 * - **EN_PREPARACION**: Descuenta stock de ingredientes, crea movimientos,
 *   marca productos como agotados si el stock llega a 0
 * - **COBRADO**: Libera la mesa (cambia a LIBRE)
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos para el cambio de estado
 * @param {number} payload.pedidoId - ID del pedido
 * @param {('PENDIENTE'|'EN_PREPARACION'|'LISTO'|'ENTREGADO'|'COBRADO'|'CANCELADO')} payload.estado - Nuevo estado
 *
 * @returns {Promise<Object>} Resultado del cambio de estado
 * @returns {Object} returns.pedidoAntes - Estado previo del pedido (para comparación)
 * @returns {Object} returns.pedidoActualizado - Pedido con el nuevo estado
 * @returns {Array<number>} returns.roundIdsToPrint - IDs de rondas a imprimir en cocina
 * @returns {Array<Object>} returns.mesaUpdates - Mesas que cambiaron estado [{mesaId, estado}]
 * @returns {Array<Object>} returns.productosAgotados - Productos marcados como no disponibles
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 *
 * @example
 * // Enviar pedido a cocina
 * const result = await cambiarEstadoPedido(prisma, {
 *   pedidoId: 123,
 *   estado: 'EN_PREPARACION'
 * });
 *
 * if (result.roundIdsToPrint.length > 0) {
 *   await imprimirComanda(result.pedidoActualizado);
 * }
 *
 * if (result.productosAgotados.length > 0) {
 *   notificarProductosAgotados(result.productosAgotados);
 * }
 */
const cambiarEstadoPedido = async (prisma, payload) => {
  const { pedidoId, estado, usuarioId = null } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        mesa: true,
        pagos: true
      }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    assertPedidoTransition(pedido.estado, estado);

    let estadoDestino = estado;
    const confirmarOperacionPublica = (
      pedido.origen === 'MENU_PUBLICO' &&
      pedido.operacionConfirmada === false &&
      estado === 'EN_PREPARACION'
    );

    if (estado === 'ENTREGADO' && pedido.estadoPago === 'APROBADO') {
      estadoDestino = 'COBRADO';
    }

    const mesaUpdates = [];
    const productosAgotados = [];
    let roundIdsToPrint = [];

    if (estado === 'EN_PREPARACION' && pedido.estado === 'PENDIENTE') {
      const rondasPendientes = await getPedidoRoundsForOperation(tx, pedido.id, {
        enviadaCocinaAt: null
      });
      const rondasPendientesStock = rondasPendientes.filter((ronda) => !ronda.stockAplicadoAt);

      await applyRoundsStock(tx, pedido, rondasPendientesStock);
      roundIdsToPrint = rondasPendientes.map((ronda) => ronda.id);
    }

    if (estadoDestino === 'CERRADO' && pedido.mesaId) {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'CERRADA' }
      });
      mesaUpdates.push({ mesaId: pedido.mesaId, estado: 'CERRADA' });
    }

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: estadoDestino,
        ...(confirmarOperacionPublica ? { operacionConfirmada: true } : {})
      },
      select: PEDIDO_DETAIL_SELECT
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: `ESTADO_${estadoDestino}`,
      snapshotAntes: pedido,
      snapshotDespues: pedidoActualizado
    });

    return {
      pedidoAntes: pedido,
      pedidoActualizado: attachPedidoImpresionSummary(pedidoActualizado),
      roundIdsToPrint,
      mesaUpdates,
      productosAgotados
    };
  });

  return result;
};

/**
 * Agrega items adicionales a un pedido existente.
 *
 * Permite agregar más productos a un pedido abierto y crear una nueva ronda.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos de los items a agregar
 * @param {number} payload.pedidoId - ID del pedido
 * @param {Array<Object>} payload.items - Nuevos items
 * @param {number} payload.items[].productoId - ID del producto
 * @param {number} payload.items[].cantidad - Cantidad
 * @param {string} [payload.items[].observaciones] - Observaciones
 *
 * @returns {Promise<Object>} Resultado con pedido actualizado y ronda creada
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 * @throws {HttpError} 400 - No se pueden agregar items a pedido CERRADO o CANCELADO
 * @throws {HttpError} 400 - Producto no disponible
 */
const agregarItemsPedido = async (prisma, payload) => {
  const { pedidoId, items, usuarioId = null } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        mesa: true,
        pagos: true
      }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (!canAddItemsToPedido(pedido.estado)) {
      throw createHttpError.badRequest('No se pueden agregar items a este pedido');
    }

    const { subtotal, itemsConPrecio, pedidoItemModificadores } = await buildPedidoItems(tx, items);
    const ronda = await createPedidoRonda(tx, {
      pedidoId: pedido.id,
      usuarioId
    });

    await createPedidoItemsForRound(tx, {
      pedidoId: pedido.id,
      rondaId: ronda.id,
      itemsConPrecio,
      pedidoItemModificadores
    });

    const nuevoCobro = buildPedidoCobroSummary({
      total: parseFloat(pedido.total) + subtotal,
      pagos: pedido.pagos
    });
    const estadoDestino = resolvePedidoEstadoAfterItemsAdded(pedido.estado);
    let mesaUpdated = null;

    if (pedido.estado !== 'PENDIENTE') {
      const [rondaOperativa] = await getPedidoRoundsForOperation(tx, pedido.id, { id: ronda.id });

      if (rondaOperativa && !rondaOperativa.stockAplicadoAt) {
        await applyRoundsStock(tx, pedido, [rondaOperativa]);
      }
    }

    if (pedido.mesaId && pedido.mesa?.estado !== 'OCUPADA') {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'OCUPADA' }
      });
      mesaUpdated = { mesaId: pedido.mesaId, estado: 'OCUPADA' };
    }

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        subtotal: { increment: subtotal },
        total: { increment: subtotal },
        estado: estadoDestino,
        estadoPago: nuevoCobro.fullyPaid ? 'APROBADO' : 'PENDIENTE'
      }
    });

    const pedidoActualizado = await getPedidoByIdWithDetail(tx, pedido.id);
    const rondaActualizada = pedidoActualizado?.rondas?.find((item) => item.id === ronda.id) || null;

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: `ITEMS_AGREGADOS_RONDA_${ronda.numero}`,
      snapshotAntes: pedido,
      snapshotDespues: pedidoActualizado
    });

    return {
      pedido: pedidoActualizado,
      ronda: rondaActualizada,
      mesaUpdated,
      roundIdsToPrint: pedido.estado === 'PENDIENTE' ? [] : [ronda.id]
    };
  });

  return result;
};

/**
 * Cancela un pedido y revierte el stock si es necesario.
 *
 * Si el pedido ya había pasado a EN_PREPARACION (stock descontado),
 * esta función revierte los movimientos de stock creando entradas.
 * También libera la mesa si el pedido era de tipo MESA.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos de cancelación
 * @param {number} payload.pedidoId - ID del pedido a cancelar
 * @param {string} [payload.motivo] - Motivo de la cancelación
 *
 * @returns {Promise<Object>} Resultado de la cancelación
 * @returns {Object} returns.pedidoCancelado - Pedido con estado CANCELADO
 * @returns {Object|null} returns.mesaUpdated - Info de mesa liberada o null
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 * @throws {HttpError} 400 - No se puede cancelar un pedido ya cobrado
 */
const cancelarPedido = async (prisma, payload) => {
  const { pedidoId, motivo, usuarioId = null } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { movimientos: true }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedido.estado)) {
      throw createHttpError.badRequest('No se puede cancelar un pedido finalizado');
    }

    // Si el pedido ya paso de PENDIENTE, el stock fue deducido.
    // Revertir creando movimientos ENTRADA que devuelven el stock a los lotes originales.
    if (pedido.estado !== 'PENDIENTE') {
      const salidaMovementsLote = pedido.movimientos.filter(mov => mov.tipo === 'SALIDA');

      if (salidaMovementsLote.length > 0) {
        for (const mov of salidaMovementsLote) {
          await registrarEntradaEnLote(tx, {
            ingredienteId: mov.ingredienteId,
            sucursalId: mov.sucursalId || pedido.sucursalId,
            loteStockId: mov.loteStockId || null,
            cantidad: parseFloat(mov.cantidad),
            motivo: `Cancelacion pedido #${pedido.id}`,
            pedidoId: pedido.id,
            tipoMovimiento: 'ENTRADA',
            incrementStockInicial: false,
            codigoLote: mov.loteStockId ? null : buildAutoLoteCode(`DEV-${pedido.id}-${mov.ingredienteId}`)
          });
        }

        pedido.movimientos = pedido.movimientos.filter(mov => mov.tipo !== 'SALIDA');
      }
    }

    let mesaUpdated = null;
    if (pedido.mesaId) {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'LIBRE' }
      });
      mesaUpdated = { mesaId: pedido.mesaId, estado: 'LIBRE' };
    }

    const observaciones = pedido.observaciones
      ? `${pedido.observaciones} | CANCELADO: ${motivo || 'Sin motivo'}`
      : `CANCELADO: ${motivo || 'Sin motivo'}`;

    const pedidoCancelado = await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'CANCELADO',
        observaciones
      }
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: 'PEDIDO_CANCELADO',
      motivo,
      snapshotAntes: pedido,
      snapshotDespues: pedidoCancelado
    });

    return { pedidoCancelado, mesaUpdated };
  });

  return result;
};

const precuentaMesa = async (prisma, payload) => {
  const { mesaId, usuarioId = null } = payload;

  return prisma.$transaction(async (tx) => {
    const mesa = await tx.mesa.findUnique({
      where: { id: mesaId }
    });

    if (!mesa) {
      throw createHttpError.notFound('Mesa no encontrada');
    }

    const pedidoAbierto = await findOpenPedidoByMesa(tx, mesaId);

    if (!pedidoAbierto) {
      throw createHttpError.badRequest('La mesa no tiene un pedido activo para generar precuenta');
    }

    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoAbierto.id },
      select: PEDIDO_DETAIL_SELECT
    });

    const mesaActualizada = await tx.mesa.update({
      where: { id: mesaId },
      data: { estado: 'ESPERANDO_CUENTA' }
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: 'PRECUENTA_SOLICITADA',
      snapshotAntes: pedido,
      snapshotDespues: {
        ...pedido,
        mesaEstado: 'ESPERANDO_CUENTA'
      }
    });

    const cobro = buildPedidoCobroSummary(pedido);

    return {
      mesa: mesaActualizada,
      pedido: attachPedidoImpresionSummary(pedido),
      totalPagado: cobro.totalPagado,
      pendiente: cobro.pendiente
    };
  });
};

const cambiarMesa = async (prisma, payload) => {
  const { pedidoId, nuevoMesaId, usuarioId } = payload;

  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, tipo: true, estado: true, mesaId: true, sucursalId: true, observaciones: true }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (pedido.tipo !== 'MESA') {
      throw createHttpError.badRequest('Solo se puede cambiar mesa de pedidos tipo MESA');
    }

    if (['CANCELADO', 'CERRADO'].includes(pedido.estado)) {
      throw createHttpError.badRequest('No se puede cambiar mesa de un pedido ' + pedido.estado);
    }

    if (pedido.mesaId === nuevoMesaId) {
      throw createHttpError.badRequest('El pedido ya esta en esa mesa');
    }

    const nuevaMesa = await tx.mesa.findUnique({ where: { id: nuevoMesaId } });
    if (!nuevaMesa || !nuevaMesa.activa) {
      throw createHttpError.notFound('Mesa destino no encontrada o inactiva');
    }

    const pedidoEnNuevaMesa = await findOpenPedidoByMesa(tx, nuevoMesaId);
    if (pedidoEnNuevaMesa) {
      throw createMesaPedidoConflict(pedidoEnNuevaMesa);
    }

    const mesaAnteriorId = pedido.mesaId;

    // Free old mesa
    if (mesaAnteriorId) {
      await tx.mesa.update({
        where: { id: mesaAnteriorId },
        data: { estado: 'LIBRE' }
      });
    }

    // Occupy new mesa
    await tx.mesa.update({
      where: { id: nuevoMesaId },
      data: { estado: 'OCUPADA' }
    });

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: { mesaId: nuevoMesaId },
      select: PEDIDO_DETAIL_SELECT
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: 'MESA_CAMBIADA',
      motivo: `Mesa cambiada de #${mesaAnteriorId} a #${nuevoMesaId}`,
      snapshotAntes: pedido,
      snapshotDespues: pedidoActualizado
    });

    return {
      pedido: attachPedidoImpresionSummary(pedidoActualizado),
      mesaUpdates: [
        ...(mesaAnteriorId ? [{ mesaId: mesaAnteriorId, estado: 'LIBRE' }] : []),
        { mesaId: nuevoMesaId, estado: 'OCUPADA' }
      ]
    };
  });
};

/**
 * Reverses stock consumption for a single item whose round had stock applied.
 * Creates ENTRADA movements to return ingredients to their lots.
 *
 * @private
 * @param {import('@prisma/client').Prisma.TransactionClient} tx - Transaction client
 * @param {Object} item - The pedido item being reversed
 * @param {Object} pedido - The parent pedido (must include movimientos and sucursalId)
 */
const reverseItemStock = async (tx, item, pedido) => {
  const receta = await tx.productoIngrediente.findMany({
    where: { productoId: item.productoId }
  });

  for (const ing of receta) {
    const cantidadARevertir = parseFloat(ing.cantidad) * item.cantidad;

    // Find a SALIDA movement for this ingredient+pedido to get the loteStockId
    const movSalida = pedido.movimientos.find(
      (m) => m.tipo === 'SALIDA' && m.ingredienteId === ing.ingredienteId
    );

    await registrarEntradaEnLote(tx, {
      ingredienteId: ing.ingredienteId,
      sucursalId: pedido.sucursalId,
      loteStockId: movSalida?.loteStockId || null,
      cantidad: cantidadARevertir,
      motivo: `Anulacion item pedido #${pedido.id}`,
      pedidoId: pedido.id,
      tipoMovimiento: 'ENTRADA',
      incrementStockInicial: false,
      codigoLote: movSalida?.loteStockId ? null : buildAutoLoteCode(`DEV-${pedido.id}-${ing.ingredienteId}`)
    });
  }
};

const anularItem = async (prisma, payload) => {
  const { pedidoId, itemId, usuarioId, motivo } = payload;

  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        ...PEDIDO_DETAIL_SELECT,
        movimientos: true
      }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (['CANCELADO', 'CERRADO'].includes(pedido.estado)) {
      throw createHttpError.badRequest('No se puede anular items de un pedido ' + pedido.estado);
    }

    const item = pedido.items.find((i) => i.id === itemId);
    if (!item) {
      throw createHttpError.notFound('Item no encontrado en este pedido');
    }

    const ronda = pedido.rondas.find((r) => r.id === item.rondaId);
    if (ronda && ronda.enviadaCocinaAt) {
      throw createHttpError.badRequest('No se puede anular un item cuya comanda ya fue enviada a cocina');
    }

    // Revert stock if it was applied for this round
    if (ronda && ronda.stockAplicadoAt) {
      await reverseItemStock(tx, item, pedido);
    }

    // Delete the item (cascade handles PedidoItemModificador)
    await tx.pedidoItem.delete({ where: { id: itemId } });

    // Check if any items remain
    const remainingItems = await tx.pedidoItem.findMany({
      where: { pedidoId },
      select: { subtotal: true }
    });

    if (remainingItems.length === 0) {
      // No items left - cancel the entire order
      let mesaUpdated = null;
      if (pedido.mesaId) {
        await tx.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'LIBRE' }
        });
        mesaUpdated = { mesaId: pedido.mesaId, estado: 'LIBRE' };
      }

      const pedidoCancelado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: 'CANCELADO',
          observaciones: `${pedido.observaciones || ''} | Cancelado: ultimo item anulado`.trim()
        },
        select: PEDIDO_DETAIL_SELECT
      });

      await registrarAuditoriaPedido(tx, {
        pedidoId: pedido.id,
        usuarioId,
        accion: 'PEDIDO_CANCELADO',
        motivo: 'Ultimo item anulado',
        snapshotAntes: pedido,
        snapshotDespues: pedidoCancelado
      });

      return { pedido: attachPedidoImpresionSummary(pedidoCancelado), mesaUpdated };
    }

    // Recalculate totals
    const nuevoSubtotal = remainingItems.reduce((sum, i) => sum + decimalToNumber(i.subtotal), 0);
    let descuento = decimalToNumber(pedido.descuento);
    if (descuento > nuevoSubtotal) {
      descuento = nuevoSubtotal;
    }
    const costoEnvio = decimalToNumber(pedido.costoEnvio);
    const nuevoTotal = Math.max(0, nuevoSubtotal - descuento + costoEnvio);

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: { subtotal: nuevoSubtotal, descuento, total: nuevoTotal },
      select: PEDIDO_DETAIL_SELECT
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: 'ITEM_ANULADO',
      motivo: motivo || `Item #${itemId} anulado`,
      snapshotAntes: pedido,
      snapshotDespues: pedidoActualizado
    });

    return { pedido: attachPedidoImpresionSummary(pedidoActualizado), mesaUpdated: null };
  });
};

const aplicarDescuento = async (prisma, payload) => {
  const { pedidoId, descuento, usuarioId, motivo } = payload;

  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      select: { ...PEDIDO_DETAIL_SELECT, pagos: { select: PEDIDO_PAGO_DETAIL_SELECT } }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (['CANCELADO', 'CERRADO', 'COBRADO', 'ENTREGADO'].includes(pedido.estado)) {
      throw createHttpError.badRequest('No se puede aplicar descuento a un pedido en estado ' + pedido.estado);
    }

    const subtotal = decimalToNumber(pedido.subtotal);
    if (descuento > subtotal) {
      throw createHttpError.badRequest(`El descuento ($${descuento}) no puede ser mayor al subtotal ($${subtotal})`);
    }

    const costoEnvio = decimalToNumber(pedido.costoEnvio);
    const nuevoTotal = subtotal - descuento + costoEnvio;

    if (nuevoTotal < 0) {
      throw createHttpError.badRequest('El total resultante no puede ser negativo');
    }

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: { descuento, total: nuevoTotal },
      select: PEDIDO_DETAIL_SELECT
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: 'DESCUENTO_APLICADO',
      motivo: motivo || `Descuento de $${descuento}`,
      snapshotAntes: pedido,
      snapshotDespues: pedidoActualizado
    });

    return attachPedidoImpresionSummary(pedidoActualizado);
  });
};

const cerrarPedido = async (prisma, payload) => {
  const { pedidoId, usuarioId = null } = payload;

  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (pedido.estado === 'CANCELADO') {
      throw createHttpError.badRequest('No se puede cerrar un pedido cancelado');
    }

    if (pedido.estado === 'CERRADO') {
      throw createHttpError.badRequest('El pedido ya se encuentra cerrado');
    }

    const cobro = buildPedidoCobroSummary(pedido);

    if (!cobro.fullyPaid) {
      throw createHttpError.badRequest('El pedido todavia tiene saldo pendiente');
    }

    let mesaUpdated = null;
    if (pedido.mesaId) {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'CERRADA' }
      });
      mesaUpdated = { mesaId: pedido.mesaId, estado: 'CERRADA' };
    }

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'CERRADO',
        estadoPago: 'APROBADO'
      },
      select: PEDIDO_DETAIL_SELECT
    });

    await registrarAuditoriaPedido(tx, {
      pedidoId: pedido.id,
      usuarioId,
      accion: 'PEDIDO_CERRADO',
      snapshotAntes: pedido,
      snapshotDespues: pedidoActualizado
    });

    return {
      pedidoAntes: pedido,
      pedidoActualizado: attachPedidoImpresionSummary(pedidoActualizado),
      mesaUpdated
    };
  });
};

const liberarMesa = async (prisma, payload) => {
  const { mesaId, usuarioId = null } = payload;

  return prisma.$transaction(async (tx) => {
    const mesa = await tx.mesa.findUnique({
      where: { id: mesaId }
    });

    if (!mesa) {
      throw createHttpError.notFound('Mesa no encontrada');
    }

    const pedidoAbierto = await tx.pedido.findFirst({
      where: {
        mesaId,
        ...OPEN_PEDIDO_WHERE
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pedidoAbierto) {
      throw createHttpError.badRequest('No se puede liberar una mesa con pedidos abiertos');
    }

    const pedidoCerrado = await tx.pedido.findFirst({
      where: {
        mesaId,
        estado: 'CERRADO'
      },
      select: PEDIDO_DETAIL_SELECT,
      orderBy: { createdAt: 'desc' }
    });

    const mesaActualizada = await tx.mesa.update({
      where: { id: mesaId },
      data: { estado: 'LIBRE' }
    });

    if (pedidoCerrado) {
      await registrarAuditoriaPedido(tx, {
        pedidoId: pedidoCerrado.id,
        usuarioId,
        accion: 'MESA_LIBERADA',
        snapshotAntes: pedidoCerrado,
        snapshotDespues: {
          ...pedidoCerrado,
          mesaEstado: 'LIBRE'
        }
      });
    }

    return {
      mesa: mesaActualizada,
      pedido: pedidoCerrado ? attachPedidoImpresionSummary(pedidoCerrado) : null,
      mesaUpdated: { mesaId: mesaActualizada.id, estado: 'LIBRE' }
    };
  });
};

module.exports = {
  /**
   * Lista pedidos con filtros opcionales.
   *
   * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
   * @param {Object} query - Filtros de búsqueda
   * @param {string} [query.estado] - Filtrar por estado
   * @param {string} [query.tipo] - Filtrar por tipo (MESA, DELIVERY, MOSTRADOR)
   * @param {number} [query.mesaId] - Filtrar por mesa
   * @param {string} [query.fecha] - Filtrar por fecha (formato YYYY-MM-DD)
   *
   * @returns {Promise<Array>} Lista de pedidos con items, mesa, usuario y pagos
   */
  listar: async (prisma, query) => {
    const { q, estado, tipo, fecha, mesaId, sucursalId, incluirCerrados, limit = DEFAULT_PEDIDOS_LIMIT, offset = 0 } = query;

    const where = {};
    const normalizedQuery = typeof q === 'string' ? q.trim() : '';

    if (estado) {
      where.estado = estado;
    } else if (!incluirCerrados) {
      where.estado = { notIn: ['CERRADO', 'CANCELADO'] };
    }
    if (tipo) where.tipo = tipo;
    if (mesaId) where.mesaId = mesaId;
    if (sucursalId) where.sucursalId = sucursalId;
    if (fecha) {
      const fechaInicio = new Date(fecha);
      const fechaFin = new Date(fecha);
      fechaFin.setDate(fechaFin.getDate() + 1);
      where.createdAt = { gte: fechaInicio, lt: fechaFin };
    }
    if (normalizedQuery) {
      const searchConditions = [
        {
          clienteNombre: {
            contains: normalizedQuery,
            mode: 'insensitive'
          }
        }
      ];

      if (/^\d+$/.test(normalizedQuery)) {
        const numericQuery = Number.parseInt(normalizedQuery, 10);
        searchConditions.push({ id: numericQuery });
        searchConditions.push({
          mesa: {
            is: {
              numero: numericQuery
            }
          }
        });
      }

      where.OR = searchConditions;
    }

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        select: PEDIDO_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.pedido.count({ where })
    ]);

    const data = pedidos.map(attachPedidoImpresionSummary);

    return { data, total };
  },

  /**
   * Obtiene un pedido por ID con todas sus relaciones.
   *
   * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
   * @param {number} id - ID del pedido
   *
   * @returns {Promise<Object>} Pedido con mesa, usuario, items, pagos e impresión
   *
   * @throws {HttpError} 404 - Pedido no encontrado
   */
  obtener: async (prisma, id) => {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      select: PEDIDO_DETAIL_SELECT
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    return attachPedidoImpresionSummary(pedido);
  },
  crearPedido,
  cambiarEstadoPedido,
  agregarItemsPedido,
  markRoundsSentToKitchen,
  cancelarPedido,
  precuentaMesa,
  cambiarMesa,
  anularItem,
  aplicarDescuento,
  cerrarPedido,
  liberarMesa
};
