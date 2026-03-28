const { decimalToNumber } = require('../utils/decimal');

const APPROVED_PAYMENT_STATE = 'APROBADO';
const PENDING_PAYMENT_STATE = 'PENDIENTE';
const INACTIVE_PAYMENT_STATES = new Set(['RECHAZADO', 'CANCELADO']);

const isPagoApproved = (pago) => pago?.estado === APPROVED_PAYMENT_STATE;

const isPagoPending = (pago) => pago?.estado === PENDING_PAYMENT_STATE;

const isPagoInactive = (pago) => INACTIVE_PAYMENT_STATES.has(pago?.estado);

const sumApprovedPagos = (pagos = []) => pagos
  .filter(isPagoApproved)
  .reduce((sum, pago) => sum + decimalToNumber(pago.monto), 0);

const sumApprovedPropinas = (pagos = []) => pagos
  .filter(isPagoApproved)
  .reduce((sum, pago) => sum + decimalToNumber(pago.propinaMonto), 0);

const buildPedidoCobroSummary = ({ total, pagos = [] }) => {
  const totalPedido = decimalToNumber(total);
  const totalPagado = sumApprovedPagos(pagos);
  const totalPropina = sumApprovedPropinas(pagos);
  const pendiente = Math.max(0, totalPedido - totalPagado);

  return {
    totalPedido,
    totalPagado,
    totalPropina,
    pendiente,
    fullyPaid: pendiente <= 0.01
  };
};

const findOpenPagoForChannel = (pagos = [], canalCobro, metodo = null) => pagos.find((pago) => (
  pago?.canalCobro === canalCobro &&
  pago?.estado === PENDING_PAYMENT_STATE &&
  (metodo ? pago?.metodo === metodo : true)
));

const cancelPendingPaymentsForChannel = async (tx, payload) => {
  const {
    pedidoId,
    canalCobro,
    metodo = null,
    excludePagoId = null
  } = payload;

  return tx.pago.updateMany({
    where: {
      pedidoId,
      canalCobro,
      estado: PENDING_PAYMENT_STATE,
      ...(metodo ? { metodo } : {}),
      ...(excludePagoId ? { id: { not: excludePagoId } } : {})
    },
    data: {
      estado: 'CANCELADO'
    }
  });
};

module.exports = {
  APPROVED_PAYMENT_STATE,
  PENDING_PAYMENT_STATE,
  INACTIVE_PAYMENT_STATES,
  buildPedidoCobroSummary,
  cancelPendingPaymentsForChannel,
  findOpenPagoForChannel,
  isPagoApproved,
  isPagoInactive,
  isPagoPending,
  sumApprovedPagos,
  sumApprovedPropinas
};
