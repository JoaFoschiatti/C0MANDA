import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Spinner } from './components/ui'

import AdminLayout from './components/layouts/AdminLayout'
import PublicLayout from './components/layouts/PublicLayout'
import RedirectByRole from './components/RedirectByRole'

const Login = lazy(() => import('./pages/Login'))
const MenuPublico = lazy(() => import('./pages/MenuPublico'))
const MenuMesaPublico = lazy(() => import('./pages/MenuMesaPublico'))

const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Usuarios = lazy(() => import('./pages/admin/Usuarios'))
const Mesas = lazy(() => import('./pages/admin/Mesas'))
const Categorias = lazy(() => import('./pages/admin/Categorias'))
const Productos = lazy(() => import('./pages/admin/Productos'))
const Ingredientes = lazy(() => import('./pages/admin/Ingredientes'))
const Liquidaciones = lazy(() => import('./pages/admin/Liquidaciones'))
const Reportes = lazy(() => import('./pages/admin/Reportes'))
const Configuracion = lazy(() => import('./pages/admin/Configuracion'))
const CierreCaja = lazy(() => import('./pages/admin/CierreCaja'))
const Reservas = lazy(() => import('./pages/admin/Reservas'))
const Modificadores = lazy(() => import('./pages/admin/Modificadores'))
const TransaccionesMercadoPago = lazy(() => import('./pages/admin/TransaccionesMercadoPago'))
const Pedidos = lazy(() => import('./pages/admin/Pedidos'))
const Tareas = lazy(() => import('./pages/admin/Tareas'))

const MozoMesas = lazy(() => import('./pages/mozo/MozoMesas'))
const NuevoPedido = lazy(() => import('./pages/mozo/NuevoPedido'))

const Cocina = lazy(() => import('./pages/cocina/Cocina'))
const DeliveryPedidos = lazy(() => import('./pages/delivery/DeliveryPedidos'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Spinner size="lg" label="Cargando interfaz..." />
    </div>
  )
}

function LazyScreen({ children }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {children}
    </Suspense>
  )
}

function ProtectedRoute({ children, roles }) {
  const { usuario, loading } = useAuth()

  if (loading) {
    return <RouteFallback />
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(usuario.rol)) {
    return <RedirectByRole />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LazyScreen><Login /></LazyScreen>} />
      <Route
        path="/menu"
        element={<PublicLayout><LazyScreen><MenuPublico /></LazyScreen></PublicLayout>}
      />
      <Route
        path="/menu/mesa/:qrToken"
        element={<PublicLayout><LazyScreen><MenuMesaPublico /></LazyScreen></PublicLayout>}
      />
      <Route
        path="/"
        element={(
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<RedirectByRole />} />
        <Route path="dashboard" element={<ProtectedRoute roles={['ADMIN', 'COCINERO', 'CAJERO']}><LazyScreen><Dashboard /></LazyScreen></ProtectedRoute>} />
        <Route path="usuarios" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Usuarios /></LazyScreen></ProtectedRoute>} />
        <Route path="mesas" element={<ProtectedRoute roles={['ADMIN', 'CAJERO']}><LazyScreen><Mesas /></LazyScreen></ProtectedRoute>} />
        <Route path="categorias" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Categorias /></LazyScreen></ProtectedRoute>} />
        <Route path="productos" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Productos /></LazyScreen></ProtectedRoute>} />
        <Route path="ingredientes" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Ingredientes /></LazyScreen></ProtectedRoute>} />
        <Route path="liquidaciones" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Liquidaciones /></LazyScreen></ProtectedRoute>} />
        <Route path="reportes" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Reportes /></LazyScreen></ProtectedRoute>} />
        <Route path="configuracion" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Configuracion /></LazyScreen></ProtectedRoute>} />
        <Route path="cierre-caja" element={<ProtectedRoute roles={['ADMIN', 'CAJERO']}><LazyScreen><CierreCaja /></LazyScreen></ProtectedRoute>} />
        <Route path="tareas" element={<ProtectedRoute roles={['ADMIN', 'CAJERO']}><LazyScreen><Tareas /></LazyScreen></ProtectedRoute>} />
        <Route path="reservas" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Reservas /></LazyScreen></ProtectedRoute>} />
        <Route path="modificadores" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><Modificadores /></LazyScreen></ProtectedRoute>} />
        <Route path="transacciones-mp" element={<ProtectedRoute roles={['ADMIN']}><LazyScreen><TransaccionesMercadoPago /></LazyScreen></ProtectedRoute>} />
        <Route path="pedidos" element={<LazyScreen><Pedidos /></LazyScreen>} />
        <Route path="mozo/mesas" element={<ProtectedRoute roles={['ADMIN', 'MOZO']}><LazyScreen><MozoMesas /></LazyScreen></ProtectedRoute>} />
        <Route path="mozo/nuevo-pedido" element={<ProtectedRoute roles={['ADMIN', 'MOZO']}><LazyScreen><NuevoPedido /></LazyScreen></ProtectedRoute>} />
        <Route path="mozo/nuevo-pedido/:mesaId" element={<ProtectedRoute roles={['ADMIN', 'MOZO']}><LazyScreen><NuevoPedido /></LazyScreen></ProtectedRoute>} />
        <Route path="cocina" element={<ProtectedRoute roles={['ADMIN', 'COCINERO', 'CAJERO']}><LazyScreen><Cocina /></LazyScreen></ProtectedRoute>} />
        <Route path="delivery/pedidos" element={<ProtectedRoute roles={['ADMIN', 'DELIVERY']}><LazyScreen><DeliveryPedidos /></LazyScreen></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<RedirectByRole />} />
    </Routes>
  )
}
