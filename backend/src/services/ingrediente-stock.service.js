const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const { ensureBaseSucursales } = require('./sucursales.service');

const roundStock = (value) => Number.parseFloat(Math.max(0, value).toFixed(3));

const buildIngredienteStockDefaults = (ingrediente, defaults = {}, useLegacyFallback = true) => ({
  stockActual: defaults.stockActual !== undefined
    ? roundStock(decimalToNumber(defaults.stockActual))
    : useLegacyFallback
      ? roundStock(decimalToNumber(ingrediente.stockActual))
      : 0,
  stockMinimo: defaults.stockMinimo !== undefined
    ? roundStock(decimalToNumber(defaults.stockMinimo))
    : roundStock(decimalToNumber(ingrediente.stockMinimo)),
  activo: defaults.activo ?? ingrediente.activo ?? true
});

const buildIngredienteStockSnapshot = (ingrediente, payload) => {
  const {
    sucursalId,
    sucursal = null,
    stock = null,
    defaults = {},
    useLegacyFallback = false
  } = payload;

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  if (stock) {
    return {
      ...stock,
      ingrediente: stock.ingrediente || ingrediente,
      sucursal: stock.sucursal || sucursal || null
    };
  }

  return {
    id: null,
    ingredienteId: ingrediente.id,
    sucursalId,
    stockActual: defaults.stockActual !== undefined
      ? roundStock(decimalToNumber(defaults.stockActual))
      : useLegacyFallback
        ? roundStock(decimalToNumber(ingrediente.stockActual))
        : 0,
    stockMinimo: defaults.stockMinimo !== undefined
      ? roundStock(decimalToNumber(defaults.stockMinimo))
      : roundStock(decimalToNumber(ingrediente.stockMinimo)),
    activo: defaults.activo ?? ingrediente.activo ?? true,
    createdAt: ingrediente.createdAt,
    updatedAt: ingrediente.updatedAt,
    ingrediente,
    sucursal: sucursal || null
  };
};

const ensureIngredienteStock = async (tx, payload) => {
  const {
    ingredienteId,
    sucursalId,
    defaults = {},
    useLegacyFallback = true
  } = payload;

  const ingrediente = await tx.ingrediente.findUnique({
    where: { id: ingredienteId }
  });

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  await ensureBaseSucursales(tx);

  let stock = await tx.ingredienteStock.findUnique({
    where: {
      ingredienteId_sucursalId: {
        ingredienteId,
        sucursalId
      }
    }
  });

  if (!stock) {
    stock = await tx.ingredienteStock.create({
      data: {
        ingredienteId,
        sucursalId,
        ...buildIngredienteStockDefaults(ingrediente, defaults, useLegacyFallback)
      }
    });
  }

  return { ingrediente, stock };
};

const updateIngredienteStock = async (tx, payload) => {
  const { ingredienteId, sucursalId, data, useLegacyFallback = true } = payload;
  const { stock } = await ensureIngredienteStock(tx, {
    ingredienteId,
    sucursalId,
    useLegacyFallback
  });

  return tx.ingredienteStock.update({
    where: { id: stock.id },
    data
  });
};

const getIngredienteStock = async (tx, ingredienteId, sucursalId, options = {}) => {
  const { useLegacyFallback = true } = options;
  const { stock } = await ensureIngredienteStock(tx, {
    ingredienteId,
    sucursalId,
    useLegacyFallback
  });
  return stock;
};

module.exports = {
  buildIngredienteStockSnapshot,
  ensureIngredienteStock,
  getIngredienteStock,
  roundStock,
  updateIngredienteStock
};
