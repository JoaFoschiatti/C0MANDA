import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Tareas from '../pages/admin/Tareas'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { createEventSource } from '../services/eventos'
import toast from 'react-hot-toast'

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

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const baseResponse = {
  actualizadoEn: new Date().toISOString(),
  resumen: {
    total: 4,
    altaPrioridad: 2,
    caja: 2,
    stock: 2,
    mesasEsperandoCuenta: 0,
    qrPendientes: 0,
    pedidosPorCerrar: 1,
    mesasPorLiberar: 1,
    stockBajo: 1,
    lotesPorVencer: 0,
    lotesVencidosPendientes: 1
  },
  caja: [
    {
      id: 'caja:pedido-cobrado-pendiente-cierre:9',
      categoria: 'CAJA',
      tipo: 'PEDIDO_COBRADO_PENDIENTE_CIERRE',
      prioridad: 'ALTA',
      fechaReferencia: '2026-03-06T12:00:00.000Z',
      titulo: 'Pedido #9 pendiente de cierre',
      descripcion: 'Pedido #9 ya esta cobrado en mesa 4 y debe cerrarse.',
      entidad: { pedidoId: 9, mesaId: 4 }
    },
    {
      id: 'caja:mesa-cerrada-pendiente-liberacion:4',
      categoria: 'CAJA',
      tipo: 'MESA_CERRADA_PENDIENTE_LIBERACION',
      prioridad: 'MEDIA',
      fechaReferencia: '2026-03-06T12:05:00.000Z',
      titulo: 'Mesa 4 pendiente de liberacion',
      descripcion: 'Mesa 4 ya cerro el pedido #9 y espera liberacion.',
      entidad: { mesaId: 4, pedidoId: 9 }
    }
  ],
  stock: [
    {
      id: 'stock:ingrediente-stock-bajo:7',
      categoria: 'STOCK',
      tipo: 'INGREDIENTE_STOCK_BAJO',
      prioridad: 'MEDIA',
      fechaReferencia: '2026-03-06T12:10:00.000Z',
      titulo: 'Stock bajo de Queso',
      descripcion: 'Queso quedo en 1.00 kg sobre un minimo de 3.00 kg.',
      entidad: { ingredienteId: 7 }
    },
    {
      id: 'stock:lote-vencido:11',
      categoria: 'STOCK',
      tipo: 'LOTE_VENCIDO_PENDIENTE_DESCARTE',
      prioridad: 'ALTA',
      fechaReferencia: '2026-03-05T23:59:59.999Z',
      titulo: 'Lote LOT-QUESO-01 vencido',
      descripcion: 'El lote LOT-QUESO-01 de Queso vencio y mantiene stock.',
      entidad: { ingredienteId: 7, loteId: 11 }
    }
  ]
}

describe('Tareas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEventSource.mockReturnValue(null)
    api.get.mockResolvedValue({ data: baseResponse })
    api.post.mockResolvedValue({ data: {} })
  })

  const renderPage = () => render(
    <MemoryRouter>
      <Tareas />
    </MemoryRouter>
  )

  it('carga resumen y permite resolver tareas directas de caja', async () => {
    useAuth.mockReturnValue({ esAdmin: true })
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('Tareas')).toBeInTheDocument()
    expect(screen.getByText('Pedido #9 pendiente de cierre')).toBeInTheDocument()
    expect(screen.getByText('Mesa 4 pendiente de liberacion')).toBeInTheDocument()
    expect(screen.getByText('Stock bajo de Queso')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar pedido' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pedidos/9/cerrar', {})
    })
    expect(toast.success).toHaveBeenCalledWith('Pedido #9 cerrado')

    await user.click(screen.getByRole('button', { name: 'Liberar mesa' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/mesas/4/liberar', {})
    })
    expect(toast.success).toHaveBeenCalledWith('Mesa 4 liberada')
  })

  it('muestra stock en modo solo lectura para cajero', async () => {
    useAuth.mockReturnValue({ esAdmin: false })

    renderPage()

    expect(await screen.findByText('Lote LOT-QUESO-01 vencido')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Requiere ADMIN' }).length).toBeGreaterThan(0)
  })
})
