export const createEventSource = () => {
  if (typeof EventSource !== 'function') {
    return null
  }

  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  const url = `${apiUrl}/eventos`
  return new EventSource(url, { withCredentials: true })
}
