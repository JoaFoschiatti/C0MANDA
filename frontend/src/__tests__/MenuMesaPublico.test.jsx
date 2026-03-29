import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import MenuMesaPublico from '../pages/MenuMesaPublico'

const mesaContext = {
  mesa: {
    id: 1,
    numero: 8,
    zona: 'Salon',
    capacidad: 4,
    estado: 'LIBRE'
  },
  mesaSession: {
    token: 'mesa-session-123',
    expiresAt: '2030-01-01T10:00:00.000Z'
  },
  negocio: {
    nombre: 'La Casa'
  },
  config: {
    nombre_negocio: 'La Casa'
  },
  categorias: [
    {
      id: 1,
      nombre: 'Pizzas',
      productos: [
        {
          id: 10,
          nombre: 'Muzzarella',
          descripcion: 'Clasica',
          precio: '1200',
          variantes: []
        }
      ]
    }
  ]
}

const renderMesa = (initialEntry = '/menu/mesa/token-qr') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/menu/mesa/:qrToken" element={<MenuMesaPublico />} />
    </Routes>
  </MemoryRouter>
)

describe('MenuMesaPublico page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('envia el sessionToken efimero al crear el pedido de mesa', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => mesaContext })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pedido: { id: 123 },
          mesa: mesaContext.mesa
        })
      })

    const user = userEvent.setup()
    renderMesa()

    expect(await screen.findByText('Muzzarella')).toBeInTheDocument()

    const addButtons = screen.getAllByRole('button', { name: /Agregar/i })
    await user.click(addButtons[0])
    await user.type(screen.getAllByLabelText('Nombre')[0], 'Cliente Mesa')
    await user.click(screen.getAllByRole('button', { name: /Enviar a mesa/i })[0])

    expect(fetch).toHaveBeenCalledWith(
      '/api/publico/mesa/token-qr/pedido',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"sessionToken":"mesa-session-123"')
      })
    )
  })
})
