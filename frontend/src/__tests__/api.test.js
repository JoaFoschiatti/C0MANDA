import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const axiosState = vi.hoisted(() => ({
  requestHandlers: [],
  responseSuccessHandlers: [],
  responseFailureHandlers: []
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: vi.fn((success, failure) => {
            axiosState.requestHandlers.push({ success, failure })
          })
        },
        response: {
          use: vi.fn((success, failure) => {
            axiosState.responseSuccessHandlers.push(success)
            axiosState.responseFailureHandlers.push(failure)
          })
        }
      },
      request: vi.fn(),
      defaults: { headers: { common: {} } }
    }))
  }
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    dismiss: vi.fn(),
    error: vi.fn()
  })
}))

const loadApiModule = async () => {
  vi.resetModules()
  axiosState.requestHandlers = []
  axiosState.responseSuccessHandlers = []
  axiosState.responseFailureHandlers = []
  return import('../services/api')
}

describe('api interceptor', () => {
  let storage

  beforeEach(() => {
    vi.clearAllMocks()
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
    window.location.assign.mockReset()
    Object.defineProperty(global.navigator, 'onLine', {
      configurable: true,
      value: true
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirige y limpia sesion en 401', async () => {
    const toast = (await import('react-hot-toast')).default
    await loadApiModule()

    const error = {
      response: { status: 401, data: { error: { message: 'Token expirado' } } },
      config: { url: '/api/pedidos' }
    }

    await expect(axiosState.responseFailureHandlers.at(-1)(error)).rejects.toBe(error)

    expect(localStorage.removeItem).not.toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('usuario')
    expect(localStorage.removeItem).toHaveBeenCalledWith('negocio')
    expect(window.location.assign).toHaveBeenCalledWith('/login')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('muestra toast cuando no es 401', async () => {
    const toast = (await import('react-hot-toast')).default
    await loadApiModule()
    const { getBackendStatusSnapshot, resetBackendStatusForTests } = await import('../services/backendStatus')
    resetBackendStatusForTests()

    const error = {
      response: { status: 500, data: { error: { message: 'Fallo' } } },
      config: { url: '/api/test' }
    }

    await expect(axiosState.responseFailureHandlers.at(-1)(error)).rejects.toBe(error)

    expect(toast.error).toHaveBeenCalledWith('Fallo', { id: 'api-err-Fallo' })
    expect(getBackendStatusSnapshot().apiAvailable).toBe(true)
  })

  it('omite toast cuando skipToast es true', async () => {
    const toast = (await import('react-hot-toast')).default
    await loadApiModule()

    const error = {
      response: { status: 400, data: { error: { message: 'Bad' } } },
      config: { url: '/api/test', skipToast: true }
    }

    await expect(axiosState.responseFailureHandlers.at(-1)(error)).rejects.toBe(error)

    expect(toast.error).not.toHaveBeenCalled()
  })

  it('marca backend no disponible y deduplica el toast en errores de red', async () => {
    const toast = (await import('react-hot-toast')).default
    await loadApiModule()
    const { getBackendStatusSnapshot, resetBackendStatusForTests } = await import('../services/backendStatus')
    resetBackendStatusForTests()

    const error = {
      code: 'ECONNREFUSED',
      message: 'Network Error',
      config: { url: '/api/test' }
    }

    await expect(axiosState.responseFailureHandlers.at(-1)(error)).rejects.toBe(error)

    expect(getBackendStatusSnapshot().apiAvailable).toBe(false)
    expect(toast.error).toHaveBeenCalledWith(
      'Backend no disponible. Reintentando automaticamente.',
      { id: 'backend-unavailable' }
    )
  })

  it('restaura el estado del backend al recibir una respuesta exitosa', async () => {
    const toast = (await import('react-hot-toast')).default
    await loadApiModule()
    const { getBackendStatusSnapshot, resetBackendStatusForTests } = await import('../services/backendStatus')
    resetBackendStatusForTests()

    const error = {
      code: 'ECONNREFUSED',
      message: 'Network Error',
      config: { url: '/api/test' }
    }

    await expect(axiosState.responseFailureHandlers.at(-1)(error)).rejects.toBe(error)

    const response = { data: { ok: true } }

    expect(axiosState.responseSuccessHandlers.at(-1)(response)).toBe(response)
    expect(getBackendStatusSnapshot().apiAvailable).toBe(true)
    expect(toast.dismiss).toHaveBeenCalledWith('backend-unavailable')
  })

  it('adjunta Idempotency-Key a mutaciones encolables y la conserva al encolarse offline', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('queue-item-id-1')
        .mockReturnValue('request-idempotency-key'),
    })

    Object.defineProperty(global.navigator, 'onLine', {
      configurable: true,
      value: false
    })

    await loadApiModule()
    const { getQueue } = await import('../utils/offline-queue')

    const requestConfig = {
      method: 'post',
      url: '/pedidos',
      data: { tipo: 'MESA' },
      headers: {},
    }

    const queuedError = axiosState.requestHandlers.at(-1).success(requestConfig)

    await expect(queuedError).rejects.toMatchObject({ __queued: true })
    expect(requestConfig.headers['Idempotency-Key']).toBe('queue-item-id-1')

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].idempotencyKey).toBe('queue-item-id-1')
    expect(queue[0].data).toEqual({ tipo: 'MESA' })
  })

  it('marca no-store en lecturas de mesas', async () => {
    await loadApiModule()

    const requestConfig = {
      method: 'get',
      url: '/mesas?activa=true',
      headers: {},
    }

    const result = axiosState.requestHandlers.at(-1).success(requestConfig)

    expect(result.headers['Cache-Control']).toBe('no-store')
    expect(result.headers.Pragma).toBe('no-cache')
  })
})
