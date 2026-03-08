import { Link } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import useDashboardPage from '../../hooks/useDashboardPage'
import { Alert, Button, PageHeader, Spinner } from '../../components/ui'
import DashboardStatGrid from '../../components/dashboard/DashboardStatGrid'
import QuickAccessGrid from '../../components/dashboard/QuickAccessGrid'

export default function Dashboard() {
  const { esAdmin, esCajero } = useAuth()
  const puedeVerTareas = esAdmin || esCajero
  const { data, errorMessage, loading, quickLinks, reload, stats } = useDashboardPage({
    puedeVerTareas,
  })

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" label="Cargando dashboard..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen del dia" />

      {errorMessage && (
        <Alert variant="error" className="mb-6">
          <div className="flex w-full items-center justify-between">
            <span>{errorMessage}</span>
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {data?.lotesVencidosPendientes > 0 && (
        <Alert variant="warning" className="mb-6">
          <div className="flex w-full items-center justify-between gap-4">
            <span>
              Hay {data.lotesVencidosPendientes} lotes vencidos pendientes de descarte manual.
            </span>
            <Link to="/ingredientes" className="btn btn-outline btn-sm">
              Revisar lotes
            </Link>
          </div>
        </Alert>
      )}

      {puedeVerTareas && data?.tareasAltaPrioridad > 0 && (
        <Alert variant="warning" className="mb-6">
          <div className="flex w-full items-center justify-between gap-4">
            <span>
              Hay {data.tareasAltaPrioridad} tareas operativas de alta prioridad pendientes.
            </span>
            <Link to="/tareas" className="btn btn-outline btn-sm">
              Abrir tareas
            </Link>
          </div>
        </Alert>
      )}

      <DashboardStatGrid stats={stats} />
      <QuickAccessGrid links={quickLinks} />
    </div>
  )
}
