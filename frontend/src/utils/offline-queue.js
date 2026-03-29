const STORAGE_KEY = 'comanda_offline_queue'

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

function getOperationLabel(method, url) {
  if (method === 'post' && /^\/pedidos$/.test(url)) return OPERATION_LABELS['post:/pedidos']
  if (method === 'patch' && /^\/pedidos\/\d+\/estado$/.test(url)) return OPERATION_LABELS['patch:/pedidos/estado']
  if (method === 'post' && /^\/pagos$/.test(url)) return OPERATION_LABELS['post:/pagos']
  if (method === 'post' && /^\/mesas\/\d+\/liberar$/.test(url)) return OPERATION_LABELS['post:/mesas/liberar']
  if (method === 'post' && /^\/mesas\/\d+\/precuenta$/.test(url)) return OPERATION_LABELS['post:/mesas/precuenta']
  if (method === 'post' && /^\/pedidos\/\d+\/cerrar$/.test(url)) return OPERATION_LABELS['post:/pedidos/cerrar']
  return 'Operacion pendiente'
}

export function isQueueableOperation(method, url) {
  const m = method.toLowerCase()
  return QUEUEABLE_OPERATIONS.some(op => op.method === m && op.pattern.test(url))
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

export function addToQueue({ method, url, data }) {
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
      saveQueue(getQueue().map(q => q.id === item.id ? item : q))

      await axiosInstance({
        method: item.method,
        url: item.url,
        data: item.data,
        __fromQueue: true,
        skipToast: true,
      })

      removeFromQueue(item.id)
      processed++
    } catch (err) {
      const status = err.response?.status
      if (status && status >= 400 && status < 500) {
        // Client error — don't retry
        item.status = 'failed'
        item.error = err.response?.data?.error?.message || 'Error del servidor'
        saveQueue(getQueue().map(q => q.id === item.id ? item : q))
        failed++
      } else {
        // Network/server error — retry later
        item.retries++
        if (item.retries >= item.maxRetries) {
          item.status = 'failed'
          item.error = 'Maximo de reintentos alcanzado'
          failed++
        } else {
          item.status = 'pending'
        }
        saveQueue(getQueue().map(q => q.id === item.id ? item : q))
      }
    }
  }

  const remaining = getQueueCount()
  return { processed, failed, remaining }
}
