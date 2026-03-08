import { useAuth } from '../../context/AuthContext'
import useTareasPage from '../../hooks/useTareasPage'
import { Alert, Button, PageHeader, Spinner } from '../../components/ui'
import TaskSection from '../../components/tareas/TaskSection'
import TaskSummaryCards from '../../components/tareas/TaskSummaryCards'

export default function Tareas() {
  const { esAdmin } = useAuth()
  const {
    data,
    errorMessage,
    handleCerrarPedido,
    handleLiberarMesa,
    loading,
    processingTaskId,
    reload,
    resumenCards,
  } = useTareasPage()

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" label="Cargando tareas..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Tareas"
        description="Cola operativa para caja y stock"
        actions={(
          <Button type="button" variant="outline" onClick={reload}>
            Actualizar
          </Button>
        )}
      />

      {errorMessage && (
        <Alert variant="error" className="mb-6">
          <div className="flex w-full items-center justify-between gap-4">
            <span>{errorMessage}</span>
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {data?.resumen?.altaPrioridad > 0 && (
        <Alert variant="warning" className="mb-6">
          Hay {data.resumen.altaPrioridad} tareas de alta prioridad que requieren atencion inmediata.
        </Alert>
      )}

      <TaskSummaryCards cards={resumenCards} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TaskSection
          title="Caja"
          description="Mesas esperando cuenta, cobros pendientes y cierres operativos."
          tasks={data?.caja || []}
          esAdmin={esAdmin}
          processingTaskId={processingTaskId}
          onCerrarPedido={handleCerrarPedido}
          onLiberarMesa={handleLiberarMesa}
        />

        <TaskSection
          title="Stock"
          description="Lotes vencidos, proximos vencimientos y stock por debajo del minimo."
          tasks={data?.stock || []}
          esAdmin={esAdmin}
          processingTaskId={processingTaskId}
          onCerrarPedido={handleCerrarPedido}
          onLiberarMesa={handleLiberarMesa}
        />
      </div>
    </div>
  )
}
