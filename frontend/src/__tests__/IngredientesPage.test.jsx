import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Ingredientes from '../pages/admin/Ingredientes'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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

describe('Ingredientes page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderPage = (initialEntries = ['/ingredientes']) => render(
    <MemoryRouter initialEntries={initialEntries}>
      <Ingredientes />
    </MemoryRouter>
  )

  it('marca en rojo los ingredientes con stock bajo', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          nombre: 'Harina',
          unidad: 'kg',
          stockActual: 1,
          stockMinimo: 2,
          costo: null,
          activo: true
        },
        {
          id: 2,
          nombre: 'Sal',
          unidad: 'kg',
          stockActual: 5,
          stockMinimo: 1,
          costo: 10,
          activo: true
        }
      ]
    })

    renderPage()

    const harinaRow = (await screen.findByText('Harina')).closest('tr')
    const salRow = screen.getByText('Sal').closest('tr')

    expect(harinaRow).toHaveClass('bg-error-50')
    expect(salRow).not.toHaveClass('bg-error-50')
  })

  it('envia datos de lote al registrar una entrada de stock', async () => {
    api.get
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Harina',
            unidad: 'kg',
            stockActual: 1,
            stockMinimo: 2,
            costo: 100,
            activo: true
          }
        ]
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    api.post.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Harina')
    await user.click(screen.getByRole('button', { name: 'Movimiento de stock: Harina' }))
    await user.type(screen.getByLabelText('Cantidad (kg)'), '5')
    await user.type(screen.getByLabelText('Codigo de lote'), 'LOTE-HAR-01')
    await user.type(screen.getByLabelText('Costo del lote ($)'), '150')
    await user.type(screen.getByLabelText('Motivo'), 'Compra proveedor')
    await user.type(screen.getByLabelText('Fecha de vencimiento'), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ingredientes/1/movimiento', {
        tipo: 'ENTRADA',
        cantidad: 5,
        motivo: 'Compra proveedor',
        codigoLote: 'LOTE-HAR-01',
        fechaVencimiento: '2026-12-31',
        costoUnitario: 150
      })
    })
  })

  it('muestra alertas de lotes vencidos en la grilla', async () => {
    api.get
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Queso',
            unidad: 'kg',
            stockActual: 4,
            stockMinimo: 1,
            costo: 120,
            activo: true
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Queso',
            unidad: 'kg',
            stockActual: 2,
            stockMinimo: 1,
            costo: 120,
            activo: true,
            stockNoConsumible: 2,
            tieneLotesVencidos: true,
            tieneLotesPorVencer: false,
            lotesAlerta: [
              {
                id: 11,
                codigoLote: 'LOT-QUESO-01',
                estadoLote: 'VENCIDO',
                fechaVencimiento: '2026-02-01T23:59:59.999Z'
              }
            ]
          }
        ]
      })

    renderPage()

    expect(await screen.findByText('LOT-QUESO-01 vencido')).toBeInTheDocument()
    expect(screen.getByText('Lotes vencidos')).toBeInTheDocument()
    expect(screen.getByText('No utilizable: 2.00 kg')).toBeInTheDocument()
  })

  it('permite descartar un lote vencido con motivo obligatorio', async () => {
    api.get
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Queso',
            unidad: 'kg',
            stockActual: 2,
            stockMinimo: 1,
            costo: 120,
            activo: true
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Queso',
            unidad: 'kg',
            stockActual: 0,
            stockMinimo: 1,
            costo: 120,
            activo: true,
            stockNoConsumible: 2,
            tieneLotesVencidos: true,
            tieneLotesPorVencer: false,
            lotes: [
              {
                id: 11,
                codigoLote: 'LOT-QUESO-01',
                stockActual: 2,
                estadoLote: 'VENCIDO',
                fechaVencimiento: '2026-02-01T23:59:59.999Z'
              }
            ],
            lotesAlerta: [
              {
                id: 11,
                codigoLote: 'LOT-QUESO-01',
                stockActual: 2,
                estadoLote: 'VENCIDO',
                fechaVencimiento: '2026-02-01T23:59:59.999Z'
              }
            ]
          }
        ]
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    api.post.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Queso')
    await user.click(screen.getByRole('button', { name: 'Descartar lotes vencidos: Queso' }))
    await user.clear(screen.getByLabelText('Cantidad a descartar (kg)'))
    await user.type(screen.getByLabelText('Cantidad a descartar (kg)'), '1.5')
    await user.type(screen.getByLabelText('Motivo del descarte'), 'Vencimiento detectado en control diario')
    await user.click(screen.getByRole('button', { name: 'Confirmar descarte' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ingredientes/lotes/11/descartar', {
        cantidad: 1.5,
        motivo: 'Vencimiento detectado en control diario'
      })
    })
  })

  it('abre el descarte desde deep link de lote vencido', async () => {
    api.get
      .mockResolvedValueOnce({
        data: [
          {
            id: 7,
            nombre: 'Muzzarella',
            unidad: 'kg',
            stockActual: 0,
            stockMinimo: 1,
            costo: 120,
            activo: true
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 7,
            nombre: 'Muzzarella',
            unidad: 'kg',
            stockActual: 0,
            stockMinimo: 1,
            costo: 120,
            activo: true,
            stockNoConsumible: 2,
            tieneLotesVencidos: true,
            tieneLotesPorVencer: false,
            lotes: [
              {
                id: 71,
                codigoLote: 'LOT-MUZZA-01',
                stockActual: 2,
                estadoLote: 'VENCIDO',
                fechaVencimiento: '2026-02-01T23:59:59.999Z'
              }
            ],
            lotesAlerta: [
              {
                id: 71,
                codigoLote: 'LOT-MUZZA-01',
                stockActual: 2,
                estadoLote: 'VENCIDO',
                fechaVencimiento: '2026-02-01T23:59:59.999Z'
              }
            ]
          }
        ]
      })

    renderPage(['/ingredientes?ingredienteId=7&loteId=71&action=descartar'])

    expect(await screen.findByText('Descartar lote vencido: Muzzarella')).toBeInTheDocument()
    expect(screen.getByDisplayValue('LOT-MUZZA-01 - 2.00 kg')).toBeInTheDocument()
  })
})
