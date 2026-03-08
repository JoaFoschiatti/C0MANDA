const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');

const EPSILON = 0.0001;

const roundStock = (value) => Number.parseFloat(Math.max(0, value).toFixed(3));

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

const buildConsumibleLoteWhere = (referenceDate = new Date()) => ({
  activo: true,
  stockActual: { gt: 0 },
  OR: [
    { fechaVencimiento: null },
    { fechaVencimiento: { gte: referenceDate } }
  ]
});

const startOfDay = (value = new Date()) => {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const buildExpiredLotsWhere = (referenceDate = new Date()) => ({
  activo: true,
  stockActual: { gt: 0 },
  fechaVencimiento: { lt: referenceDate }
});

const buildExpiredPendingNotificationWhere = (referenceDate = new Date()) => ({
  ...buildExpiredLotsWhere(referenceDate),
  OR: [
    { ultimaNotificacionVencimiento: null },
    { ultimaNotificacionVencimiento: { lt: startOfDay(referenceDate) } }
  ]
});

const obtenerLotesActivos = async (tx, ingredienteId) => tx.loteStock.findMany({
  where: {
    ingredienteId,
    activo: true,
    stockActual: { gt: 0 }
  },
  orderBy: [
    { fechaIngreso: 'asc' },
    { id: 'asc' }
  ]
});

const obtenerLotesConsumibles = async (tx, ingredienteId, referenceDate = new Date()) => tx.loteStock.findMany({
  where: {
    ingredienteId,
    ...buildConsumibleLoteWhere(referenceDate)
  },
  orderBy: [
    { fechaIngreso: 'asc' },
    { id: 'asc' }
  ]
});

const obtenerLotesVencidosPendientes = async (tx, options = {}) => {
  const { referenceDate = new Date() } = options;

  return tx.loteStock.findMany({
    where: buildExpiredPendingNotificationWhere(referenceDate),
    include: {
      ingrediente: {
        select: {
          id: true,
          nombre: true,
          unidad: true
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

const ensureLegacyLotesCoverage = async (tx, ingrediente, options = {}) => {
  const { allowPartialCoverage = false } = options;
  const lotes = await obtenerLotesActivos(tx, ingrediente.id);
  const totalEnLotes = sumStock(lotes);
  const stockIngrediente = decimalToNumber(ingrediente.stockActual);

  const crearLoteLegacy = (
    (lotes.length === 0 && stockIngrediente > EPSILON) ||
    (allowPartialCoverage && stockIngrediente - totalEnLotes > EPSILON)
  );

  if (!crearLoteLegacy) {
    return lotes;
  }

  const faltante = lotes.length === 0
    ? roundStock(stockIngrediente)
    : roundStock(stockIngrediente - totalEnLotes);
  const loteLegacy = await tx.loteStock.create({
    data: {
      ingredienteId: ingrediente.id,
      codigoLote: buildAutoLoteCode(`LEGACY-${ingrediente.id}`),
      stockInicial: faltante,
      stockActual: faltante,
      costoUnitario: ingrediente.costo ?? null,
      fechaIngreso: ingrediente.createdAt || new Date()
    }
  });

  return [...lotes, loteLegacy];
};

const sincronizarStockIngrediente = async (tx, ingredienteOrId, referenceDate = new Date(), options = {}) => {
  const { migrateLegacy = false } = options;
  const ingrediente = typeof ingredienteOrId === 'object'
    ? ingredienteOrId
    : await tx.ingrediente.findUnique({ where: { id: ingredienteOrId } });

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const lotes = migrateLegacy
    ? await ensureLegacyLotesCoverage(tx, ingrediente)
    : await obtenerLotesActivos(tx, ingrediente.id);
  const stockConsumible = roundStock(
    sumStock(lotes.filter((lote) => isLoteConsumible(lote, referenceDate)))
  );

  if (Math.abs(decimalToNumber(ingrediente.stockActual) - stockConsumible) <= EPSILON) {
    return { ...ingrediente, stockActual: stockConsumible };
  }

  return tx.ingrediente.update({
    where: { id: ingrediente.id },
    data: { stockActual: stockConsumible }
  });
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

  await ensureLegacyLotesCoverage(tx, ingrediente);

  const normalizedExpiryDate = normalizeExpiryDate(fechaVencimiento);

  let lote = null;
  let loteCreadoNuevo = false;

  if (loteStockId) {
    lote = await tx.loteStock.findUnique({ where: { id: loteStockId } });
    if (!lote || lote.ingredienteId !== ingredienteId) {
      throw createHttpError.badRequest('El lote indicado no pertenece al ingrediente');
    }
  } else {
    const codigo = codigoLote || buildAutoLoteCode(`LOTE-${ingredienteId}`);
    lote = await tx.loteStock.findFirst({
      where: {
        ingredienteId,
        codigoLote: codigo
      }
    });

    if (!lote) {
      loteCreadoNuevo = true;
      lote = await tx.loteStock.create({
        data: {
          ingredienteId,
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
      loteStockId: lote.id,
      tipo: tipoMovimiento,
      cantidad: cantidadValue,
      motivo,
      pedidoId
    }
  });

  const ingredienteActualizado = await sincronizarStockIngrediente(tx, ingredienteId);

  return {
    ingrediente: ingredienteActualizado,
    lote,
    movimiento,
    cantidad: cantidadValue
  };
};

const consumirLotesFIFO = async (tx, payload) => {
  const {
    ingredienteId,
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
  await sincronizarStockIngrediente(tx, ingrediente, referenceDate, { migrateLegacy: true });
  const lotes = await obtenerLotesConsumibles(tx, ingredienteId, referenceDate);
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

  const ingredienteActualizado = await sincronizarStockIngrediente(tx, ingredienteId, referenceDate);

  return {
    ingrediente: ingredienteActualizado,
    consumos,
    totalConsumido: cantidadValue
  };
};

const ajustarStockPorLotes = async (tx, payload) => {
  const {
    ingredienteId,
    stockReal,
    motivo = null
  } = payload;

  const ingrediente = await tx.ingrediente.findUnique({ where: { id: ingredienteId } });
  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const ingredienteActualizado = await sincronizarStockIngrediente(tx, ingrediente, new Date(), { migrateLegacy: true });
  const stockActual = decimalToNumber(ingredienteActualizado.stockActual);
  const stockRealValue = roundStock(decimalToNumber(stockReal));
  const diferencia = roundStock(stockRealValue - stockActual);
  const motivoFinal = motivo || `Ajuste de inventario (${diferencia >= 0 ? '+' : ''}${diferencia})`;

  if (Math.abs(diferencia) <= EPSILON) {
    return { diferencia: 0, stockReal: stockRealValue, movimientos: [] };
  }

  if (diferencia > 0) {
    const ingreso = await registrarEntradaEnLote(tx, {
      ingredienteId,
      cantidad: diferencia,
      motivo: motivoFinal,
      tipoMovimiento: 'AJUSTE',
      incrementStockInicial: false,
      codigoLote: buildAutoLoteCode(`AJUSTE-${ingredienteId}`),
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
      loteStockId: lote.id,
      tipo: 'AJUSTE',
      cantidad: cantidadValue,
      motivo: motivo.trim()
    }
  });

  const ingredienteActualizado = await sincronizarStockIngrediente(tx, lote.ingredienteId);

  return {
    ingrediente: ingredienteActualizado,
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
  sumStock
};
