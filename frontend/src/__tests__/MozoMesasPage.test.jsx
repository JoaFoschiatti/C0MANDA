import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import MozoMesas from '../pages/mozo/MozoMesas'
import api from '../services/api'
import { createEventSource } from '../services/eventos'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
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

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  })
}))

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  })

  window.dispatchEvent(new Event('resize'))
}

const NOW = new Date().toISOString()

const mesasBase = [
  { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', zona: 'Salon' },
  { id: 2, numero: 2, capacidad: 2, estado: 'OCUPADA', zona: 'Salon', pedidos: [{ id: 99, createdAt: NOW }] },
  { id: 3, numero: 3, capacidad: 6, estado: 'RESERVADA', zona: 'Salon' },
  { id: 4, numero: 4, capacidad: 4, estado: 'ESPERANDO_CUENTA', zona: 'Salon', pedidos: [{ id: 120, createdAt: NOW }] },
  { id: 5, numero: 5, capacidad: 4, estado: 'CERRADA', zona: 'Salon', pedidos: [{ id: 150, createdAt: NOW }] }
]

function mockDefaultLoad(mesas = mesasBase, reservas = []) {
  api.get
    .mockResolvedValueOnce({ data: mesas })
    .mockResolvedValueOnce({ data: reservas })
}

describe('MozoMesas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(1280)
    createEventSource.mockReturnValue(null)
  })

  it('carga mesas y reservas proximas', async () => {
    mockDefaultLoad(
      [
        { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', zona: 'Salon' },
        { id: 2, numero: 2, capacidad: 2, estado: 'OCUPADA', zona: 'Salon', pedidos: [{ id: 99, createdAt: NOW }] }
      ],
      [{ id: 10, mesaId: 1, fechaHora: NOW, clienteNombre: 'Ana' }]
    )

    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(await screen.findByText('Salon')).toBeInTheDocument()
    expect(screen.getByText(/^#99/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/mesas?activa=true', { skipToast: true })
    expect(api.get).toHaveBeenCalledWith('/reservas/proximas', { skipToast: true })
  })

  it('muestra error de carga y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockRejectedValueOnce(new Error('fail mesas'))
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ id: 3, numero: 3, capacidad: 4, estado: 'LIBRE', zona: 'Patio' }]
      })
      .mockResolvedValueOnce({ data: [] })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', { name: /No pudimos cargar las mesas/i })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('Patio')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('usa temas visuales distintos por estado', async () => {
    mockDefaultLoad()

    const { container } = render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(await screen.findByText('Salon')).toBeInTheDocument()
    expect(screen.getByText(/^#99/)).toBeInTheDocument()
    expect(screen.getByText(/^#120/)).toBeInTheDocument()
    expect(screen.getByText(/^#150/)).toBeInTheDocument()

    expect(container.querySelector('#mesa-card-1')).toHaveClass('mesa-status-theme--libre')
    expect(container.querySelector('#mesa-card-2')).toHaveClass('mesa-status-theme--ocupada')
    expect(container.querySelector('#mesa-card-3')).toHaveClass('mesa-status-theme--reservada')
    expect(container.querySelector('#mesa-card-4')).toHaveClass('mesa-status-theme--esperando')
    expect(container.querySelector('#mesa-card-5')).toHaveClass('mesa-status-theme--cerrada')
  })

  it('muestra CTA flotante en mobile y navega a nuevo pedido', async () => {
    setViewportWidth(390)
    mockDefaultLoad([
      { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', zona: 'Salon' }
    ])

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(await screen.findByText('Salon')).toBeInTheDocument()
    expect(screen.getByTestId('mozo-mesas-mobile-new-order')).toHaveClass('page-mobile-cta--compact')
    expect(document.querySelector('#mesa-card-1')).toHaveClass('w-full', 'h-[8.75rem]')

    await user.click(screen.getByTestId('mozo-mesas-mobile-new-order'))

    expect(mockNavigate).toHaveBeenCalledWith('/mozo/nuevo-pedido')
  })

  it('muestra summary strip con conteo por estado', async () => {
    mockDefaultLoad()

    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(await screen.findByText('5 mesas')).toBeInTheDocument()
    expect(screen.getByText('Ocupadas')).toBeInTheDocument()
    expect(screen.getByText('Cuenta')).toBeInTheDocument()
    expect(screen.getByText('Libres')).toBeInTheDocument()
  })

  it('ordena mesas por prioridad dentro de cada zona', async () => {
    mockDefaultLoad()

    const { container } = render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    await screen.findByText('Salon')

    const cards = container.querySelectorAll('.mesa-status-card')
    const estados = Array.from(cards).map(c => c.dataset.estado)

    // ESPERANDO_CUENTA first, then OCUPADA, RESERVADA, CERRADA, LIBRE
    expect(estados.indexOf('ESPERANDO_CUENTA')).toBeLessThan(estados.indexOf('OCUPADA'))
    expect(estados.indexOf('OCUPADA')).toBeLessThan(estados.indexOf('LIBRE'))
  })

  it('muestra dot de atencion en mesas ESPERANDO_CUENTA', async () => {
    mockDefaultLoad()

    const { container } = render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    await screen.findByText('Salon')

    const esperandoCard = container.querySelector('#mesa-card-4')
    expect(esperandoCard.querySelector('.animate-ping')).not.toBeNull()

    const libreCard = container.querySelector('#mesa-card-1')
    expect(libreCard.querySelector('.animate-ping')).toBeNull()
  })

  it('oculta leyenda en mobile y muestra en desktop', async () => {
    mockDefaultLoad([
      { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', zona: 'Salon' },
    ])

    const { container } = render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    await screen.findByText('Salon')

    // Desktop — legend component rendered (has mesa-status-swatch elements from the legend)
    const legendSwatches = container.querySelectorAll('.mesa-status-swatch')
    // Summary strip renders 1 swatch (1 Libre) + legend renders 5 swatches = 6 total
    expect(legendSwatches.length).toBeGreaterThanOrEqual(6)

    // Mobile — legend hidden, only strip swatches
    setViewportWidth(390)
    mockDefaultLoad([
      { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', zona: 'Salon' },
    ])

    const { container: mobileContainer } = render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    await screen.findAllByText('Salon')

    const mobileSwatches = mobileContainer.querySelectorAll('.mesa-status-swatch')
    // Only strip swatch(es) — no legend
    expect(mobileSwatches.length).toBeLessThan(legendSwatches.length)
  })

  it('muestra indicador de ultima actualizacion', async () => {
    mockDefaultLoad()

    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    await screen.findByText('Salon')

    expect(screen.getByText('Actualizado ahora')).toBeInTheDocument()
  })
})
