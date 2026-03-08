export const PUBLIC_API_URL = import.meta.env.VITE_API_URL || '/api'
export const PUBLIC_BACKEND_URL = PUBLIC_API_URL.replace(/\/api$/, '')

export async function fetchJson(url, options = {}, fallbackMessage = 'Error inesperado') {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.error?.message || data?.message || fallbackMessage
    throw new Error(message)
  }

  return data
}
