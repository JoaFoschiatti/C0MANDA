const PENDING_MP_ORDER_KEY = 'mp_pedido_pendiente'
const DEFAULT_TTL_MS = 30 * 60 * 1000
const PUBLIC_ORDER_TOKEN_PARAM = 'token'

const normalizeAccessToken = (accessToken) => {
  if (typeof accessToken !== 'string') {
    return null
  }

  const trimmedToken = accessToken.trim()
  return trimmedToken ? trimmedToken : null
}

export function savePendingMercadoPagoOrder({ pedidoId, accessToken = null, timestamp = Date.now() }) {
  if (!pedidoId) {
    return
  }

  localStorage.setItem(
    PENDING_MP_ORDER_KEY,
    JSON.stringify({
      pedidoId,
      accessToken: normalizeAccessToken(accessToken),
      timestamp
    })
  )
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
    const accessToken = normalizeAccessToken(parsed?.accessToken)

    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !Number.isFinite(timestamp)) {
      clearPendingMercadoPagoOrder()
      return null
    }

    if (Date.now() - timestamp > ttlMs) {
      clearPendingMercadoPagoOrder()
      return null
    }

    return { pedidoId, accessToken, timestamp }
  } catch {
    clearPendingMercadoPagoOrder()
    return null
  }
}

export function clearPendingMercadoPagoOrder() {
  localStorage.removeItem(PENDING_MP_ORDER_KEY)
}

export function appendPublicOrderToken(url, accessToken) {
  const normalizedToken = normalizeAccessToken(accessToken)

  if (!normalizedToken) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${PUBLIC_ORDER_TOKEN_PARAM}=${encodeURIComponent(normalizedToken)}`
}
