const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const { addDays } = require('../utils/date-helpers');
const {
  ajustarStockPorLotes,
  buildAutoLoteCode,
  consumirLotesFIFO,
  descartarLoteVencido,
  isLoteConsumible,
  isLoteVencido,
  registrarEntradaEnLote,
  roundStock,
  sumStock,
  syncIngredienteAggregate
} = require('./lotes-stock.service');
const {
  buildIngredienteStockSnapshot,
  ensureIngredienteStock
} = require('./ingrediente-stock.service');
const { ensureBaseSucursales } = require('./sucursales.service');
const { SUCURSAL_IDS } = require('../constants/sucursales');

const ALERT_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const resolveSucursalId = (value) => {
  if (value == null || value === '') {
    return SUCURSAL_IDS.SALON;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError.badRequest('Sucursal invalida');
  }

  return parsed;
};

const sanitizeOptionalText = (value) => {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const getDaysUntilExpiry = (fechaVencimiento, referenceDate = new Date()) => {
  if (!fechaVencimiento) {
    return null;
  }

  return Math.ceil((new Date(fechaVencimiento).getTime() - referenceDate.getTime()) / DAY_IN_MS);
};

const isLoteProximoAVencer = (fechaVencimiento, referenceDate = new Date()) => {
  if (!fechaVencimiento || isLoteVencido(fechaVencimiento, referenceDate)) {
    return false;
  }

  return new Date(fechaVencimiento).getTime() <= addDays(referenceDate, ALERT_WINDOW_DAYS).getTime();
};

const enrichLote = (lote, referenceDate = new Date()) => {
  const vencido = isLoteVencido(lote.fechaVencimiento, referenceDate);
  const proximoAVencer = isLoteProximoAVencer(lote.fechaVencimiento, referenceDate);

  return {
    ...lote,
    estadoLote: vencido
      ? 'VENCIDO'
      : proximoAVencer
        ? 'PROXIMO_VENCIMIENTO'
        : 'DISPONIBLE',
    diasParaVencimiento: getDaysUntilExpiry(lote.fechaVencimiento, referenceDate)
  };
};

const buildIngredienteResponse = (ingrediente, stock, referenceDate = new Date()) => {
  const lotes = (ingrediente.lotes || []).map((lote) => enrichLote(lote, referenceDate));
  const stockConfigurado = stock || ingrediente.stocks?.[0] || null;
  const stockActualBase = decimalToNumber(stockConfigurado?.stockActual);
  const stockMinimoBase = decimalToNumber(stockConfigurado?.stockMinimo);
  const stockFisico = lotes.length > 0
    ? roundStock(sumStock(lotes))
    : roundStock(stockActualBase);
  const stockConsumible = lotes.length > 0
    ? roundStock(sumStock(lotes.filter((lote) => isLoteConsumible(lote, referenceDate))))
    : roundStock(stockActualBase);
  const stockNoConsumible = lotes.length > 0
    ? roundStock(sumStock(lotes.filter((lote) => !isLoteConsumible(lote, referenceDate))))
    : 0;
  const lotesAlerta = lotes.filter((lote) => lote.estadoLote !== 'DISPONIBLE').slice(0, 3);

  return {
    id: ingrediente.id,
    nombre: ingrediente.nombre,
    unidad: ingrediente.unidad,
    costo: ingrediente.costo,
    activo: stockConfigurado?.activo ?? ingrediente.activo,
    stockActual: stockConsumible,
    stockFisico,
    stockNoConsumible,
    stockMinimo: roundStock(stockMinimoBase),
    sucursalId: stockConfigurado?.sucursalId ?? null,
    sucursalNombre: stockConfigurado?.sucursal?.nombre || null,
    sucursal: stockConfigurado?.sucursal || null,
    createdAt: ingrediente.createdAt,
    updatedAt: ingrediente.updatedAt,
    lotes,
    lotesAlerta,
    movimientos: ingrediente.movimientos || [],
    productos: ingrediente.productos || [],
    requiereDescarteManual: lotes.some((lote) => lote.estadoLote === 'VENCIDO'),
    tieneLotesVencidos: lotes.some((lote) => lote.estadoLote === 'VENCIDO'),
    tieneLotesPorVencer: lotes.some((lote) => lote.estadoLote === 'PROXIMO_VENCIMIENTO')
  };
};

const assertSucursal = async (prisma, sucursalId) => {
  const sucursal = await prisma.sucursal.findUnique({
    where: { id: sucursalId }
  });

  if (!sucursal || sucursal.activa === false) {
    throw createHttpError.badRequest('Sucursal no disponible');
  }

  return sucursal;
};

const ensureWritableSucursal = async (prisma, sucursalId) => {
  await ensureBaseSucursales(prisma);
  return assertSucursal(prisma, sucursalId);
};

const fetchIngredienteWithSucursal = async (prisma, ingredienteId, sucursalId, options = {}) => {
  const { takeMovimientos = 20 } = options;

  const ingrediente = await prisma.ingrediente.findUnique({
    where: { id: ingredienteId },
    include: {
      stocks: {
        where: { sucursalId },
        include: {
          sucursal: {
            select: {
              id: true,
              nombre: true,
              codigo: true
            }
          }
        },
        take: 1
      },
      lotes: {
        where: { sucursalId },
        orderBy: [
          { activo: 'desc' },
          { fechaIngreso: 'asc' },
          { id: 'asc' }
        ]
      },
      movimientos: {
        where: { sucursalId },
        orderBy: { createdAt: 'desc' },
        take: takeMovimientos
      },
      productos: {
        include: {
          producto: {
            select: {
              id: true,
              nombre: true
            }
          }
        }
      }
    }
  });

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  return ingrediente;
};

const verificarProductosDisponibles = async (prisma, ingredienteId) => {
  void prisma;
  void ingredienteId;

  // Producto.disponible queda como flag manual/comercial.
  return { productosHabilitados: [], events: [] };
};

const listar = async (prisma, query = {}) => {
  const sucursalId = resolveSucursalId(query.sucursalId);
  const activo = typeof query.activo === 'boolean' ? query.activo : undefined;
  const stockBajo = Boolean(query.stockBajo);
  const referenceDate = new Date();

  const sucursal = await assertSucursal(prisma, sucursalId);

  const ingredientes = await prisma.ingrediente.findMany({
    where: {
      activo: true
    },
    include: {
      stocks: {
        where: {
          sucursalId,
          ...(activo === undefined ? {} : { activo })
        },
        include: {
          sucursal: {
            select: {
              id: true,
              nombre: true,
              codigo: true
            }
          }
        },
        take: 1
      },
      lotes: {
        where: {
          sucursalId,
          activo: true,
          stockActual: { gt: 0 }
        },
        orderBy: [
          { fechaIngreso: 'asc' },
          { id: 'asc' }
        ]
      }
    },
    orderBy: { nombre: 'asc' }
  });

  let respuesta = ingredientes.map((ingrediente) => {
    const stock = buildIngredienteStockSnapshot(ingrediente, {
      sucursalId,
      sucursal,
      stock: ingrediente.stocks[0] || null,
      useLegacyFallback: false
    });

    return buildIngredienteResponse(ingrediente, stock, referenceDate);
  });

  if (stockBajo) {
    respuesta = respuesta.filter((ingrediente) => (
      decimalToNumber(ingrediente.stockActual) <= decimalToNumber(ingrediente.stockMinimo)
    ));
  }

  return respuesta;
};

const obtener = async (prisma, id, query = {}) => {
  const sucursalId = resolveSucursalId(query.sucursalId);

  const sucursal = await assertSucursal(prisma, sucursalId);
  const ingrediente = await fetchIngredienteWithSucursal(prisma, id, sucursalId);

  const stock = buildIngredienteStockSnapshot(ingrediente, {
    sucursalId,
    sucursal,
    stock: ingrediente.stocks[0] || null,
    useLegacyFallback: false
  });

  return buildIngredienteResponse(ingrediente, stock);
};

const crear = async (prisma, data) => {
  const sucursalId = resolveSucursalId(data.sucursalId);
  const nombre = sanitizeOptionalText(data.nombre);

  if (!nombre) {
    throw createHttpError.badRequest('Nombre es requerido');
  }

  await ensureWritableSucursal(prisma, sucursalId);

  const ingredienteId = await prisma.$transaction(async (tx) => {
    const ingredienteExistente = await tx.ingrediente.findUnique({
      where: { nombre }
    });

    if (ingredienteExistente) {
      const stockExistente = await tx.ingredienteStock.findUnique({
        where: {
          ingredienteId_sucursalId: {
            ingredienteId: ingredienteExistente.id,
            sucursalId
          }
        }
      });

      if (stockExistente) {
        throw createHttpError.badRequest('Ya existe un ingrediente con ese nombre en esta sucursal');
      }
    }

    const ingrediente = ingredienteExistente
      ? await tx.ingrediente.update({
          where: { id: ingredienteExistente.id },
          data: {
            unidad: data.unidad ?? ingredienteExistente.unidad,
            costo: data.costo ?? ingredienteExistente.costo,
            activo: true
          }
        })
      : await tx.ingrediente.create({
          data: {
            nombre,
            unidad: data.unidad,
            stockActual: 0,
            stockMinimo: 0,
            costo: data.costo ?? null,
            activo: true
          }
        });

    await ensureIngredienteStock(tx, {
      ingredienteId: ingrediente.id,
      sucursalId,
      defaults: {
        stockActual: 0,
        stockMinimo: data.stockMinimo,
        activo: data.activo ?? true
      },
      useLegacyFallback: false
    });

    if (data.stockActual > 0) {
      await registrarEntradaEnLote(tx, {
        ingredienteId: ingrediente.id,
        sucursalId,
        cantidad: data.stockActual,
        motivo: 'Stock inicial',
        codigoLote: buildAutoLoteCode(`INICIAL-${ingrediente.id}-${sucursalId}`),
        costoUnitario: data.costo ?? ingrediente.costo ?? null
      });
    } else {
      await syncIngredienteAggregate(tx, ingrediente.id);
    }

    return ingrediente.id;
  });

  return obtener(prisma, ingredienteId, { sucursalId });
};

const actualizar = async (prisma, id, data) => {
  const sucursalId = resolveSucursalId(data.sucursalId);

  await ensureWritableSucursal(prisma, sucursalId);

  await prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.findUnique({
      where: { id }
    });

    if (!ingrediente) {
      throw createHttpError.notFound('Ingrediente no encontrado');
    }

    const ingredienteData = {};
    if (data.nombre !== undefined) ingredienteData.nombre = sanitizeOptionalText(data.nombre);
    if (data.unidad !== undefined) ingredienteData.unidad = data.unidad;
    if (data.costo !== undefined) ingredienteData.costo = data.costo;
    if (data.activo !== undefined) ingredienteData.activo = data.activo;

    if (Object.keys(ingredienteData).length > 0) {
      await tx.ingrediente.update({
        where: { id },
        data: ingredienteData
      });
    }

    const stockData = {};
    if (data.stockMinimo !== undefined) stockData.stockMinimo = data.stockMinimo;
    if (data.activo !== undefined) stockData.activo = data.activo;

    if (Object.keys(stockData).length > 0) {
      const { stock } = await ensureIngredienteStock(tx, {
        ingredienteId: id,
        sucursalId,
        defaults: {
          stockActual: 0,
          stockMinimo: data.stockMinimo ?? 0,
          activo: data.activo ?? true
        },
        useLegacyFallback: false
      });

      await tx.ingredienteStock.update({
        where: { id: stock.id },
        data: stockData
      });
    }

    await syncIngredienteAggregate(tx, id);
  });

  return obtener(prisma, id, { sucursalId });
};

