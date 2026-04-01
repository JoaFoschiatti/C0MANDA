import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CierreCaja from '../pages/admin/CierreCaja'
import api from '../services/api'
import toast from 'react-hot-toast'

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

describe('CierreCaja page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('abre caja desde el modal', async () => {
    api.get
      .mockResolvedValueOnce({ data: { cajaAbierta: false } }) // /cierres/actual
      .mockResolvedValueOnce({ data: [] }) // /cierres?limit=10
      .mockResolvedValueOnce({
        data: {
          cajaAbierta: true,
          caja: {
            id: 1,
            fondoInicial: 100,
            ventasActuales: { efectivo: 0, mercadopago: 0 },
            usuario: { nombre: 'Admin' },
            horaApertura: new Date().toISOString()
          }
        }
      }) // /cierres/actual (after open)
      .mockResolvedValueOnce({ data: [] }) // /cierres?limit=10 (after open)

    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<CierreCaja />)

    await user.click(await screen.findByRole('button', { name: /Abrir Caja/i }))

    expect(screen.getByLabelText(/Fondo Inicial \(efectivo en caja\)/i)).toHaveAttribute('placeholder', '0')

    await user.type(
      screen.getByLabelText(/Fondo Inicial \(efectivo en caja\)/i),
      '100'
    )

    const submitButton = screen
      .getAllByRole('button', { name: /^Abrir Caja$/i })
      .find(btn => btn.getAttribute('type') === 'submit')

    expect(submitButton).toBeTruthy()
    await user.click(submitButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/cierres',
        expect.objectContaining({ fondoInicial: 100 }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Caja abierta correctamente')
    expect(await screen.findByText(/Caja Abierta/i)).toBeInTheDocument()
    expect(screen.getByText('$ 100')).toBeInTheDocument()
    expect(screen.queryByText('$ 100,00')).not.toBeInTheDocument()
  })

  it('muestra montos enteros sin decimales y conserva centavos reales en cierre de caja', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          cajaAbierta: true,
          caja: {
            id: 4,
            fondoInicial: 100,
            ventasActuales: { efectivo: 2500, mercadopago: 3000 },
            usuario: { nombre: 'Admin' },
            horaApertura: new Date().toISOString()
          }
        }
      }) // /cierres/actual
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            horaApertura: new Date().toISOString(),
            usuario: { nombre: 'Admin' },
            fondoInicial: 200,
            totalEfectivo: 1500.5,
            totalMP: 3000,
            diferencia: 0.5,
            estado: 'CERRADO'
          }
        ]
      }) // /cierres?limit=10
      .mockResolvedValueOnce({
        data: {
          fondoInicial: 100,
          ventasEfectivo: 2500,
          ventasMercadoPago: 3000.5,
          totalVentas: 5500.5,
          efectivoEsperado: 2600
        }
      }) // /cierres/resumen

    const user = userEvent.setup()
    render(<CierreCaja />)

    expect(await screen.findByText(/Caja Abierta/i)).toBeInTheDocument()
    expect(screen.getByText('$ 100')).toBeInTheDocument()
    expect(screen.getByText('$ 2.500')).toBeInTheDocument()
    expect(screen.getAllByText('$ 3.000')).toHaveLength(2)
    expect(screen.getByText('$ 1.500,50')).toBeInTheDocument()
    expect(screen.getByText('$ 0,50')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cerrar Caja/i }))

    await waitFor(() => {
      expect(document.querySelector('.modal.max-w-lg')).not.toBeNull()
    })

    const modal = document.querySelector('.modal.max-w-lg')
    expect(modal).toBeTruthy()

    const modalScope = within(modal)
    expect(modalScope.getByText('$ 100')).toBeInTheDocument()
    expect(modalScope.getByText('$ 2.500')).toBeInTheDocument()
    expect(modalScope.getByText('$ 3.000,50')).toBeInTheDocument()
    expect(modalScope.getByText('$ 5.500,50')).toBeInTheDocument()
    expect(modalScope.getByText('$ 2.600')).toBeInTheDocument()
    expect(modalScope.getByLabelText(/Efectivo Contado \(en caja\)/i)).toHaveAttribute('placeholder', '0')

    await user.type(modalScope.getByLabelText(/Efectivo Contado \(en caja\)/i), '2600')

    expect(modalScope.getByText('Diferencia: $ 0 (Cuadra perfecto)')).toBeInTheDocument()
  })
})
