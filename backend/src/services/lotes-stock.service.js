const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const {
  ensureIngredienteStock,
  roundStock
} = require('./ingrediente-stock.service');

const EPSILON = 0.0001;

const sumStock = (items = [], field = 'stockActual') => items
  .reduce((sum, item) => sum + decimalToNumber(item[field]), 0);

const buildAutoLoteCode = (prefix = 'LOTE') => {
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${suffix}`;
};

const normalizeExpiryDate = (value) => {
  if (!value) {
    return null;
  }

  const normalized = new Date(value);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

const isLoteVencido = (fechaVencimiento, referenceDate = new Date()) => {
  if (!fechaVencimiento) {
    return false;
  }

  return new Date(fechaVencimiento).getTime() < referenceDate.getTime();
};

const isLoteConsumible = (lote, referenceDate = new Date()) => (
  Boolean(lote) &&
  lote.activo !== false &&
  decimalToNumber(lote.stockActual) > EPSILON &&
  !isLoteVencido(lote.fechaVencimiento, referenceDate)
);

const buildConsumibleLoteWhere = (referenceDate = new Date(), sucursalId = null) => {
  const where = {
    activo: true,
    stockActual: { gt: 0 },
    OR: [
      { fechaVencimiento: null },
      { fechaVencimiento: { gte: referenceDate } }
    ]
  };

  if (sucursalId) {
    where.sucursalId = sucursalId;
  }

  return where;
};

const startOfDay = (value = new Date()) => {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const buildExpiredLotsWhere = (referenceDate = new Date(), sucursalId = null) => {
  const where = {
    activo: true,
    stockActual: { gt: 0 },
    fechaVencimiento: { lt: referenceDate }
  };

  if (sucursalId) {
    where.sucursalId = sucursalId;
  }

  return where;
};

const buildExpiredPendingNotificationWhere = (referenceDate = new Date(), sucursalId = null) => ({
  ...buildExpiredLotsWhere(referenceDate, sucursalId),
  OR: [
    { ultimaNotificacionVencimiento: null },
    { ultimaNotificacionVencimiento: { lt: startOfDay(referenceDate) } }
  ]
});

const lockConsumibleLotes = async (tx, ingredienteId, sucursalId, referenceDate = new Date()) => tx.$queryRaw`
  SELECT
    id,
    "ingredienteId",
    "sucursalId",
    "codigoLote",
    "stockInicial",
    "stockActual",
    "costoUnitario",
    "fechaIngreso",
    "fechaVencimiento",
    "ultimaNotificacionVencimiento",
    activo,
    "createdAt",
    "updatedAt"
  FROM "lotes_stock"
  WHERE
    "ingredienteId" = ${ingredienteId}
    AND "sucursalId" = ${sucursalId}
    AND activo = true
    AND "stockActual" > 0
    AND ("fechaVencimiento" IS NULL OR "fechaVencimiento" >= ${referenceDate})
  ORDER BY "fechaIngreso" ASC, id ASC
  FOR UPDATE
`;

const syncIngredienteAggregate = async (tx, ingredienteId) => {
  const [ingrediente, stocks] = await Promise.all([
    tx.ingrediente.findUnique({ where: { id: ingredienteId } }),
    tx.ingredienteStock.findMany({
      where: {
        ingredienteId,
        activo: true
      }
    })
  ]);

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const stockActual = roundStock(sumStock(stocks));
  const stockMinimo = roundStock(sumStock(stocks, 'stockMinimo'));

  if (
    Math.abs(decimalToNumber(ingrediente.stockActual) - stockActual) <= EPSILON &&
    Math.abs(decimalToNumber(ingrediente.stockMinimo) - stockMinimo) <= EPSILON
  ) {
    return ingrediente;
  }

  return tx.ingrediente.update({
    where: { id: ingredienteId },
    data: {
      stockActual,
      stockMinimo
    }
  });
};

const obtenerLotesActivos = async (tx, ingredienteId, sucursalId) => tx.loteStock.findMany({
  where: {
    ingredienteId,
    sucursalId,
    activo: true,
    stockActual: { gt: 0 }
  },
  orderBy: [
    { fechaIngreso: 'asc' },
    { id: 'asc' }
  ]
});

const obtenerLotesConsumibles = async (tx, ingredienteId, sucursalId, referenceDate = new Date()) => tx.loteStock.findMany({
  where: {
    ingredienteId,
    sucursalId,
    ...buildConsumibleLoteWhere(referenceDate)
  },
  orderBy: [
    { fechaIngreso: 'asc' },
    { id: 'asc' }
  ]
});

const obtenerLotesVencidosPendientes = async (tx, options = {}) => {
  const { referenceDate = new Date(), sucursalId = null } = options;
  const where = buildExpiredPendingNotificationWhere(referenceDate, sucursalId);

  return tx.loteStock.findMany({
    where,
    include: {
      ingrediente: {
        select: {
          id: true,
          nombre: true,
          unidad: true
        }
      },
      sucursal: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      }
    },
    orderBy: [
      { fechaVencimiento: 'asc' },
      { fechaIngreso: 'asc' },
      { id: 'asc' }
    ]
  });
};

const ensureLegacyLotesCoverage = async (tx, ingrediente, sucursalId, options = {}) => {
  const { allowPartialCoverage = false } = options;
  const { stock } = await ensureIngredienteStock(tx, {
    ingredienteId: ingrediente.id,
    sucursalId,
    useLegacyFallback: true
  });
  const lotes = await obtenerLotesActivos(tx, ingrediente.id, sucursalId);
  const totalEnLotes = sumStock(lotes);
  const stockSucursal = decimalToNumber(stock.stockActual);

  const crearLoteLegacy = (
    (lotes.length === 0 && stockSucursal > EPSILON) ||
    (allowPartialCoverage && stockSucursal - totalEnLotes > EPSILON)
  );

  if (!crearLoteLegacy) {
    return lotes;
  }

  const faltante = lotes.length === 0
    ? roundStock(stockSucursal)
    : roundStock(stockSucursal - totalEnLotes);
  const loteLegacy = await tx.loteStock.create({
    data: {
      ingredienteId: ingrediente.id,
      sucursalId,
      codigoLote: buildAutoLoteCode(`LEGACY-${ingrediente.id}-${sucursalId}`),
      stockInicial: faltante,
      stockActual: faltante,
      costoUnitario: ingrediente.costo ?? null,
      fechaIngreso: ingrediente.createdAt || new Date()
    }
  });

  return [...lotes, loteLegacy];
};

const sincronizarStockIngrediente = async (
  tx,
  ingredienteOrId,
  sucursalId,
  referenceDate = new Date(),
  options = {}
) => {
  const { migrateLegacy = false } = options;
  const ingrediente = typeof ingredienteOrId === 'object'
    ? ingredienteOrId
    : await tx.ingrediente.findUnique({ where: { id: ingredienteOrId } });

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const { stock } = await ensureIngredienteStock(tx, {
    ingredienteId: ingrediente.id,
    sucursalId,
    useLegacyFallback: false
  });

  const lotes = migrateLegacy
    ? await ensureLegacyLotesCoverage(tx, ingrediente, sucursalId)
    : await obtenerLotesActivos(tx, ingrediente.id, sucursalId);
  const stockConsumible = roundStock(
    sumStock(lotes.filter((lote) => isLoteConsumible(lote, referenceDate)))
  );

  let updatedStock = stock;
  if (Math.abs(decimalToNumber(stock.stockActual) - stockConsumible) > EPSILON) {
    updatedStock = await tx.ingredienteStock.update({
      where: { id: stock.id },
      data: { stockActual: stockConsumible }
    });
  }

  await syncIngredienteAggregate(tx, ingrediente.id);

  return updatedStock;
};

const actualizarLote = async (tx, lote, changes = {}) => {
  const stockActual = changes.stockActual !== undefined
    ? roundStock(decimalToNumber(changes.stockActual))
    : decimalToNumber(lote.stockActual);

  return tx.loteStock.update({
    where: { id: lote.id },
    data: {
      ...changes,
      stockActual,
      activo: stockActual > EPSILON
    }
  });
};

const registrarEntradaEnLote = async (tx, payload) => {
  const {
    ingredienteId,
    sucursalId,
    cantidad,
    motivo = null,
    tipoMovimiento = 'ENTRADA',
    pedidoId = null,
    loteStockId = null,
    codigoLote = null,
    fechaIngreso = new Date(),
    fechaVencimiento = null,
    costoUnitario = null,
    incrementStockInicial = tipoMovimiento === 'ENTRADA'
  } = payload;

  const cantidadValue = roundStock(decimalToNumber(cantidad));
  if (cantidadValue <= EPSILON) {
    throw createHttpError.badRequest('La cantidad del lote debe ser mayor a 0');
  }

  const ingrediente = await tx.ingrediente.findUnique({ where: { id: ingredienteId } });
  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  await ensureIngredienteStock(tx, {
    ingredienteId,
    sucursalId,
    useLegacyFallback: false
  });

  const normalizedExpiryDate = normalizeExpiryDate(fechaVencimiento);

  let lote = null;
  let loteCreadoNuevo = false;

  if (loteStockId) {
    lote = await tx.loteStock.findUnique({ where: { id: loteStockId } });
    if (!lote || lote.ingredienteId !== ingredienteId || lote.sucursalId !== sucursalId) {
      throw createHttpError.badRequest('El lote indicado no pertenece al ingrediente');
    }
  } else {
    const codigo = codigoLote || buildAutoLoteCode(`LOTE-${ingredienteId}-${sucursalId}`);
    lote = await tx.loteStock.findFirst({
      where: {
        ingredienteId,
        sucursalId,
        codigoLote: codigo
      }
    });

    if (!lote) {
      loteCreadoNuevo = true;
      lote = await tx.loteStock.create({
        data: {
          ingredienteId,
          sucursalId,
          codigoLote: codigo,
          stockInicial: cantidadValue,
          stockActual: cantidadValue,
          costoUnitario: costoUnitario ?? ingrediente.costo ?? null,
          fechaIngreso,
          fechaVencimiento: normalizedExpiryDate
        }
      });
    }
  }

  if (!loteCreadoNuevo && lote?.id) {
    const data = {
      stockActual: roundStock(decimalToNumber(lote.stockActual) + cantidadValue),
      costoUnitario: costoUnitario ?? lote.costoUnitario ?? ingrediente.costo ?? null,
      activo: true
    };

    if (normalizedExpiryDate) {
      data.fechaVencimiento = normalizedExpiryDate;
    }

    if (incrementStockInicial) {
      data.stockInicial = roundStock(decimalToNumber(lote.stockInicial) + cantidadValue);
    }

    lote = await tx.loteStock.update({
      where: { id: lote.id },
      data
    });
  }

  const movimiento = await tx.movimientoStock.create({
    data: {
      ingredienteId,
      sucursalId,
      loteStockId: lote.id,
      tipo: tipoMovimiento,
      cantidad: cantidadValue,
      motivo,
      pedidoId
    }
  });

  await sincronizarStockIngrediente(tx, ingredienteId, sucursalId);

  return {
    ingrediente: await syncIngredienteAggregate(tx, ingredienteId),
    lote,
    movimiento,
    cantidad: cantidadValue
  };
};

const consumirLotesFIFO = async (tx, payload) => {
  const {
    ingredienteId,
    sucursalId,
    cantidad,
    motivo = null,
    pedidoId = null,
    tipoMovimiento = 'SALIDA'
  } = payload;

  const ingrediente = await tx.ingrediente.findUnique({ where: { id: ingredienteId } });
  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const cantidadValue = roundStock(decimalToNumber(cantidad));
  if (cantidadValue <= EPSILON) {
    throw createHttpError.badRequest('La cantidad a consumir debe ser mayor a 0');
  }

  const referenceDate = new Date();
  await sincronizarStockIngrediente(tx, ingrediente, sucursalId, referenceDate);
  const lotes = await lockConsumibleLotes(tx, ingredienteId, sucursalId, referenceDate);
  const stockDisponible = roundStock(sumStock(lotes));

  if (stockDisponible + EPSILON < cantidadValue) {
    throw createHttpError.badRequest('Stock insuficiente');
  }

  let restante = cantidadValue;
  const consumos = [];

  for (const lote of lotes) {
    if (restante <= EPSILON) {
      break;
    }

    const stockLote = decimalToNumber(lote.stockActual);
    if (stockLote <= EPSILON) {
      continue;
    }

    const cantidadConsumida = roundStock(Math.min(stockLote, restante));
    const loteActualizado = await actualizarLote(tx, lote, {
      stockActual: stockLote - cantidadConsumida
    });

    const movimiento = await tx.movimientoStock.create({
      data: {
        ingredienteId,
        sucursalId,
        loteStockId: lote.id,
        tipo: tipoMovimiento,
        cantidad: cantidadConsumida,
        motivo,
        pedidoId
      }
    });

    consumos.push({
      lote: loteActualizado,
      movimiento,
      cantidad: cantidadConsumida
    });

    restante = roundStock(restante - cantidadConsumida);
  }

  await sincronizarStockIngrediente(tx, ingredienteId, sucursalId, referenceDate);

  return {
    ingrediente: await syncIngredienteAggregate(tx, ingredienteId),
    consumos,
    totalConsumido: cantidadValue
  };
};

const ajustarStockPorLotes = async (tx, payload) => {
  const {
    ingredienteId,
    sucursalId,
    stockReal,
    motivo = null
  } = payload;

  const ingrediente = await tx.ingrediente.findUnique({ where: { id: ingredienteId } });
  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const stockSucursal = await sincronizarStockIngrediente(tx, ingrediente, sucursalId);
  const stockActual = decimalToNumber(stockSucursal.stockActual);
  const stockRealValue = roundStock(decimalToNumber(stockReal));
  const diferencia = roundStock(stockRealValue - stockActual);
  const motivoFinal = motivo || `Ajuste de inventario (${diferencia >= 0 ? '+' : ''}${diferencia})`;

  if (Math.abs(diferencia) <= EPSILON) {
    return { diferencia: 0, stockReal: stockRealValue, movimientos: [] };
  }

  if (diferencia > 0) {
    const ingreso = await registrarEntradaEnLote(tx, {
      ingredienteId,
      sucursalId,
      cantidad: diferencia,
      motivo: motivoFinal,
      tipoMovimiento: 'AJUSTE',
      incrementStockInicial: false,
      codigoLote: buildAutoLoteCode(`AJUSTE-${ingredienteId}-${sucursalId}`),
      costoUnitario: ingrediente.costo ?? null
    });

    return {
      diferencia,
      stockReal: stockRealValue,
      movimientos: [ingreso.movimiento]
    };
  }

  const consumo = await consumirLotesFIFO(tx, {
    ingredienteId,
    sucursalId,
    cantidad: Math.abs(diferencia),
    motivo: motivoFinal,
    tipoMovimiento: 'AJUSTE'
  });

  return {
    diferencia,
    stockReal: stockRealValue,
    movimientos: consumo.consumos.map((item) => item.movimiento)
  };
};

const descartarLoteVencido = async (tx, payload) => {
  const {
    loteId,
    cantidad = null,
    motivo
  } = payload;

  if (!motivo || !motivo.trim()) {
    throw createHttpError.badRequest('El motivo del descarte es obligatorio');
  }

  const lote = await tx.loteStock.findUnique({
    where: { id: loteId }
  });

  if (!lote) {
    throw createHttpError.notFound('Lote no encontrado');
  }

  if (!isLoteVencido(lote.fechaVencimiento)) {
    throw createHttpError.badRequest('Solo se pueden descartar lotes vencidos');
  }

  const stockDisponible = roundStock(decimalToNumber(lote.stockActual));
  if (stockDisponible <= EPSILON) {
    throw createHttpError.badRequest('El lote ya no tiene stock para descartar');
  }

  const cantidadValue = cantidad == null
    ? stockDisponible
    : roundStock(decimalToNumber(cantidad));

  if (cantidadValue <= EPSILON) {
    throw createHttpError.badRequest('La cantidad a descartar debe ser mayor a 0');
  }

  if (cantidadValue - stockDisponible > EPSILON) {
    throw createHttpError.badRequest('La cantidad a descartar excede el stock del lote');
  }

  const loteActualizado = await actualizarLote(tx, lote, {
    stockActual: stockDisponible - cantidadValue
  });

  const movimiento = await tx.movimientoStock.create({
    data: {
      ingredienteId: lote.ingredienteId,
      sucursalId: lote.sucursalId,
      loteStockId: lote.id,
      tipo: 'AJUSTE',
      cantidad: cantidadValue,
      motivo: motivo.trim()
    }
  });

  await sincronizarStockIngrediente(tx, lote.ingredienteId, lote.sucursalId);

  return {
    ingrediente: await syncIngredienteAggregate(tx, lote.ingredienteId),
    lote: loteActualizado,
    movimiento,
    cantidad: cantidadValue
  };
};

module.exports = {
  EPSILON,
  ajustarStockPorLotes,
  buildAutoLoteCode,
  buildConsumibleLoteWhere,
  buildExpiredLotsWhere,
  buildExpiredPendingNotificationWhere,
  consumirLotesFIFO,
  descartarLoteVencido,
  ensureLegacyLotesCoverage,
  isLoteConsumible,
  isLoteVencido,
  normalizeExpiryDate,
  obtenerLotesActivos,
  obtenerLotesConsumibles,
  obtenerLotesVencidosPendientes,
  registrarEntradaEnLote,
  roundStock,
  startOfDay,
  sincronizarStockIngrediente,
  sumStock,
  syncIngredienteAggregate
};