const registrarMovimiento = async (prisma, id, data) => {
  const sucursalId = resolveSucursalId(data.sucursalId);

  await ensureWritableSucursal(prisma, sucursalId);

  const result = await prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.findUnique({ where: { id } });
    if (!ingrediente) {
      throw createHttpError.notFound('Ingrediente no encontrado');
    }

    const cantidad = decimalToNumber(data.cantidad);
    const motivo = data.motivo || null;

    if (data.tipo === 'ENTRADA') {
      const ingreso = await registrarEntradaEnLote(tx, {
        ingredienteId: id,
        sucursalId,
        cantidad,
        motivo,
        codigoLote: data.codigoLote || null,
        fechaVencimiento: data.fechaVencimiento || null,
        costoUnitario: data.costoUnitario ?? ingrediente.costo ?? null
      });

      return {
        nuevoStock: decimalToNumber(ingreso.ingrediente.stockActual),
        tipo: data.tipo
      };
    }

    const consumo = await consumirLotesFIFO(tx, {
      ingredienteId: id,
      sucursalId,
      cantidad,
      motivo,
      tipoMovimiento: 'SALIDA'
    });

    return {
      nuevoStock: decimalToNumber(consumo.ingrediente.stockActual),
      tipo: data.tipo
    };
  });

  let events = [];
  if (result.tipo === 'ENTRADA' && result.nuevoStock > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return {
    ingrediente: await obtener(prisma, id, { sucursalId }),
    events
  };
};

