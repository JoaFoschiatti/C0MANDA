const { createHttpError } = require('../utils/http-error');

const TERMINAL_PEDIDO_STATES = new Set(['CANCELADO', 'CERRADO']);
const ACTIVE_PEDIDO_STATES = new Set(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO']);
const ADD_ITEMS_ALLOWED_STATES = new Set(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO']);

const PEDIDO_TRANSITIONS = {
  PENDIENTE: new Set(['EN_PREPARACION', 'CANCELADO']),
  EN_PREPARACION: new Set(['LISTO', 'CANCELADO']),
  LISTO: new Set(['ENTREGADO', 'CANCELADO']),
  ENTREGADO: new Set(['CANCELADO']),
  COBRADO: new Set(['CERRADO']),
  CERRADO: new Set([]),
  CANCELADO: new Set([])
};

const isPedidoTerminal = (estado) => TERMINAL_PEDIDO_STATES.has(estado);

const canAddItemsToPedido = (estado) => ADD_ITEMS_ALLOWED_STATES.has(estado);

const assertPedidoTransition = (from, to) => {
  if (from === to) {
    return;
  }

  const allowedTargets = PEDIDO_TRANSITIONS[from] || new Set();
  if (allowedTargets.has(to)) {
    return;
  }

  throw createHttpError.badRequest(`No se puede cambiar el pedido de ${from} a ${to}`);
};

module.exports = {
  ACTIVE_PEDIDO_STATES,
  ADD_ITEMS_ALLOWED_STATES,
  PEDIDO_TRANSITIONS,
  TERMINAL_PEDIDO_STATES,
  assertPedidoTransition,
  canAddItemsToPedido,
  isPedidoTerminal
};
