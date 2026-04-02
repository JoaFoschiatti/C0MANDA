import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import NuevoPedido from '../pages/mozo/NuevoPedido'
import api from '../services/api'
import toast from 'react-hot-toast'

const mockNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams()
  }
})

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
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

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  })

  window.dispatchEvent(new Event('resize'))
}

describe('NuevoPedido (mozo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(1280)
    mockUseParams.mockReturnValue({ mesaId: '5' })
  })

  it('sin mesa preseleccionada muestra Mesa y Mostrador, oculta Delivery y crea un pedido de mesa', async () => {
    mockUseParams.mockReturnValue({})

    const categorias = [
      {
        id: 1,
        nombre: 'Comidas',
        productos: [
          {
            id: 21,
            nombre: 'Hamburguesa',
            precio: 3200,
            descripcion: 'Doble carne',
            disponible: true
          }
        ]
      }
    ]
    const mesas = [
      { id: 7, numero: 7, zona: 'Interior', estado: 'LIBRE', activa: true }
    ]

    api.get.mockImplementation((url) => {
      if (url === '/categorias/publicas') return Promise.resolve({ data: categorias })
      if (url === '/mesas') return Promise.resolve({ data: mesas })
      if (url === '/modificadores/producto/21') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    api.post.mockResolvedValueOnce({ data: { id: 77 } })

    const user = userEvent.setup()
    render(<NuevoPedido />)

    expect(await screen.findByText('Hamburguesa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Mesa$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Mostrador$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delivery$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Mesa/i })).toBeInTheDocument()
    expect(screen.getByText('Crea pedidos de mesa o mostrador desde una sola pantalla.')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: /Mesa/i }), '7')
    await user.click(screen.getByRole('button', { name: /Hamburguesa/i }))
    await user.click(screen.getByRole('button', { name: /Confirmar pedido/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({
          tipo: 'MESA',
          mesaId: 7,
          items: [expect.objectContaining({ productoId: 21, cantidad: 1 })]
        }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith('/mozo/mesas')
    expect(api.get).toHaveBeenCalledWith('/mesas', expect.objectContaining({ skipToast: true }))
  })

  it('carga datos, agrega producto y confirma pedido', async () => {
    const categorias = [
      {
        id: 1,
        nombre: 'Comidas',
        productos: [
          {
            id: 20,
            nombre: 'Pizza',
            precio: 1500,
            descripcion: 'Muzzarella',
            disponible: true
          }
        ]
      }
    ]

    api.get.mockImplementation((url) => {
      if (url === '/categorias/publicas') return Promise.resolve({ data: categorias })
      if (url === '/mesas/5') return Promise.resolve({ data: { id: 5, numero: 5 } })
      if (url === '/modificadores/producto/20') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    api.post.mockResolvedValueOnce({ data: { id: 55 } })

    const user = userEvent.setup()
    render(<NuevoPedido />)

    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Buscar productos/i })).toHaveClass('input-with-icon')
    expect(screen.queryByRole('button', { name: /^Delivery$/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pizza/i }))

    await user.click(screen.getByRole('button', { name: /Confirmar Pedido/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({
          tipo: 'MESA',
          mesaId: 5,
          items: [expect.objectContaining({ productoId: 20, cantidad: 1 })]
        }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith(
      'Pedido #55 creado! Se imprimira al iniciar preparacion.'
    )
    expect(mockNavigate).toHaveBeenCalledWith('/mozo/mesas')
    expect(api.get).toHaveBeenCalledWith('/categorias/publicas', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/mesas/5', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/modificadores/producto/20', expect.objectContaining({ skipToast: true }))
  })

  it('mantiene visible el CTA flotante del pedido en mobile', async () => {
    setViewportWidth(390)
    mockUseParams.mockReturnValue({})

    const categorias = [
      {
        id: 1,
        nombre: 'Comidas',
        productos: [
          {
            id: 20,
            nombre: 'Pizza',
            precio: 1500,
            descripcion: 'Muzzarella',
            disponible: true
          }
        ]
      }
    ]

    api.get.mockImplementation((url) => {
      if (url === '/categorias/publicas') return Promise.resolve({ data: categorias })
      if (url === '/mesas') return Promise.resolve({ data: [{ id: 7, numero: 7, estado: 'LIBRE', activa: true }] })
      if (url === '/modificadores/producto/20') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    const user = userEvent.setup()
    render(<NuevoPedido />)

    expect(await screen.findByText('Pizza')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: /Mesa/i }), '7')
    await user.click(screen.getByRole('button', { name: /Pizza/i }))

    expect(screen.getByTestId('pedido-composer-cart-toggle')).toBeInTheDocument()
    await user.click(screen.getByTestId('pedido-composer-cart-toggle'))

    expect(await screen.findByRole('heading', { name: 'Pedido actual' })).toBeInTheDocument()
  })
})