const ajustarStock = async (prisma, id, data) => {
  const sucursalId = resolveSucursalId(data.sucursalId);

  await ensureWritableSucursal(prisma, sucursalId);

  const result = await prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.findUnique({ where: { id } });
    if (!ingrediente) {
      throw createHttpError.notFound('Ingrediente no encontrado');
    }

    const stockReal = decimalToNumber(data.stockReal);

    return ajustarStockPorLotes(tx, {
      ingredienteId: id,
      sucursalId,
      stockReal,
      motivo: data.motivo || null
    });
  });

  let events = [];
  if (result.diferencia > 0 && result.stockReal > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return {
    ingrediente: await obtener(prisma, id, { sucursalId }),
    events
  };
};

const alertasStock = async (prisma, query = {}) => {
  const sucursalId = resolveSucursalId(query.sucursalId);
  const ingredientes = await listar(prisma, { sucursalId, activo: true });

  return ingredientes.filter((ingrediente) => (
    decimalToNumber(ingrediente.stockActual) <= decimalToNumber(ingrediente.stockMinimo) ||
    ingrediente.lotesAlerta.length > 0
  ));
};

const descartarLote = async (prisma, loteId, data) => {
  const result = await prisma.$transaction(async (tx) => descartarLoteVencido(tx, {
    loteId,
    cantidad: data.cantidad ?? null,
    motivo: data.motivo
  }));

  return {
    ingrediente: await obtener(prisma, result.ingrediente.id, { sucursalId: result.lote.sucursalId }),
    lote: result.lote,
    movimiento: result.movimiento
  };
};

module.exports = {
  alertasStock,
  ajustarStock,
  crear,
  actualizar,
  descartarLote,
  listar,
  obtener,
  registrarMovimiento,
  verificarProductosDisponibles
};
