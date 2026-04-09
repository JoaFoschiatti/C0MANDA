import axios from 'axios'
import toast from 'react-hot-toast'
import {
  addToQueue,
  createIdempotencyKey,
  isQueueableOperation,
  normalizeRequestPath,
  processQueue,
} from '../utils/offline-queue'
import {
  isBackendConnectivityError,
  markBackendAvailable,
  markBackendUnavailable,
} from './backendStatus'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]
const OFFLINE_TOAST_ID = 'network-offline'
const BACKEND_UNAVAILABLE_TOAST_ID = 'backend-unavailable'
const IDEMPOTENCY_HEADER = 'Idempotency-Key'
const CACHE_CONTROL_HEADER = 'Cache-Control'
const PRAGMA_HEADER = 'Pragma'
const NO_STORE_VALUE = 'no-store'
const NO_CACHE_VALUE = 'no-cache'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const getHeaderValue = (headers, name) => {
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name)
  return headers[name] ?? headers[name.toLowerCase()]
}

const setHeaderValue = (headers, name, value) => {
  if (!headers) return { [name]: value }
  if (typeof headers.set === 'function') {
    headers.set(name, value)
    return headers
  }

  headers[name] = value
  return headers
}

// --- Request interceptor: offline detection + queue ---
api.interceptors.request.use(
  config => {
    const method = (config.method || 'get').toLowerCase()
    const url = config.url || ''
    const path = normalizeRequestPath(url)

    if (method === 'get' && path.startsWith('/mesas')) {
      config.headers = setHeaderValue(config.headers, CACHE_CONTROL_HEADER, NO_STORE_VALUE)
      config.headers = setHeaderValue(config.headers, PRAGMA_HEADER, NO_CACHE_VALUE)
    }

    if (isQueueableOperation(method, url)) {
      config.headers = config.headers || {}
      const idempotencyKey = getHeaderValue(config.headers, IDEMPOTENCY_HEADER) || createIdempotencyKey()
      config.headers = setHeaderValue(config.headers, IDEMPOTENCY_HEADER, idempotencyKey)

      if (navigator.onLine) return config

      const item = addToQueue({ method, url, data: config.data, idempotencyKey })
      const error = new Error('Operacion encolada offline')
      error.__queued = true
      error.__queueItem = item
      toast('Guardado localmente, se sincronizara al reconectar', { icon: '\u{1F4E6}' })
      return Promise.reject(error)
    }

    if (navigator.onLine) return config

    const error = new Error('Sin conexion a internet')
    error.__offline = true
    toast.error('Sin conexion a internet', { id: OFFLINE_TOAST_ID })
    return Promise.reject(error)
  },
  error => Promise.reject(error)
)

// --- Response interceptor: retry on network/5xx errors ---
api.interceptors.response.use(
  response => response,
  error => {
    if (error.__queued || error.__offline) return Promise.reject(error)

    const config = error.config
    if (!config) return Promise.reject(error)

    const isRetryable =
      !error.response ||
      error.code === 'ECONNABORTED' ||
      (error.response && error.response.status >= 500)

    if (!isRetryable) return Promise.reject(error)

    const method = (config.method || 'get').toLowerCase()
    const isReadOnly = method === 'get' || method === 'head' || method === 'options'
    const fromQueue = config.__fromQueue

    if (!isReadOnly && !fromQueue) return Promise.reject(error)

    config.__retryCount = (config.__retryCount || 0) + 1
    if (config.__retryCount > MAX_RETRIES) return Promise.reject(error)

    const delay = RETRY_DELAYS[config.__retryCount - 1] || 4000
    return new Promise(resolve => setTimeout(resolve, delay)).then(() => api.request(config))
  }
)

// --- Response interceptor: 401 + toast ---
api.interceptors.response.use(
  response => {
    markBackendAvailable()
    toast.dismiss(BACKEND_UNAVAILABLE_TOAST_ID)
    return response
  },
  error => {
    if (error.__queued || error.__offline) return Promise.reject(error)

    if (error.response) {
      markBackendAvailable()
    }

    if (navigator.onLine && isBackendConnectivityError(error)) {
      markBackendUnavailable()

      toast.error('Backend no disponible. Reintentando automaticamente.', {
        id: BACKEND_UNAVAILABLE_TOAST_ID
      })

      return Promise.reject(error)
    }

    const message = error.response?.data?.error?.message || 'Error de conexion'
    const skipToast = Boolean(error.config?.skipToast)

    const authUrl = error.config?.url || ''
    const isAuthChallengeRequest = authUrl.includes('/auth/login') || authUrl.includes('/auth/mfa/')

    if (error.response?.status === 401 && !isAuthChallengeRequest) {
      localStorage.removeItem('usuario')
      localStorage.removeItem('negocio')
      window.location.assign('/login')
      return Promise.reject(error)
    }

    if (!skipToast) {
      toast.error(message, { id: `api-err-${message}` })
    }

    return Promise.reject(error)
  }
)

export const processOfflineQueue = () => processQueue(api)

export default api
