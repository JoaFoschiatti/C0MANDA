import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Dashboard from '../pages/admin/Dashboard'
import api from '../services/api'
import { createEventSource } from '../services/eventos'
import { useAuth } from '../context/AuthContext'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEventSource.mockReturnValue(null)
    useAuth.mockReturnValue({
      usuario: { rol: 'ADMIN' },
      esAdmin: true,
      esCajero: false,
      esMozo: false,
      esCocinero: false
    })
  })

  it('carga dashboard y muestra estadisticas', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ventasHoy: 100,
        pedidosHoy: 2,
        pedidosPendientes: 1,
        mesasOcupadas: 2,
        mesasTotal: 5,
        alertasStock: 3,
        lotesVencidosPendientes: 2,
        empleadosTrabajando: 4,
        tareasPendientes: 5,
        tareasCaja: 2,
        tareasStock: 3,
        tareasAltaPrioridad: 2
      }
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('Descartes Pendientes')).toBeInTheDocument()
    expect(screen.getByText('Tareas Operativas')).toBeInTheDocument()
    expect(screen.getByText('Hay 2 tareas operativas de alta prioridad pendientes.')).toBeInTheDocument()
    expect(screen.getByText('Hay 2 lotes vencidos pendientes de descarte manual.')).toBeInTheDocument()

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/reportes/dashboard', expect.objectContaining({ skipToast: true }))
    })
  })

  it('muestra error y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        data: {
          ventasHoy: 50,
          pedidosHoy: 1,
          pedidosPendientes: 0,
          mesasOcupadas: 1,
        mesasTotal: 4,
        alertasStock: 0,
        lotesVencidosPendientes: 0,
        empleadosTrabajando: 2,
        tareasPendientes: 0,
        tareasCaja: 0,
        tareasStock: 0,
        tareasAltaPrioridad: 0
      }
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText('Error al cargar dashboard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('$50')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('oculta el resumen de tareas para cocinero', async () => {
    useAuth.mockReturnValue({
      usuario: { rol: 'COCINERO' },
      esAdmin: false,
      esCajero: false,
      esMozo: false,
      esCocinero: true
    })
    api.get.mockResolvedValueOnce({
      data: {
        ventasHoy: 70,
        pedidosHoy: 3,
        pedidosPendientes: 1,
        mesasOcupadas: 2,
        mesasTotal: 5,
        alertasStock: 1,
        lotesVencidosPendientes: 0,
        empleadosTrabajando: 1,
        tareasPendientes: 4,
        tareasCaja: 2,
        tareasStock: 2,
        tareasAltaPrioridad: 1
      }
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText('$70')).toBeInTheDocument()
    expect(screen.queryByText('Tareas Operativas')).toBeNull()
    expect(screen.queryByText('Hay 1 tareas operativas de alta prioridad pendientes.')).toBeNull()
    expect(screen.queryByRole('link', { name: /Reportes/i })).toBeNull()
    expect(screen.getByRole('link', { name: /Cocina/i })).toHaveAttribute('href', '/cocina')
  })
})
