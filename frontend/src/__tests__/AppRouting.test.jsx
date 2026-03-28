import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

let authState = { usuario: null, loading: false }

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState
}))

vi.mock('../components/layouts/AdminLayout', async () => {
  const { Outlet } = await vi.importActual('react-router-dom')
  return {
    default: () => (
      <div data-testid="admin-layout">
        <Outlet />
      </div>
    )
  }
})

vi.mock('../components/layouts/PublicLayout', () => ({
  default: ({ children }) => <div data-testid="public-layout">{children}</div>
}))

vi.mock('../components/RedirectByRole', () => ({
  default: () => <div data-testid="redirect-by-role" />
}))

vi.mock('../pages/Login', () => ({
  default: () => <div>LoginPage</div>
}))
vi.mock('../pages/MenuPublico', () => ({
  default: () => <div>MenuPublico</div>
}))
vi.mock('../pages/MenuMesaPublico', () => ({
  default: () => <div>MenuMesaPublico</div>
}))
vi.mock('../pages/admin/Dashboard', () => ({ default: () => <div>Dashboard</div> }))
vi.mock('../pages/admin/Usuarios', () => ({ default: () => <div>Usuarios</div> }))
vi.mock('../pages/admin/Mesas', () => ({ default: () => <div>Mesas</div> }))
vi.mock('../pages/admin/Categorias', () => ({ default: () => <div>Categorias</div> }))
vi.mock('../pages/admin/Productos', () => ({ default: () => <div>Productos</div> }))
vi.mock('../pages/admin/Ingredientes', () => ({ default: () => <div>Ingredientes</div> }))
vi.mock('../pages/admin/Reportes', () => ({ default: () => <div>Reportes</div> }))
vi.mock('../pages/admin/Configuracion', () => ({ default: () => <div>Configuracion</div> }))
vi.mock('../pages/admin/CierreCaja', () => ({ default: () => <div>CierreCaja</div> }))
vi.mock('../pages/admin/Tareas', () => ({ default: () => <div>Tareas</div> }))
vi.mock('../pages/admin/Reservas', () => ({ default: () => <div>Reservas</div> }))
vi.mock('../pages/admin/Modificadores', () => ({ default: () => <div>Modificadores</div> }))
vi.mock('../pages/admin/TransaccionesMercadoPago', () => ({ default: () => <div>TransaccionesMP</div> }))
vi.mock('../pages/mozo/MozoMesas', () => ({ default: () => <div>MozoMesas</div> }))
vi.mock('../pages/mozo/NuevoPedido', () => ({ default: () => <div>NuevoPedido</div> }))
vi.mock('../pages/admin/Pedidos', () => ({ default: () => <div>Pedidos</div> }))
vi.mock('../pages/cocina/Cocina', () => ({ default: () => <div>Cocina</div> }))
vi.mock('../pages/delivery/DeliveryPedidos', () => ({ default: () => <div>DeliveryPedidos</div> }))

describe('App routing', () => {
  it('renderiza /menu publico en modo restaurante unico', async () => {
    authState = { usuario: null, loading: false }
    render(
      <MemoryRouter initialEntries={['/menu']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByText('MenuPublico')).toBeInTheDocument()
  })

  it('redirige a login cuando no hay usuario', async () => {
    authState = { usuario: null, loading: false }
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('permite dashboard para ADMIN', async () => {
    authState = { usuario: { rol: 'ADMIN' }, loading: false }
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })

  it('redirige pedidos para un rol no autorizado', async () => {
    authState = { usuario: { rol: 'COCINERO' }, loading: false }
    render(
      <MemoryRouter initialEntries={['/pedidos']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByTestId('redirect-by-role')).toBeInTheDocument()
  })
})
