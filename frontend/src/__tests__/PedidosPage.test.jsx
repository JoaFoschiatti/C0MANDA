import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Pedidos from '../pages/admin/Pedidos'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
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
    patch: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('react-hot-toast', () => {
  const toastFn = vi.fn()
  toastFn.success = vi.fn()
  toastFn.error = vi.fn()
  return { default: toastFn }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('../components/pedidos/NuevoPedidoModal', () => ({
  default: () => null
}))

const buildPedidosUrl = ({ q = '', estado = '', tipo = '', fecha = '', limit = 50, offset = 0, mesaId = null } = {}) => {
  const params = new URLSearchParams()

  if (q) params.set('q', q)
  if (estado) params.set('estado', estado)
  if (estado === 'CERRADO' || estado === 'CANCELADO') params.set('incluirCerrados', 'true')
  if (tipo) params.set('tipo', tipo)
  if (fecha) params.set('fecha', fecha)
  if (mesaId) params.set('mesaId', String(mesaId))

  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return `/pedidos?${params.toString()}`
}

const createMockEventSource = () => {
  const listeners = new Map()

  return {
    addEventListener: vi.fn((eventName, handler) => {
      listeners.set(eventName, handler)
    }),
    removeEventListener: vi.fn((eventName, handler) => {
      if (listeners.get(eventName) === handler) {
        listeners.delete(eventName)
      }
    }),
    close: vi.fn(),
    emit(eventName, payload) {
      listeners.get(eventName)?.({ data: JSON.stringify(payload) })
    }
  }
}

const createDeferred = () => {
  let resolve
  const promise = new Promise((resolver) => {
    resolve = resolver
  })

  return { promise, resolve }
}

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  })

  window.dispatchEvent(new Event('resize'))
}

