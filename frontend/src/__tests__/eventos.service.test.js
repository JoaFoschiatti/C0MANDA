import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEventSource } from '../services/eventos'

describe('createEventSource', () => {
  const originalApiUrl = import.meta.env.VITE_API_URL

  beforeEach(() => {
    vi.clearAllMocks()
    if (originalApiUrl === undefined) {
      delete import.meta.env.VITE_API_URL
    } else {
      import.meta.env.VITE_API_URL = originalApiUrl
    }
    global.EventSource = vi.fn(function EventSource(url, options) {
      this.url = url
      this.options = options
    })
  })

  it('crea EventSource por mismo origen usando cookie httpOnly', () => {
    const source = createEventSource()
    const expectedUrl = '/api/eventos'

    expect(global.EventSource).toHaveBeenCalledTimes(1)
    expect(global.EventSource).toHaveBeenCalledWith(expectedUrl, { withCredentials: true })
    expect(source.url).toBe(expectedUrl)
    expect(source.options).toEqual({ withCredentials: true })
  })

  it('usa VITE_API_URL cuando esta configurado', () => {
    import.meta.env.VITE_API_URL = 'http://localhost:3001/api'

    const source = createEventSource()

    expect(global.EventSource).toHaveBeenCalledWith('http://localhost:3001/api/eventos', {
      withCredentials: true
    })
    expect(source.url).toBe('http://localhost:3001/api/eventos')
  })
})
