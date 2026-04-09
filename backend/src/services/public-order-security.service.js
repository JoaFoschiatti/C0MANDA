const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { resolveClientIp } = require('../utils/client-ip');

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '').slice(-15);

const hashPhone = (value) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    return null;
  }

  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const summarizeUserAgent = (value) => {
  const userAgent = String(value || '').trim();
  return userAgent ? userAgent.slice(0, 200) : null;
};

const getRequestIp = (requestMeta = {}) => resolveClientIp({
  ip: requestMeta.clientIp || requestMeta.ip,
  forwardedFor: requestMeta.forwardedFor,
  remoteAddress: requestMeta.remoteAddress,
  trustProxy: requestMeta.trustProxy
});

const buildPublicAuditContext = ({
  action,
  requestMeta = {},
  pedidoId = null,
  mesaId = null,
  clientRequestId = null,
  phone = null,
  cause = null,
  blocked = false
}) => ({
  action,
  pedidoId,
  mesaId,
  clientRequestId,
  phoneHash: hashPhone(phone),
  ip: getRequestIp(requestMeta),
  userAgent: summarizeUserAgent(requestMeta.userAgent),
  blocked,
  cause
});

const logPublicAudit = (payload) => {
  logger.info('Public order audit', buildPublicAuditContext(payload));
};

const logPublicAbuseSignal = (payload) => {
  logger.warn('Public order abuse signal', buildPublicAuditContext({
    ...payload,
    blocked: payload.blocked ?? true
  }));
};

const isDeferredSettlementPedido = (pedido) => (
  pedido?.origen === 'MENU_PUBLICO' &&
  pedido?.tipo !== 'MESA'
);

const buildPedidoPaidUpdateData = (pedido, cobro) => {
  if (!cobro.fullyPaid) {
    return { estadoPago: 'PENDIENTE' };
  }

  const basePaidState = {
    estadoPago: 'APROBADO'
  };

  if (!isDeferredSettlementPedido(pedido)) {
    if (pedido.estado === 'ENTREGADO') {
      return {
        ...basePaidState,
        estado: 'COBRADO'
      };
    }

    return basePaidState;
  }

  if (pedido.estado === 'ENTREGADO') {
    return {
      ...basePaidState,
      estado: 'COBRADO',
      operacionConfirmada: true
    };
  }

  return {
    ...basePaidState,
    operacionConfirmada: true
  };
};

const shouldCloseMesaOnPaid = (_pedido, _cobro) => (
  false
);

module.exports = {
  buildPedidoPaidUpdateData,
  getRequestIp,
  hashPhone,
  isDeferredSettlementPedido,
  logPublicAbuseSignal,
  logPublicAudit,
  shouldCloseMesaOnPaid,
  summarizeUserAgent
};
