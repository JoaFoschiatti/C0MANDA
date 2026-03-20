import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import MenuPublico from '../pages/MenuPublico'

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

const menuData = [
  {
    id: 1,
    nombre: 'Pizzas',
    productos: [
      {
        id: 10,
        nombre: 'Muzzarella',
        descripcion: 'Pizza clasica',
        precio: '1200'
      }
    ]
  }
]

const renderMenu = (initialEntry = '/menu') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/menu" element={<MenuPublico />} />
      </Routes>
    </MemoryRouter>
  )
}

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

  it('muestra alerta cuando vuelve de MercadoPago con error', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    renderMenu('/menu?pago=error&pedido=123')

    expect(await screen.findByText(/El pago no pudo ser procesado/i)).toBeInTheDocument()
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
