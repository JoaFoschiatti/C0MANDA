import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToQueue, clearQueue, getQueue, processQueue } from '../utils/offline-queue'

describe('offline queue idempotency', () => {
  let storage

  beforeEach(() => {
    storage = {}

    localStorage.getItem.mockImplementation((key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null))
    localStorage.setItem.mockImplementation((key, value) => {
      storage[key] = String(value)
    })
    localStorage.removeItem.mockImplementation((key) => {
      delete storage[key]
    })
    localStorage.clear.mockImplementation(() => {
      storage = {}
    })

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('queue-item-id-1')
        .mockReturnValue('idempotency-key-1'),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('genera y persiste una clave idempotente al encolar una mutacion', () => {
    const item = addToQueue({
      method: 'post',
      url: '/pagos',
      data: { pedidoId: 10 },
    })

    expect(item.idempotencyKey).toBe('idempotency-key-1')
    expect(getQueue()).toHaveLength(1)
    expect(getQueue()[0].idempotencyKey).toBe('idempotency-key-1')
  })

  it('reutiliza la misma clave cuando reintenta procesar la cola', async () => {
    addToQueue({
      method: 'post',
      url: '/pedidos',
      data: { tipo: 'MESA' },
    })

    const axiosInstance = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { ok: true } })

    const firstRun = await processQueue(axiosInstance)
    const firstRequest = axiosInstance.mock.calls[0][0]

    expect(firstRun).toEqual({ processed: 0, failed: 0, remaining: 1 })
    expect(firstRequest.headers['Idempotency-Key']).toBe('idempotency-key-1')
    expect(getQueue()[0].idempotencyKey).toBe('idempotency-key-1')

    const secondRun = await processQueue(axiosInstance)
    const secondRequest = axiosInstance.mock.calls[1][0]

    expect(secondRun).toEqual({ processed: 1, failed: 0, remaining: 0 })
    expect(secondRequest.headers['Idempotency-Key']).toBe('idempotency-key-1')
    expect(getQueue()).toEqual([])
  })

  it('limpia la cola local cuando se solicita', () => {
    addToQueue({
      method: 'post',
      url: '/mesas/1/precuenta',
      data: {},
    })

    clearQueue()

    expect(getQueue()).toEqual([])
  })
})
