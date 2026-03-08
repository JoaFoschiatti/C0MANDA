import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEventSource } from '../services/eventos'

describe('createEventSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
