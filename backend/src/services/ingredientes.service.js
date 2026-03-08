const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const { createCrudService } = require('./crud-factory.service');
const {
  ajustarStockPorLotes,
  buildAutoLoteCode,
  consumirLotesFIFO,
  descartarLoteVencido,
  isLoteConsumible,
  isLoteVencido,
  registrarEntradaEnLote,
  roundStock,
  sumStock
} = require('./lotes-stock.service');

const ALERT_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const addDays = (value, days) => {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
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

const enrichIngrediente = (ingrediente, referenceDate = new Date()) => {
  const lotes = (ingrediente.lotes || []).map((lote) => enrichLote(lote, referenceDate));
  const stockFisico = lotes.length > 0
    ? roundStock(sumStock(lotes))
    : decimalToNumber(ingrediente.stockActual);
  const stockConsumible = lotes.length > 0
    ? roundStock(sumStock(lotes.filter((lote) => isLoteConsumible(lote, referenceDate))))
    : stockFisico;
  const stockNoConsumible = lotes.length > 0
    ? roundStock(sumStock(lotes.filter((lote) => !isLoteConsumible(lote, referenceDate))))
    : 0;
  const lotesAlerta = lotes.filter((lote) => lote.estadoLote !== 'DISPONIBLE').slice(0, 3);

  return {
    ...ingrediente,
    stockActual: stockConsumible,
    stockFisico,
    stockNoConsumible,
    lotes,
    lotesAlerta,
    requiereDescarteManual: lotes.some((lote) => lote.estadoLote === 'VENCIDO'),
    tieneLotesVencidos: lotes.some((lote) => lote.estadoLote === 'VENCIDO'),
    tieneLotesPorVencer: lotes.some((lote) => lote.estadoLote === 'PROXIMO_VENCIMIENTO')
  };
};

const verificarProductosDisponibles = async (prisma, ingredienteId) => {
  const productosNoDisponibles = await prisma.producto.findMany({
    where: {
      disponible: false,
      ingredientes: {
        some: { ingredienteId }
      }
    },
    include: {
      ingredientes: {
        include: { ingrediente: true }
      }
    }
  });

  const productosHabilitados = [];
  const events = [];

  for (const producto of productosNoDisponibles) {
    const todosConStock = producto.ingredientes.every(
      (pi) => decimalToNumber(pi.ingrediente.stockActual) > 0
    );

    if (!todosConStock) {
      continue;
    }

    await prisma.producto.update({
      where: { id: producto.id },
      data: { disponible: true }
    });

    productosHabilitados.push(producto);
    events.push({
      topic: 'producto.disponible',
      payload: {
        id: producto.id,
        nombre: producto.nombre,
        motivo: 'Stock repuesto',
        updatedAt: new Date().toISOString()
      }
    });
  }

  return { productosHabilitados, events };
};

const baseCrud = createCrudService('ingrediente', {
  uniqueFields: { nombre: 'nombre' },
  defaultOrderBy: { nombre: 'asc' },
  softDelete: true,
  softDeleteField: 'activo',
  entityName: 'ingrediente',
  gender: 'm',
  afterCreate: async (prisma, ingrediente) => {
    if (decimalToNumber(ingrediente.stockActual) <= 0) {
      return;
    }

    const loteInicial = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: buildAutoLoteCode(`INICIAL-${ingrediente.id}`),
        stockInicial: ingrediente.stockActual,
        stockActual: ingrediente.stockActual,
        costoUnitario: ingrediente.costo ?? null
      }
    });

    await prisma.movimientoStock.create({
      data: {
        ingredienteId: ingrediente.id,
        loteStockId: loteInicial.id,
        tipo: 'ENTRADA',
        cantidad: ingrediente.stockActual,
        motivo: 'Stock inicial'
      }
    });
  }
});

const listar = async (prisma, query) => {
  const { activo, stockBajo } = query;
  const referenceDate = new Date();
  const where = {};

  if (typeof activo === 'boolean') {
    where.activo = activo;
  }

  let ingredientes = await prisma.ingrediente.findMany({
    where,
    include: {
      lotes: {
        where: {
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

  ingredientes = ingredientes.map((ingrediente) => enrichIngrediente(ingrediente, referenceDate));

  if (stockBajo) {
    ingredientes = ingredientes.filter(
      (ingrediente) => decimalToNumber(ingrediente.stockActual) <= decimalToNumber(ingrediente.stockMinimo)
    );
  }

  return ingredientes;
};

const obtener = async (prisma, id) => {
  const ingrediente = await prisma.ingrediente.findUnique({
    where: { id },
    include: {
      lotes: {
        orderBy: [
          { activo: 'desc' },
          { fechaIngreso: 'asc' },
          { id: 'asc' }
        ]
      },
      movimientos: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      productos: {
        include: { producto: { select: { nombre: true } } }
      }
    }
  });

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  return enrichIngrediente(ingrediente);
};

const registrarMovimiento = async (prisma, id, data) => {
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
      cantidad,
      motivo,
      tipoMovimiento: 'SALIDA'
    });

    return {
      nuevoStock: decimalToNumber(consumo.ingrediente.stockActual),
      tipo: data.tipo
    };
  });

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id }
  });

  let events = [];
  if (result.tipo === 'ENTRADA' && result.nuevoStock > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return { ingrediente: ingredienteActualizado, events };
};

const ajustarStock = async (prisma, id, data) => {
  const result = await prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.findUnique({ where: { id } });
    if (!ingrediente) {
      throw createHttpError.notFound('Ingrediente no encontrado');
    }

    const stockReal = decimalToNumber(data.stockReal);

    return ajustarStockPorLotes(tx, {
      ingredienteId: id,
      stockReal,
      motivo: data.motivo || null
    });
  });

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id }
  });

  let events = [];
  if (result.diferencia > 0 && result.stockReal > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return { ingrediente: ingredienteActualizado, events };
};

const alertasStock = async (prisma) => {
  const ingredientes = await prisma.ingrediente.findMany({
    where: { activo: true },
    include: {
      lotes: {
        where: {
          activo: true,
          stockActual: { gt: 0 }
        },
        orderBy: [
          { fechaVencimiento: 'asc' },
          { fechaIngreso: 'asc' },
          { id: 'asc' }
        ]
      }
    }
  });

  return ingredientes
    .map((ingrediente) => enrichIngrediente(ingrediente))
    .filter((ingrediente) => (
      decimalToNumber(ingrediente.stockActual) <= decimalToNumber(ingrediente.stockMinimo) ||
      ingrediente.lotesAlerta.length > 0
    ));
};

const descartarLote = async (prisma, loteId, data) => {
  const result = await prisma.$transaction(async (tx) => {
    const descarte = await descartarLoteVencido(tx, {
      loteId,
      cantidad: data.cantidad ?? null,
      motivo: data.motivo
    });

    return descarte;
  });

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id: result.ingrediente.id },
    include: {
      lotes: {
        orderBy: [
          { activo: 'desc' },
          { fechaIngreso: 'asc' },
          { id: 'asc' }
        ]
      },
      movimientos: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      productos: {
        include: { producto: { select: { nombre: true } } }
      }
    }
  });

  return {
    ingrediente: enrichIngrediente(ingredienteActualizado),
    lote: result.lote,
    movimiento: result.movimiento
  };
};

module.exports = {
  ...baseCrud,
  alertasStock,
  ajustarStock,
  descartarLote,
  listar,
  obtener,
  registrarMovimiento,
  verificarProductosDisponibles
};
