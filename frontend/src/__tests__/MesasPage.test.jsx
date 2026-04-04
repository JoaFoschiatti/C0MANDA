import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Mesas from '../pages/admin/Mesas'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() },
    },
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('Mesas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ usuario: { rol: 'ADMIN' } })
  })

  const renderPage = (initialEntries = ['/mesas']) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Mesas />
      </MemoryRouter>
    )

  it('crea una mesa desde el modal', async () => {
    let mesasCallCount = 0
    api.get.mockImplementation(async (url) => {
      if (url === '/reservas/proximas') {
        return { data: [] }
      }

      if (url === '/mesas') {
        mesasCallCount += 1
        if (mesasCallCount === 1) {
          return { data: [] }
        }

        return {
          data: [
            { id: 1, numero: 1, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true },
          ],
        }
      }

      return { data: [] }
    })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Nueva Mesa/i }))

    await user.type(screen.getByLabelText('Numero de Mesa'), '1')
    await user.clear(screen.getByLabelText('Capacidad'))
    await user.type(screen.getByLabelText('Capacidad'), '4')

    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/mesas',
        expect.objectContaining({ numero: 1, capacidad: 4, zona: 'Interior' }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Mesa creada')
  })

  it('desactiva una mesa desde la tarjeta', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/mesas') {
        return {
          data: [
            { id: 2, numero: 2, zona: 'Interior', capacidad: 4, estado: 'OCUPADA', activa: true, pedidos: [{ id: 91 }] },
          ],
        }
      }

      return { data: [] }
    })
    api.delete.mockResolvedValueOnce({ data: { id: 2 } })

    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    const user = userEvent.setup()
    renderPage(['/mesas?mesaId=2'])

    await user.click(await screen.findByRole('button', { name: /Desactivar mesa 2/i }))

    await screen.findByText('Desactivar mesa')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/La mesa 2 dejara de mostrarse en operacion y en el plano\./i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(api.delete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Desactivar mesa 2/i }))
    await screen.findByText('Desactivar mesa')
    const confirmDialog = screen.getByRole('dialog')
    await user.click(within(confirmDialog).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/mesas/2',
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Mesa desactivada')
    confirmSpy.mockRestore()
  })

  it('libera una mesa cerrada desde la tarjeta', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/mesas') {
        return {
          data: [
            { id: 6, numero: 6, zona: 'Barra', capacidad: 2, estado: 'CERRADA', activa: true, pedidos: [{ id: 101 }] },
          ],
        }
      }

      return { data: [] }
    })
    api.post.mockResolvedValueOnce({ data: { mesa: { id: 6, estado: 'LIBRE' } } })

    const user = userEvent.setup()
    const { container } = renderPage()

    const mesaCerrada = await screen.findByText('6')
    expect(mesaCerrada).toBeInTheDocument()

    fireEvent.focus(container.querySelector('#mesa-card-6 .mesa-status-card-hitarea'))
    const liberarButton = await screen.findByRole('button', { name: /Liberar mesa 6/i })
    expect(liberarButton).toHaveAttribute('title', 'Liberar mesa')

    await user.click(liberarButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/mesas/6/liberar',
        {},
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Mesa 6 liberada')
  })

  it('destaca la mesa enfocada desde query param', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/mesas') {
        return {
          data: [
            { id: 8, numero: 8, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true },
          ],
        }
      }

      return { data: [] }
    })

    renderPage(['/mesas?mesaId=8'])

    const mesaCard = await screen.findByText('8')
    expect(mesaCard.closest('#mesa-card-8')).toBeInTheDocument()
  })

  it('aplica temas visuales por estado en operacion y mantiene acciones clave', async () => {
    const user = userEvent.setup()

    api.get.mockImplementation(async (url) => {
      if (url === '/mesas') {
        return {
          data: [
            { id: 1, numero: 1, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true },
            { id: 2, numero: 2, zona: 'Interior', capacidad: 4, estado: 'OCUPADA', activa: true, pedidos: [{ id: 42 }] },
            { id: 3, numero: 3, zona: 'Interior', capacidad: 4, estado: 'RESERVADA', activa: true },
            { id: 4, numero: 4, zona: 'Interior', capacidad: 4, estado: 'ESPERANDO_CUENTA', activa: true, pedidos: [{ id: 50 }], grupoMesaId: 77 },
            { id: 5, numero: 5, zona: 'Interior', capacidad: 4, estado: 'CERRADA', activa: true, pedidos: [{ id: 60 }] },
          ],
        }
      }

      if (url === '/reservas/proximas') {
        return {
          data: [{ id: 90, mesaId: 1, fechaHora: new Date().toISOString(), clienteNombre: 'Ana' }],
        }
      }

      return { data: [] }
    })

    const { container } = renderPage()

    expect(await screen.findByText('Interior')).toBeInTheDocument()
    expect(screen.getByText('Pedido #42')).toBeInTheDocument()
    expect(screen.getByText('Pedido #50')).toBeInTheDocument()
    expect(screen.getByText('Pedido #60')).toBeInTheDocument()
    expect(screen.getByText(/Reserva \d/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desactivar mesa 2/i })).not.toBeInTheDocument()

    const mesaOcupada = container.querySelector('#mesa-card-2')
    const mesaAgrupada = container.querySelector('#mesa-card-4')
    expect(mesaOcupada).toBeInTheDocument()
    expect(mesaAgrupada).toBeInTheDocument()

    await user.hover(mesaOcupada)
    expect(screen.getByRole('button', { name: /Desactivar mesa 2/i })).toHaveAttribute('title', 'Desactivar')
    expect(screen.getByRole('button', { name: /Editar mesa 2/i })).toHaveAttribute('title', 'Editar')
    expect(screen.getByRole('button', { name: /Seleccionar mesa 2 para agrupar/i })).toHaveAttribute('title', 'Seleccionar para agrupar')
    expect(screen.getByRole('button', { name: /Solicitar cuenta de la mesa 2/i })).toHaveAttribute('title', 'Solicitar cuenta')
    expect(container.querySelector('#mesa-card-2 .mesa-status-card-overlay')).toBeInTheDocument()

    await user.unhover(mesaOcupada)
    expect(screen.queryByRole('button', { name: /Desactivar mesa 2/i })).not.toBeInTheDocument()

    fireEvent.focus(mesaAgrupada.querySelector('.mesa-status-card-hitarea'))
    expect(await screen.findByRole('button', { name: /Editar mesa 4/i })).toHaveAttribute('title', 'Editar')
    expect(screen.getByRole('button', { name: /Seleccionar mesa 4 para agrupar/i })).toHaveAttribute('title', 'Seleccionar para agrupar')
    expect(screen.getByRole('button', { name: /Desagrupar mesa 4/i })).toHaveAttribute('title', 'Desagrupar')

    const mesaCerrada = container.querySelector('#mesa-card-5')
    await user.hover(mesaCerrada)
    expect(await screen.findByRole('button', { name: /Liberar mesa 5/i })).toHaveAttribute('title', 'Liberar mesa')
    await user.unhover(mesaCerrada)

    await user.click(screen.getByRole('button', { name: /Mesa 5.*Cerrada/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/pedidos?mesaId=5')

    expect(container.querySelector('#mesa-card-1')).toHaveClass('mesa-status-theme--libre')
    expect(container.querySelector('#mesa-card-2')).toHaveClass('mesa-status-theme--ocupada')
    expect(container.querySelector('#mesa-card-3')).toHaveClass('mesa-status-theme--reservada')
    expect(container.querySelector('#mesa-card-4')).toHaveClass('mesa-status-theme--esperando')
    expect(container.querySelector('#mesa-card-5')).toHaveClass('mesa-status-theme--cerrada')
  })
})
