import axios from 'axios'
import toast from 'react-hot-toast'
import { isQueueableOperation, addToQueue, processQueue } from '../utils/offline-queue'
import {
  isBackendConnectivityError,
  markBackendAvailable,
  markBackendUnavailable,
} from './backendStatus'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]
const OFFLINE_TOAST_ID = 'network-offline'
const BACKEND_UNAVAILABLE_TOAST_ID = 'backend-unavailable'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

// --- Request interceptor: offline detection + queue ---
api.interceptors.request.use(
  config => {
    if (navigator.onLine) return config

    const method = (config.method || 'get').toLowerCase()
    const url = config.url || ''

    if (isQueueableOperation(method, url)) {
      const item = addToQueue({ method, url, data: config.data })
      const error = new Error('Operacion encolada offline')
      error.__queued = true
      error.__queueItem = item
      toast('Guardado localmente, se sincronizara al reconectar', { icon: '\u{1F4E6}' })
      return Promise.reject(error)
    }

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