describe('Pedidos page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(1280)
    useAuth.mockReturnValue({ usuario: { rol: 'ADMIN' } })
    createEventSource.mockReturnValue(null)
  })

  const renderPage = (initialEntries = ['/pedidos']) => render(
    <MemoryRouter initialEntries={initialEntries}>
      <Pedidos />
    </MemoryRouter>
  )

  it('carga pedidos y aplica filtro por estado', async () => {
    const pedido = {
      id: 1,
      tipo: 'MOSTRADOR',
      total: '100',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    api.get
      .mockResolvedValueOnce({ data: { data: [pedido], total: 1 } })
      .mockResolvedValueOnce({ data: { data: [pedido], total: 1 } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.queryByTestId('pedidos-toolbar')).not.toBeInTheDocument()
    expect(screen.getByTestId('pedidos-list-toolbar')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar pedidos')).toHaveAttribute('placeholder', 'Buscar por pedido, mesa o cliente')
    expect(screen.getByLabelText('Filtrar por estado')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ estado: 'PENDIENTE' }))
    })
  })

  it('busca pedidos por numero, mesa o cliente con debounce', async () => {
    const pedido = {
      id: 30,
      tipo: 'DELIVERY',
      total: '150',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Juan Perez',
      pagos: []
    }

    api.get
      .mockResolvedValueOnce({ data: { data: [pedido], total: 1 } })
      .mockResolvedValueOnce({ data: { data: [pedido], total: 1 } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#30')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Buscar pedidos'), '30')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ q: '30' }))
    })
  })

  it('muestra filtros avanzados y permite limpiarlos sin perder el contexto de mesa', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }

      return Promise.resolve({ data: { data: [], total: 0 } })
    })

    const user = userEvent.setup()
    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()
    expect(screen.queryByTestId('pedidos-advanced-filters')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mas filtros' }))
    expect(screen.getByTestId('pedidos-advanced-filters')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Buscar pedidos'), 'juan')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'COBRADO')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'DELIVERY')
    await user.type(screen.getByLabelText('Fecha'), '2026-04-01')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({
        q: 'juan',
        estado: 'COBRADO',
        tipo: 'DELIVERY',
        fecha: '2026-04-01',
        mesaId: 7
      }))
    })

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ mesaId: 7 }))
    })

    expect(screen.getByLabelText('Buscar pedidos')).toHaveValue('')
    expect(screen.getByLabelText('Filtrar por estado')).toHaveValue('')
    expect(screen.queryByTestId('pedidos-advanced-filters')).not.toBeInTheDocument()
  })

  it('aplica mesaId en la consulta y mantiene el foco del pedido', async () => {
    const pedido = {
      id: 3,
      tipo: 'MESA',
      total: '180',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesaId: 7,
      mesa: { id: 7, numero: 7 },
      clienteNombre: 'Mesa 7',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [pedido], total: 1 } })
      }
      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }
      return Promise.resolve({ data: [] })
    })

    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('#3')).toBeInTheDocument()
    expect(screen.queryByTestId('pedidos-toolbar')).not.toBeInTheDocument()
    expect(screen.getByTestId('pedidos-list-toolbar')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar pedidos')).toHaveAttribute('placeholder', 'Buscar por pedido o cliente')
    expect(screen.getByRole('button', { name: 'Ver todos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a Mesas' })).toBeInTheDocument()
    expect(screen.queryByText('Estas viendo los pedidos de Mesa 7.')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ mesaId: 7 }))
      expect(api.get).toHaveBeenCalledWith('/mesas/7', expect.objectContaining({ skipToast: true }))
    })
  })

  it('permite quitar el filtro de mesa con "Ver todos"', async () => {
    const pedido = {
      id: 4,
      tipo: 'MESA',
      total: '220',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesaId: 7,
      mesa: { id: 7, numero: 7 },
      clienteNombre: 'Mesa 7',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [pedido], total: 1 } })
      }
      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }
      if (url === buildPedidosUrl()) {
        return Promise.resolve({ data: { data: [pedido], total: 1 } })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver todos' }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl())
    })

    await waitFor(() => {
      expect(screen.queryByText('Viendo pedidos de Mesa 7.')).not.toBeInTheDocument()
    })
  })

  it('usa la ruta correcta en "Volver a Mesas" para admin y cajero', async () => {
    const pedido = {
      id: 5,
      tipo: 'MESA',
      total: '250',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesaId: 7,
      mesa: { id: 7, numero: 7 },
      clienteNombre: 'Mesa 7',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [pedido], total: 1 } })
      }
      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a Mesas' }))

    expect(mockNavigate).toHaveBeenCalledWith('/mesas')
  })

  it('usa la ruta correcta en "Volver a Mesas" para mozo', async () => {
    useAuth.mockReturnValue({ usuario: { rol: 'MOZO' } })

    const pedido = {
      id: 6,
      tipo: 'MESA',
      total: '260',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesaId: 7,
      mesa: { id: 7, numero: 7 },
      clienteNombre: 'Mesa 7',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [pedido], total: 1 } })
      }
      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a Mesas' }))

    expect(mockNavigate).toHaveBeenCalledWith('/mozo/mesas')
  })

  it('muestra cards y CTA flotante de nuevo pedido para mozo en mobile', async () => {
    setViewportWidth(390)
    useAuth.mockReturnValue({ usuario: { rol: 'MOZO' } })

    const pedido = {
      id: 14,
      tipo: 'MESA',
      total: '9300',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { id: 8, numero: 8 },
      clienteNombre: 'Mesa 8',
      pagos: []
    }

    api.get.mockResolvedValue({ data: { data: [pedido], total: 1 } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#14')).toBeInTheDocument()
    expect(screen.getByTestId('pedidos-mobile-list')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '#' })).not.toBeInTheDocument()
    expect(screen.getByTestId('pedidos-mobile-new-order')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Nuevo pedido/i })).toHaveLength(1)

    await user.click(screen.getByTestId('pedidos-mobile-new-order'))

    expect(mockNavigate).toHaveBeenCalledWith('/mozo/nuevo-pedido')
  })

  it('usa la mesa filtrada para el CTA flotante de nuevo pedido del mozo en mobile', async () => {
    setViewportWidth(390)
    useAuth.mockReturnValue({ usuario: { rol: 'MOZO' } })

    const pedido = {
      id: 15,
      tipo: 'MESA',
      total: '9300',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesaId: 7,
      mesa: { id: 7, numero: 7 },
      clienteNombre: 'Mesa 7',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [pedido], total: 1 } })
      }

      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }

      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()
    expect(screen.getByTestId('pedidos-mobile-new-order')).toBeInTheDocument()
    expect(screen.getByText('Agregar consumo a Mesa 7')).toBeInTheDocument()

    await user.click(screen.getByTestId('pedidos-mobile-new-order'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('mantiene el contexto de mesa en el empty state', async () => {
    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [], total: 0 } })
      }
      if (url === '/mesas/7') {
        return Promise.resolve({ data: { id: 7, numero: 7 } })
      }
      return Promise.resolve({ data: [] })
    })

    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Viendo pedidos de Mesa 7.')).toBeInTheDocument()
    expect(await screen.findByText('No hay pedidos para Mesa 7')).toBeInTheDocument()
    expect(screen.getByText('Cuando Mesa 7 tenga pedidos, los vas a ver en esta bandeja.')).toBeInTheDocument()
  })

  it('muestra un empty state de coincidencias cuando no hay resultados para los filtros', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('No hay pedidos para mostrar')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Buscar pedidos'), 'ana')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ q: 'ana' }))
    })

    expect(await screen.findByText('No se encontraron pedidos')).toBeInTheDocument()
    expect(screen.getByText('Prueba ajustando o limpiando los filtros para ver mas pedidos.')).toBeInTheDocument()
  })

  it('muestra un fallback seguro si falla la carga del contexto de mesa', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl({ mesaId: 7 })) {
        return Promise.resolve({ data: { data: [], total: 0 } })
      }
      if (url === '/mesas/7') {
        return Promise.reject(new Error('boom'))
      }
      return Promise.resolve({ data: [] })
    })

    renderPage(['/pedidos?mesaId=7'])

    expect(await screen.findByText('Mesa seleccionada.')).toBeInTheDocument()
    expect(screen.getByText('Mesa seleccionada')).toBeInTheDocument()
    expect(screen.getByText('No hay pedidos para esta mesa')).toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })

  it('muestra titles cortos en las acciones de la grilla', async () => {
    const pedidoPendiente = {
      id: 11,
      tipo: 'MESA',
      total: '180',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 2 },
      clienteNombre: null,
      pagos: []
    }
    const pedidoCobrado = {
      id: 12,
      tipo: 'MESA',
      total: '220',
      estado: 'COBRADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 3 },
      clienteNombre: null,
      comprobanteFiscal: null,
      pagos: []
    }

    api.get.mockResolvedValueOnce({ data: { data: [pedidoPendiente, pedidoCobrado], total: 2 } })

    renderPage()

    expect(await screen.findByText('#11')).toBeInTheDocument()

    expect(screen.getAllByTitle('Ver detalle')).toHaveLength(2)
    expect(screen.getAllByTitle('Imprimir')).toHaveLength(2)
    expect(screen.getByRole('button', { name: `Registrar pago del pedido #${pedidoPendiente.id}` })).toHaveAttribute('title', 'Registrar pago')
    expect(screen.getByRole('button', { name: `Facturar pedido #${pedidoCobrado.id}` })).toHaveAttribute('title', 'Facturar')
  })

  it('abre detalle y registra pago', async () => {
    const pedido = {
      id: 9,
      tipo: 'MESA',
      total: '200',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 3 },
      clienteNombre: null,
      usuario: { nombre: 'Ana' },
      pagos: []
    }
    const pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '200',
          producto: { nombre: 'Pizza' }
        }
      ]
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValueOnce({ data: { pago: { id: 1 }, pedido: { ...pedidoDetalle, estado: 'COBRADO' } } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#9')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Ver detalle del pedido #${pedido.id}` }))
    expect(await screen.findByText(`Pedido #${pedido.id}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })
    await user.click(screen.getByRole('button', { name: 'Registrar Pago' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos', {
        pedidoId: pedido.id,
        monto: 200,
        metodo: 'EFECTIVO',
        referencia: null,
        canalCobro: 'CAJA',
        propinaMonto: 0,
        propinaMetodo: null,
        montoAbonado: null
      })
    })

    expect(toast.success).toHaveBeenCalledWith('Pago registrado')
  })

  it('oculta CTAs de pago y cierre para mozo', async () => {
    useAuth.mockReturnValue({ usuario: { rol: 'MOZO' } })

    const pedido = {
      id: 88,
      tipo: 'MESA',
      total: '400',
      estado: 'COBRADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { id: 5, numero: 5 },
      mesaId: 5,
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      comprobanteFiscal: null,
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: { ...pedido, items: [] } })
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#88')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Facturar pedido #${pedido.id}` })).toBeNull()

    await user.click(screen.getByRole('button', { name: `Ver detalle del pedido #${pedido.id}` }))
    expect(await screen.findByText(`Pedido #${pedido.id}`)).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Cerrar pedido' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Facturar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Liberar mesa' })).toBeNull()
  })

  it('muestra titles descriptivos en los botones de acciones del listado', async () => {
    const pedidos = [
      {
        id: 9,
        tipo: 'MESA',
        total: '200',
        estado: 'PENDIENTE',
        createdAt: new Date().toISOString(),
        impresion: null,
        mesa: { numero: 3 },
        clienteNombre: null,
        pagos: []
      },
      {
        id: 15,
        tipo: 'DELIVERY',
        total: '500',
        estado: 'LISTO',
        createdAt: new Date().toISOString(),
        impresion: null,
        mesa: null,
        repartidorId: null,
        clienteNombre: 'Ana',
        pagos: []
      },
      {
        id: 88,
        tipo: 'MESA',
        total: '400',
        estado: 'COBRADO',
        createdAt: new Date().toISOString(),
        impresion: null,
        mesa: { numero: 5 },
        clienteNombre: null,
        comprobanteFiscal: null,
        pagos: []
      }
    ]

    api.get.mockResolvedValueOnce({ data: { data: pedidos, total: pedidos.length } })

    renderPage()

    expect(await screen.findByText('#9')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Ver detalle del pedido #9/i })).toHaveAttribute('title', 'Ver detalle')
    expect(screen.getByRole('button', { name: /Imprimir pedido #9/i })).toHaveAttribute('title', 'Imprimir')
    expect(screen.getByRole('button', { name: /Registrar pago del pedido #9/i })).toHaveAttribute('title', 'Registrar pago')
    expect(screen.getByRole('button', { name: /Asignar repartidor al pedido #15/i })).toHaveAttribute('title', 'Asignar repartidor')
    expect(screen.getByRole('button', { name: /Facturar pedido #88/i })).toHaveAttribute('title', 'Facturar')
  })

  it('muestra los datos de transferencia y permite registrar un cobro manual sin referencia', async () => {
    const pedido = {
      id: 15,
      tipo: 'MESA',
      total: '500',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 7 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    let pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '500',
          producto: { nombre: 'Milanesa' }
        }
      ],
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      if (url === '/pagos/mercadopago/transferencia-config') {
        return Promise.resolve({
          data: {
            alias: 'mi-resto.mp',
            titular: 'Mi Resto SA',
            cvu: '0000003100000000000001'
          }
        })
      }
      return Promise.resolve({ data: [] })
    })

    api.post.mockResolvedValueOnce({
      data: {
        pago: { id: 99 },
        pedido: {
          ...pedidoDetalle,
          estado: 'COBRADO'
        }
      }
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#15')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar modal' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tarjeta' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Canal de Cobro')).not.toBeInTheDocument()
    expect(screen.queryByText('Checkout web')).not.toBeInTheDocument()
    expect(screen.queryByText('Transferencia Mercado Pago')).not.toBeInTheDocument()
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument()
    expect(screen.getByText('Total pedido')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto ($)')).toHaveDisplayValue('500')
    expect(screen.getByText('Pendiente actual: $ 500')).toBeInTheDocument()
    expect(screen.queryByLabelText('Propina ($)')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText('Monto ($)')).toHaveFocus()
    })

    await user.selectOptions(screen.getByLabelText('Metodo de Pago'), 'MERCADOPAGO')
    expect(await screen.findByText('Transferencia Mercado Pago')).toBeInTheDocument()
    expect(screen.getByText('La referencia es opcional.')).toBeInTheDocument()
    expect(screen.getByText('mi-resto.mp')).toBeInTheDocument()
    expect(screen.queryByLabelText('Propina ($)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Referencia de transferencia (opcional)')).toHaveAttribute('placeholder', 'Ej. numero o codigo de operacion')
    await waitFor(() => {
      expect(screen.getByLabelText('Referencia de transferencia (opcional)')).toHaveFocus()
    })

    await user.click(screen.getByRole('button', { name: 'Registrar Pago' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos', {
        pedidoId: pedido.id,
        monto: 500,
        metodo: 'MERCADOPAGO',
        referencia: null,
        canalCobro: 'CAJA',
        propinaMonto: 0,
        propinaMetodo: null,
        montoAbonado: null
      })
    })

    expect(toast.success).toHaveBeenCalledWith('Pago registrado')
  })

  it('mantiene centavos reales visibles en el modal de registrar pago', async () => {
    const pedido = {
      id: 21,
      tipo: 'MESA',
      total: '9300.50',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 12 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    const pedidoDetalle = {
      ...pedido,
      items: [],
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      if (url === '/pagos/mercadopago/transferencia-config') {
        return Promise.resolve({ data: { alias: 'mi-resto.mp' } })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#21')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })

    expect(screen.getByLabelText('Monto ($)')).toHaveDisplayValue('9300.50')
    expect(screen.getByText('Pendiente actual: $ 9.300,50')).toBeInTheDocument()
  })

  it('permite cerrar el modal de pago con Escape', async () => {
    const pedido = {
      id: 17,
      tipo: 'MESA',
      total: '500',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 9 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) {
        return Promise.resolve({ data: { ...pedido, items: [], pagos: [] } })
      }
      if (url === '/pagos/mercadopago/transferencia-config') {
        return Promise.resolve({ data: { alias: 'mi-resto.mp' } })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#17')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('envia la referencia cuando el cajero la completa en un cobro manual de Mercado Pago', async () => {
    const pedido = {
      id: 16,
      tipo: 'MESA',
      total: '500',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 8 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    const pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '500',
          producto: { nombre: 'Milanesa' }
        }
      ],
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      if (url === '/pagos/mercadopago/transferencia-config') {
        return Promise.resolve({
          data: {
            alias: 'mi-resto.mp',
            titular: 'Mi Resto SA',
            cvu: '0000003100000000000001'
          }
        })
      }
      return Promise.resolve({ data: [] })
    })

    api.post.mockResolvedValueOnce({
      data: {
        pago: { id: 100 },
        pedido: {
          ...pedidoDetalle,
          estado: 'COBRADO'
        }
      }
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#16')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })
    expect(screen.queryByLabelText('Canal de Cobro')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Metodo de Pago'), 'MERCADOPAGO')
    await user.type(screen.getByLabelText('Referencia de transferencia (opcional)'), 'TRF-123')
    await user.click(screen.getByRole('button', { name: 'Registrar Pago' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos', {
        pedidoId: pedido.id,
        monto: 500,
        metodo: 'MERCADOPAGO',
        referencia: 'TRF-123',
        canalCobro: 'CAJA',
        propinaMonto: 0,
        propinaMetodo: null,
        montoAbonado: null
      })
    })

    expect(toast.success).toHaveBeenCalledWith('Pago registrado')
  })

  it('muestra propina como seccion opcional, hereda el metodo y limpia estados ocultos al cambiar de metodo', async () => {
    const pedido = {
      id: 18,
      tipo: 'MESA',
      total: '500',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 10 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    const pedidoDetalle = {
      ...pedido,
      items: [],
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      if (url === '/pagos/mercadopago/transferencia-config') {
        return Promise.resolve({
          data: {
            alias: 'mi-resto.mp',
            titular: 'Mi Resto SA',
            cvu: '0000003100000000000001'
          }
        })
      }
      return Promise.resolve({ data: [] })
    })

    api.post.mockResolvedValueOnce({
      data: {
        pago: { id: 101 },
        pedido: {
          ...pedidoDetalle,
          estado: 'COBRADO'
        }
      }
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#18')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })

    expect(screen.queryByLabelText('Propina ($)')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agregar propina' }))
    expect(screen.getByLabelText('Propina ($)')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Metodo de Pago'), 'MERCADOPAGO')
    await user.type(screen.getByLabelText('Referencia de transferencia (opcional)'), 'TRF-999')
    await user.type(screen.getByLabelText('Propina ($)'), '50')
    expect(screen.getByLabelText('Metodo de Propina')).toHaveValue('MERCADOPAGO')

    await user.selectOptions(screen.getByLabelText('Metodo de Pago'), 'EFECTIVO')
    expect(screen.queryByLabelText('Referencia de transferencia (opcional)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Metodo de Propina')).toHaveValue('EFECTIVO')
    expect(screen.getByLabelText('Monto abonado ($)')).toHaveAttribute('placeholder', 'Minimo $ 550')

    await user.type(screen.getByLabelText('Monto abonado ($)'), '400')
    expect(screen.getByText('Faltan: $ 150')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar Pago' })).toBeDisabled()

    await user.clear(screen.getByLabelText('Monto abonado ($)'))
    await user.type(screen.getByLabelText('Monto abonado ($)'), '600')
    expect(screen.getByText('Vuelto estimado: $ 50')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar propina' }))
    expect(screen.queryByLabelText('Propina ($)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar Pago' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos', {
        pedidoId: pedido.id,
        monto: 500,
        metodo: 'EFECTIVO',
        referencia: null,
        canalCobro: 'CAJA',
        propinaMonto: 0,
        propinaMetodo: null,
        montoAbonado: 600
      })
    })
  })

  it('bloquea MercadoPago de forma visible cuando falta el alias', async () => {
    const pedido = {
      id: 19,
      tipo: 'MESA',
      total: '500',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 11 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) {
        return Promise.resolve({ data: { ...pedido, items: [], pagos: [] } })
      }
      if (url === '/pagos/mercadopago/transferencia-config') {
        return Promise.resolve({ data: { alias: '' } })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#19')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })

    expect(screen.getByText(/MercadoPago no esta disponible/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'MercadoPago' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Registrar Pago' })).not.toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Metodo de Pago'), 'EFECTIVO')
    expect(screen.getByRole('button', { name: 'Registrar Pago' })).not.toBeDisabled()
  })

  it('abre el pago desde el deep link de pedido', async () => {
    const pedido = {
      id: 31,
      tipo: 'MESA',
      total: '320',
      estado: 'ENTREGADO',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 4 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) {
        return Promise.resolve({
          data: {
            ...pedido,
            items: [],
            pagos: []
          }
        })
      }

      return Promise.resolve({ data: [] })
    })

    renderPage([`/pedidos?pedidoId=${pedido.id}&openPago=1`])

    expect(await screen.findByRole('heading', { name: 'Registrar Pago' })).toBeInTheDocument()

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/pedidos/${pedido.id}`)
    })
  })

  it('reimprime la comanda sin abrir preview', async () => {
    const pedido = {
      id: 63,
      tipo: 'MOSTRADOR',
      total: '140',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValueOnce({ data: { success: true } })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#63')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Imprimir pedido #${pedido.id}` }))
    await user.click(await screen.findByText('Comanda cocina'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(`/impresion/comanda/${pedido.id}/reimprimir`, { tipo: 'COCINA' })
    })

    expect(toast.success).toHaveBeenCalledWith('Comanda cocina encolada')
  })

  it('evita doble submit en el pago manual', async () => {
    const pedido = {
      id: 57,
      tipo: 'MESA',
      total: '250',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 2 },
      clienteNombre: null,
      usuario: { nombre: 'Caja' },
      pagos: []
    }

    const pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '250',
          producto: { nombre: 'Hamburguesa' }
        }
      ]
    }

    const deferred = createDeferred()

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedido], total: 1 } })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })
    api.post.mockReturnValueOnce(deferred.promise)

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#57')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await screen.findByRole('button', { name: 'Registrar Pago' })

    const submitButton = screen.getByRole('button', { name: 'Registrar Pago' })
    await user.click(submitButton)
    await user.click(submitButton)

    expect(api.post).toHaveBeenCalledTimes(1)

    deferred.resolve({
      data: {
        pago: { id: 1 },
        pedido: { ...pedidoDetalle, estado: 'COBRADO' }
      }
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pago registrado')
    })
  })

  it('mantiene el filtro activo cuando llega una actualizacion SSE de un pedido que ya no califica', async () => {
    const source = createMockEventSource()
    createEventSource.mockReturnValue(source)
    let pendingFilterCalls = 0

    const pedidoPendiente = {
      id: 44,
      tipo: 'MOSTRADOR',
      total: '180',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    api.get.mockImplementation((url) => {
      if (url === buildPedidosUrl()) return Promise.resolve({ data: { data: [pedidoPendiente], total: 1 } })
      if (url === buildPedidosUrl({ estado: 'PENDIENTE' })) {
        pendingFilterCalls += 1

        return Promise.resolve({
          data: pendingFilterCalls === 1
            ? { data: [pedidoPendiente], total: 1 }
            : { data: [], total: 0 }
        })
      }
      if (url === `/pedidos/${pedidoPendiente.id}`) {
        return Promise.resolve({
          data: {
            ...pedidoPendiente,
            estado: 'COBRADO',
            items: [],
            pagos: []
          }
        })
      }
      return Promise.resolve({ data: [] })
    })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#44')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(buildPedidosUrl({ estado: 'PENDIENTE' }))
    })

    source.emit('pedido.updated', {
      id: pedidoPendiente.id,
      estado: 'COBRADO',
      tipo: pedidoPendiente.tipo
    })

    await waitFor(() => {
      expect(screen.queryByText('#44')).not.toBeInTheDocument()
    })

    expect(screen.getByText('No se encontraron pedidos')).toBeInTheDocument()
  })

  it('evita multiples cargas concurrentes al usar "Cargar mas"', async () => {
    const primerPedido = {
      id: 71,
      tipo: 'MOSTRADOR',
      total: '100',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    const segundoPedido = {
      ...primerPedido,
      id: 72
    }

    const deferred = createDeferred()

    api.get
      .mockResolvedValueOnce({ data: { data: [primerPedido], total: 60 } })
      .mockImplementationOnce(() => deferred.promise)

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('#71')).toBeInTheDocument()

    const loadMoreButton = screen.getByRole('button', { name: /Cargar mas/i })
    await user.click(loadMoreButton)
    await user.click(loadMoreButton)

    expect(
      api.get.mock.calls.filter(([url]) => url === buildPedidosUrl({ limit: 100, offset: 0 }))
    ).toHaveLength(1)

    deferred.resolve({ data: { data: [primerPedido, segundoPedido], total: 60 } })

    expect(await screen.findByText('#72')).toBeInTheDocument()
  })
})
