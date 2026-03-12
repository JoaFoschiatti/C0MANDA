import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Pedidos from '../pages/admin/Pedidos'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { createEventSource } from '../services/eventos'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('react-hot-toast', () => {
  const toastFn = vi.fn()
  toastFn.success = vi.fn()
  toastFn.error = vi.fn()
  return { default: toastFn }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('../components/pedidos/NuevoPedidoModal', () => ({
  default: () => null
}))

const buildPedidosUrl = ({ estado = '', limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams()

  if (estado) params.set('estado', estado)
  if (estado === 'CERRADO' || estado === 'CANCELADO') params.set('incluirCerrados', 'true')

  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return `/pedidos?${params.toString()}`
}

const createMockEventSource = () => {
  const listeners = new Map()

  return {
    addEventListener: vi.fn((eventName, handler) => {
      listeners.set(eventName, handler)
    }),
    removeEventListener: vi.fn((eventName, handler) => {
      if (listeners.get(eventName) === handler) {
        listeners.delete(eventName)
      }
    }),
    close: vi.fn(),
    emit(eventName, payload) {
      listeners.get(eventName)?.({ data: JSON.stringify(payload) })
    }
  }
}

const createDeferred = () => {
  let resolve
  const promise = new Promise((resolver) => {
    resolve = resolver
  })

  return { promise, resolve }
}

describe('Pedidos page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ usuario: { rol: 'ADMIN' } })
    createEventSource.mockReturnValue(null)
  })

  const renderPage = (initialEntries = ['/pedidos']) => render(
    <MemoryRouter initialEntries={initialEntries}>
      <Pedidos />
    </MemoryRouter>
  )

  it('carga pedidos y aplica filtro por estado', async () => {
    const pedido = {
      id: 1,
      tipo: 'MOSTRADOR',
      total: '100',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    api.get
      .mockResolvedValueOnce({ data: { data: [pedido], total: 1 } })
      .mockResolvedValueOnce({ data: { data: [pedido], total: 1 } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#1')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ estado: 'PENDIENTE' }))
    })
  })

  it('abre detalle y registra pago', async () => {
    const pedido = {
      id: 9,
      tipo: 'MESA',
      total: '200',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 3 },
      clienteNombre: null,
      usuario: { nombre: 'Ana' },
      pagos: []
    }
    const pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '200',
          producto: { nombre: 'Pizza' }
        }
      ]
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValueOnce({ data: { pago: { id: 1 }, pedido: { ...pedidoDetalle, estado: 'COBRADO' } } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#9')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Ver detalle del pedido #${pedido.id}` }))
    expect(await screen.findByText(`Pedido #${pedido.id}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })
    await user.click(screen.getByRole('button', { name: 'Registrar Pago' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos', {
        pedidoId: pedido.id,
        monto: 200,
        metodo: 'EFECTIVO',
        referencia: null,
        canalCobro: 'CAJA',
        propinaMonto: 0,
        propinaMetodo: null,
        montoAbonado: null
      })
    })

    expect(toast.success).toHaveBeenCalledWith('Pago registrado')
  })

  it('genera un QR presencial para cobrar el saldo pendiente', async () => {
    const pedido = {
      id: 15,
      tipo: 'MESA',
      total: '500',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 7 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    let pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '500',
          producto: { nombre: 'Milanesa' }
        }
      ],
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })

    api.post.mockImplementation((url) => {
      if (url === '/pagos/qr/orden') {
        pedidoDetalle = {
          ...pedidoDetalle,
          pagos: [
            {
              id: 99,
              pedidoId: pedido.id,
              monto: '500',
              propinaMonto: '60',
              metodo: 'MERCADOPAGO',
              propinaMetodo: 'MERCADOPAGO',
              canalCobro: 'QR_PRESENCIAL',
              estado: 'PENDIENTE',
              referencia: 'ORD-123',
              comprobante: '0002010102125204000053030325405500.005802AR5910COMANDA6008CABA6304ABCD',
              createdAt: new Date().toISOString()
            }
          ]
        }

        return Promise.resolve({
          data: {
            orderId: 'ORD-123',
            status: 'created',
            qrData: '0002010102125204000053030325405500.005802AR5910COMANDA6008CABA6304ABCD',
            totalAmount: 560,
            pendiente: 500,
            propinaMonto: 60
          }
        })
      }

      return Promise.resolve({ data: {} })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#15')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })

    await user.selectOptions(screen.getByLabelText('Canal de Cobro'), 'QR_PRESENCIAL')
    await user.type(screen.getByLabelText('Propina ($)'), '60')
    await user.click(screen.getByRole('button', { name: 'Generar QR presencial' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos/qr/orden', {
        pedidoId: pedido.id,
        propinaMonto: 60,
        propinaMetodo: 'MERCADOPAGO'
      })
    })

    expect(await screen.findByText('QR presencial listo')).toBeInTheDocument()
    expect(screen.getByText('Orden ORD-123')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('QR presencial generado')
  })

  it('abre el pago desde el deep link de pedido', async () => {
    const pedido = {
      id: 31,
      tipo: 'MESA',
      total: '320',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 4 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) {
        return Promise.resolve({
          data: {
            ...pedido,
            items: [],
            pagos: []
          }
        })
      }

      return Promise.resolve({ data: [] })
    })

    renderPage([`/pedidos?pedidoId=${pedido.id}&openPago=1`])

    expect(await screen.findByRole('heading', { name: 'Registrar Pago' })).toBeInTheDocument()

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/pedidos/${pedido.id}`)
    })
  })

  it('mantiene el filtro activo cuando llega una actualizacion SSE de un pedido que ya no califica', async () => {
    const source = createMockEventSource()
    createEventSource.mockReturnValue(source)
    let pendingFilterCalls = 0

    const pedidoPendiente = {
      id: 44,
      tipo: 'MOSTRADOR',
      total: '180',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedidoPendiente], total: 1 } })
      if (url === buildPedidosUrl({ estado: 'PENDIENTE' })) {
        pendingFilterCalls += 1

        return Promise.resolve({
          data: pendingFilterCalls === 1
            ? { data: [pedidoPendiente], total: 1 }
            : { data: [], total: 0 }
        })
      }
      if (url === `/pedidos/${pedidoPendiente.id}`) {
        return Promise.resolve({
          data: {
            ...pedidoPendiente,
            estado: 'COBRADO',
            items: [],
            pagos: []
          }
        })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#44')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ estado: 'PENDIENTE' }))
    })

    source.emit('pedido.updated', {
      id: pedidoPendiente.id,
      estado: 'COBRADO',
      tipo: pedidoPendiente.tipo
    })

    await waitFor(() => {
      expect(screen.queryByText('#44')).not.toBeInTheDocument()
    })

    expect(screen.getByText('No hay pedidos para mostrar')).toBeInTheDocument()
  })

  it('evita multiples cargas concurrentes al usar "Cargar mas"', async () => {
    const primerPedido = {
      id: 71,
      tipo: 'MOSTRADOR',
      total: '100',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    const segundoPedido = {
      ...primerPedido,
      id: 72
    }

    const deferred = createDeferred()

    api.get
      .mockResolvedValueOnce({ data: { data: [primerPedido], total: 60 } })
      .mockImplementationOnce(() => deferred.promise)

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#71')).toBeInTheDocument()

    const loadMoreButton = screen.getByRole('button', { name: /Cargar mas/i })
    await user.click(loadMoreButton)
    await user.click(loadMoreButton)

    expect(
      api.get.mock.calls.filter(([url]) => url === buildPedidosUrl({ limit: 100, offset: 0 }))
    ).toHaveLength(1)

    deferred.resolve({ data: { data: [primerPedido, segundoPedido], total: 60 } })

    expect(await screen.findByText('#72')).toBeInTheDocument()
  })
})
