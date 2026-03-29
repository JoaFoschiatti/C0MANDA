const eventBus = require('../services/event-bus');
const { prisma } = require('../db/prisma');
const { logger } = require('../utils/logger');
const { decimalToNumber } = require('../utils/decimal');
const { obtenerLotesVencidosPendientes } = require('../services/lotes-stock.service');
const { withAdvisoryLock } = require('../services/distributed-lock.service');

const JOB_INTERVAL_MS = 60 * 60 * 1000;

let intervalId = null;

const buildNotificationPayload = (lotes, generatedAt) => {
  const ingredientesUnicos = new Set(lotes.map((lote) => lote.ingredienteId));

  return {
    totalLotes: lotes.length,
    totalIngredientes: ingredientesUnicos.size,
    totalStockNoConsumible: lotes.reduce(
      (sum, lote) => sum + decimalToNumber(lote.stockActual),
      0
    ),
    generatedAt: generatedAt.toISOString(),
    items: lotes.map((lote) => ({
      loteId: lote.id,
      ingredienteId: lote.ingredienteId,
      ingrediente: lote.ingrediente?.nombre || 'Ingrediente',
      unidad: lote.ingrediente?.unidad || null,
      codigoLote: lote.codigoLote,
      stockActual: decimalToNumber(lote.stockActual),
      fechaVencimiento: lote.fechaVencimiento?.toISOString() || null
    }))
  };
};

const procesarLotesVencidos = async (referenceDate = new Date(), db = prisma) => {
  try {
    const lotesPendientes = await obtenerLotesVencidosPendientes(db, { referenceDate });
    if (lotesPendientes.length === 0) {
      return [];
    }

    const now = new Date();
    await db.loteStock.updateMany({
      where: {
        id: { in: lotesPendientes.map((lote) => lote.id) }
      },
      data: {
        ultimaNotificacionVencimiento: now
      }
    });

    const payload = buildNotificationPayload(lotesPendientes, now);
    eventBus.publish('stock.lotes_vencidos', payload);
    logger.warn('Lotes vencidos pendientes de descarte detectados', {
      totalLotes: payload.totalLotes,
      totalIngredientes: payload.totalIngredientes
    });

    return [payload];
  } catch (error) {
    logger.error('Error procesando lotes vencidos:', error);
    return [];
  }
};

const ejecutarLotesVencidosConLock = async (referenceDate = new Date()) => withAdvisoryLock(
  prisma,
  'jobs.lotes-vencidos',
  async (tx) => procesarLotesVencidos(referenceDate, tx)
);

const iniciarJobLotesVencidos = () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (intervalId) {
    return intervalId;
  }

  logger.info('Job de lotes vencidos iniciado');
  void ejecutarLotesVencidosConLock();
  intervalId = setInterval(() => {
    void ejecutarLotesVencidosConLock();
  }, JOB_INTERVAL_MS);

  return intervalId;
};

const detenerJobLotesVencidos = () => {
  if (!intervalId) {
    return;
  }

  clearInterval(intervalId);
  intervalId = null;
};

module.exports = {
  detenerJobLotesVencidos,
  iniciarJobLotesVencidos,
  procesarLotesVencidos
};
