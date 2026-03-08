const PENDING_MP_ORDER_KEY = 'mp_pedido_pendiente'
const DEFAULT_TTL_MS = 30 * 60 * 1000

export function savePendingMercadoPagoOrder({ pedidoId, timestamp = Date.now() }) {
  if (!pedidoId) {
    return
  }

  localStorage.setItem(PENDING_MP_ORDER_KEY, JSON.stringify({ pedidoId, timestamp }))
}

export function loadPendingMercadoPagoOrder(ttlMs = DEFAULT_TTL_MS) {
  const rawValue = localStorage.getItem(PENDING_MP_ORDER_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    const pedidoId = Number(parsed?.pedidoId)
    const timestamp = Number(parsed?.timestamp)

    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !Number.isFinite(timestamp)) {
      clearPendingMercadoPagoOrder()
      return null
    }

    if (Date.now() - timestamp > ttlMs) {
      clearPendingMercadoPagoOrder()
      return null
    }

    return { pedidoId, timestamp }
  } catch {
    clearPendingMercadoPagoOrder()
    return null
  }
}

export function clearPendingMercadoPagoOrder() {
  localStorage.removeItem(PENDING_MP_ORDER_KEY)
}
