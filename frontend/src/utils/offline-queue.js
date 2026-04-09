const STORAGE_KEY = 'comanda_offline_queue'
const IDEMPOTENCY_HEADER = 'Idempotency-Key'

const QUEUEABLE_OPERATIONS = [
  { method: 'post', pattern: /^\/pedidos$/ },
  { method: 'patch', pattern: /^\/pedidos\/\d+\/estado$/ },
  { method: 'post', pattern: /^\/pagos$/ },
  { method: 'post', pattern: /^\/mesas\/\d+\/liberar$/ },
  { method: 'post', pattern: /^\/mesas\/\d+\/precuenta$/ },
  { method: 'post', pattern: /^\/pedidos\/\d+\/cerrar$/ },
]

const OPERATION_LABELS = {
  'post:/pedidos': 'Crear pedido',
  'patch:/pedidos/estado': 'Cambiar estado pedido',
  'post:/pagos': 'Registrar pago',
  'post:/mesas/liberar': 'Liberar mesa',
  'post:/mesas/precuenta': 'Pedir precuenta',
  'post:/pedidos/cerrar': 'Cerrar pedido',
}

export function normalizeRequestPath(url) {
  if (!url) return ''

  try {
    const pathname = new URL(url, 'http://localhost').pathname
    return pathname.startsWith('/api/') ? pathname.slice(4) : pathname
  } catch {
    const pathname = String(url).split(/[?#]/)[0]
    return pathname.startsWith('/api/') ? pathname.slice(4) : pathname
  }
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `idempotency-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getOperationLabel(method, url) {
  const normalizedMethod = method.toLowerCase()
  const path = normalizeRequestPath(url)

  if (normalizedMethod === 'post' && /^\/pedidos$/.test(path)) return OPERATION_LABELS['post:/pedidos']
  if (normalizedMethod === 'patch' && /^\/pedidos\/\d+\/estado$/.test(path)) return OPERATION_LABELS['patch:/pedidos/estado']
  if (normalizedMethod === 'post' && /^\/pagos$/.test(path)) return OPERATION_LABELS['post:/pagos']
  if (normalizedMethod === 'post' && /^\/mesas\/\d+\/liberar$/.test(path)) return OPERATION_LABELS['post:/mesas/liberar']
  if (normalizedMethod === 'post' && /^\/mesas\/\d+\/precuenta$/.test(path)) return OPERATION_LABELS['post:/mesas/precuenta']
  if (normalizedMethod === 'post' && /^\/pedidos\/\d+\/cerrar$/.test(path)) return OPERATION_LABELS['post:/pedidos/cerrar']
  return 'Operacion pendiente'
}

export function isQueueableOperation(method, url) {
  const m = method.toLowerCase()
  const path = normalizeRequestPath(url)
  return QUEUEABLE_OPERATIONS.some(op => op.method === m && op.pattern.test(path))
}

export function getQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function addToQueue({ method, url, data, idempotencyKey }) {
  const queue = getQueue()
  const item = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    method,
    url,
    data,
    status: 'pending',
    retries: 0,
    maxRetries: 3,
    description: getOperationLabel(method, url),
    idempotencyKey: idempotencyKey || createIdempotencyKey(),
  }
  queue.push(item)
  saveQueue(queue)
  return item
}

export function removeFromQueue(id) {
  const queue = getQueue().filter(item => item.id !== id)
  saveQueue(queue)
}

export function getQueueCount() {
  return getQueue().filter(item => item.status === 'pending').length
}

export function clearQueue() {
  localStorage.removeItem(STORAGE_KEY)
}

export async function processQueue(axiosInstance) {
  const queue = getQueue()
  const pending = queue.filter(item => item.status === 'pending').sort((a, b) => a.timestamp - b.timestamp)

  if (pending.length === 0) return { processed: 0, failed: 0, remaining: 0 }

  let processed = 0
  let failed = 0

  for (const item of pending) {
    try {
      item.status = 'syncing'
      item.idempotencyKey ||= createIdempotencyKey()
      saveQueue(queue)

      await axiosInstance({
        method: item.method,
        url: item.url,
        data: item.data,
        __fromQueue: true,
        skipToast: true,
        headers: {
          [IDEMPOTENCY_HEADER]: item.idempotencyKey,
        },
      })

      removeFromQueue(item.id)
      processed++
    } catch (err) {
      const status = err.response?.status
      if (status && status >= 400 && status < 500) {
        // Client error - don't retry
        item.status = 'failed'
        item.error = err.response?.data?.error?.message || 'Error del servidor'
        saveQueue(queue)
        failed++
      } else {
        // Network/server error - retry later
        item.retries++
        if (item.retries >= item.maxRetries) {
          item.status = 'failed'
          item.error = 'Maximo de reintentos alcanzado'
          failed++
        } else {
          item.status = 'pending'
        }
        saveQueue(queue)
      }
    }
  }

  const remaining = getQueueCount()
  return { processed, failed, remaining }
}
