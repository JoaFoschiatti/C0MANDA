import { PlusIcon } from '@heroicons/react/24/outline'

import LiquidacionModal from '../../components/liquidaciones/LiquidacionModal'
import LiquidacionesTable from '../../components/liquidaciones/LiquidacionesTable'
import { Button, PageHeader, Spinner } from '../../components/ui'
import useLiquidacionesPage from '../../hooks/useLiquidacionesPage'

export default function Liquidaciones() {
  const {
    abrirNuevaLiquidacion,
    cerrarModal,
    empleadoSeleccionado,
    empleados,
    form,
    handleSubmit,
    horas,
    liquidaciones,
    loading,
    marcarPagada,
    setForm,
    showModal,
    subtotal,
    tarifaHora,
    totalPagar,
  } = useLiquidacionesPage()

  if (loading && liquidaciones.length === 0 && empleados.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Liquidaciones de Sueldos"
        actions={(
          <Button icon={PlusIcon} onClick={abrirNuevaLiquidacion} aria-label="Nueva Liquidación">
            Nueva Liquidación
          </Button>
        )}
      />

      <LiquidacionesTable liquidaciones={liquidaciones} onMarcarPagada={marcarPagada} />

      {showModal && (
        <LiquidacionModal
          empleadoSeleccionado={empleadoSeleccionado}
          empleados={empleados}
          form={form}
          horas={horas}
          onClose={cerrarModal}
          onSubmit={handleSubmit}
          setForm={setForm}
          subtotal={subtotal}
          tarifaHora={tarifaHora}
          totalPagar={totalPagar}
        />
      )}
    </div>
  )
}
