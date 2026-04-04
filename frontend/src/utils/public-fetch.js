export const PUBLIC_API_URL = import.meta.env.VITE_API_URL || '/api'
export const PUBLIC_BACKEND_URL = PUBLIC_API_URL.replace(/\/api$/, '')

const MAX_RETRIES = 2
const RETRY_DELAYS = [1000, 2000]

export async function fetchJson(url, options = {}, fallbackMessage = 'Error inesperado') {
  let lastError

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = data?.error?.message || data?.message || fallbackMessage
        const error = new Error(message)
        error.status = response.status
        throw error
      }

      return data
    } catch (error) {
      lastError = error
      const isRetryable = !error.status || error.status >= 500
      const method = (options.method || 'GET').toUpperCase()
      const isSafe = method === 'GET' || method === 'HEAD'

      if (!isRetryable || (!isSafe && attempt > 0) || attempt >= MAX_RETRIES) {
        break
      }

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
    }
  }

  throw lastError
}
