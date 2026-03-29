import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../utils/external-links', () => ({
  navigateExternalUrl: vi.fn(() => true),
  openExternalUrl: vi.fn(() => true),
  buildWhatsAppUrl: vi.fn(() => 'https://wa.me/test')
}))

import MenuPublico from '../pages/MenuPublico'
import { navigateExternalUrl } from '../utils/external-links'

const API_URL = '/api'

const configData = {
  negocio: {
    nombre_negocio: 'La Casa'
  },
  config: {
    tienda_abierta: true,
    delivery_habilitado: true,
    costo_delivery: 400,
    mercadopago_enabled: true,
    efectivo_enabled: true
  }
}

const configWithoutPayments = {
  negocio: {
    nombre_negocio: 'La Casa'
  },
  config: {
    tienda_abierta: true,
    delivery_habilitado: true,
    costo_delivery: 400,
    mercadopago_enabled: false,
    efectivo_enabled: false,
    whatsapp_numero: '5493410000000'
  }
}

const menuData = [
  {
    id: 1,
    nombre: 'Pizzas',
    productos: [
      {
        id: 10,
        nombre: 'Muzzarella',
        descripcion: 'Pizza clasica',
        precio: '1200',
        variantes: []
      }
    ]
  }
]

const renderMenu = (initialEntry = '/menu') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/menu" element={<MenuPublico />} />
    </Routes>
  </MemoryRouter>
)

describe('MenuPublico page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    localStorage.getItem.mockReturnValue(null)
  })

  it('carga el menu y muestra productos', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    renderMenu()

    expect(await screen.findByText('La Casa')).toBeInTheDocument()
    expect(screen.getByText('Pizzas')).toBeInTheDocument()
    expect(screen.getByText('Muzzarella')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/publico/config`, {})
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/publico/menu`, {})
  })

  it('muestra error de carga y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Error al cargar configuracion' } })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    const user = userEvent.setup()
    renderMenu()

    expect(await screen.findByText(/Error al cargar configuracion/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('Muzzarella')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('muestra estado reanudable cuando Mercado Pago vuelve con error y no verifica automaticamente', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    renderMenu('/menu?pago=error&pedido=123&token=abc-token')

    expect(await screen.findByText(/El pago no fue aprobado/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith('/api/publico/pedido/123?token=abc-token', {})
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mp_pedido_pendiente',
      expect.stringContaining('"accessToken":"abc-token"')
    )
  })

  it('preserva el pedido pendiente si falla abrir Mercado Pago', async () => {
    navigateExternalUrl.mockReturnValue(false)

    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pedido: { id: 123, total: 1600 },
          total: 1600,
          initPoint: 'https://mercadopago.test/init',
          accessToken: 'abc-token'
        })
      })

    const user = userEvent.setup()
    renderMenu()

    expect(await screen.findByText('Muzzarella')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Agregar/i }))
    await user.click(screen.getByRole('button', { name: /Continuar pedido/i }))
    await user.type(screen.getByLabelText('Nombre'), 'Cliente Test')
    await user.type(screen.getByLabelText('Telefono'), '3410000000')
    await user.type(screen.getByLabelText('Email'), 'cliente@test.com')
    await user.type(screen.getByLabelText('Direccion'), 'Calle 123')
    await user.click(screen.getByRole('button', { name: /Mercado Pago/i }))
    await user.click(screen.getByRole('button', { name: /Ir a Mercado Pago/i }))

    expect(await screen.findByText(/No pudimos abrir Mercado Pago/i)).toBeInTheDocument()
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mp_pedido_pendiente',
      expect.stringContaining('"accessToken":"abc-token"')
    )
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('mp_pedido_pendiente')
  })

  it('oculta la confirmacion del checkout cuando no hay medios de pago habilitados', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configWithoutPayments })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    const user = userEvent.setup()
    renderMenu()

    expect(await screen.findByText('Muzzarella')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Agregar/i }))
    await user.click(screen.getByRole('button', { name: /Continuar pedido/i }))

    expect(await screen.findByText(/no tiene medios de pago habilitados/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Confirmar pedido/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ir a Mercado Pago/i })).not.toBeInTheDocument()
  })

  it('persiste y usa accessToken al volver de MercadoPago', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          estadoPago: 'APROBADO',
          total: 1200,
          accessToken: 'abc-token'
        })
      })

    renderMenu('/menu?pago=exito&pedido=123&token=abc-token')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/publico/pedido/123?token=abc-token', {})
    })

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mp_pedido_pendiente',
      expect.stringContaining('"accessToken":"abc-token"')
    )
  })
})
