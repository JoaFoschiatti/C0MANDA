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

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('../components/pedidos/NuevoPedidoModal', () => ({
  default: () => null
}))

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
      .mockResolvedValueOnce({ data: [pedido] })
      .mockResolvedValueOnce({ data: [pedido] })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#1')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/pedidos?estado=PENDIENTE')
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
      if (url === '/pedidos') return Promise.resolve({ data: [pedido] })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

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
      if (url === '/pedidos') return Promise.resolve({ data: [pedido] })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })

    api.post.mockImplementation((url, payload) => {
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
      if (url === '/pedidos') return Promise.resolve({ data: [pedido] })
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
})
