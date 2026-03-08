import { CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline'

import ReservaCard from '../../components/reservas/ReservaCard'
import ReservasFilterBar from '../../components/reservas/ReservasFilterBar'
import ReservaModal from '../../components/reservas/ReservaModal'
import { Button, PageHeader, Spinner } from '../../components/ui'
import useReservasPage from '../../hooks/useReservasPage'

export default function Reservas() {
  const {
    abrirEditarReserva,
    abrirNuevaReserva,
    cambiarEstado,
    cerrarModal,
    fechaFiltro,
    formData,
    formatHora,
    guardarReserva,
    loading,
    mesas,
    reservas,
    reservasCount,
    reservaEdit,
    setFechaFiltro,
    setFormData,
    showModal,
  } = useReservasPage()

  return (
    <div>
      <PageHeader
        title="Reservas"
        actions={(
          <Button icon={PlusIcon} onClick={abrirNuevaReserva}>
            Nueva Reserva
          </Button>
        )}
      />

      <ReservasFilterBar
        fechaFiltro={fechaFiltro}
        reservasCount={reservasCount}
        setFechaFiltro={setFechaFiltro}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : reservas.length === 0 ? (
        <div className="card py-12 text-center">
          <CalendarDaysIcon className="mx-auto mb-4 h-16 w-16 text-text-tertiary" />
          <p className="text-text-secondary">No hay reservas para esta fecha</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reservas.map((reserva) => (
            <ReservaCard
              key={reserva.id}
              formatHora={formatHora}
              onCancelar={(id) => cambiarEstado(id, 'CANCELADA')}
              onEditar={abrirEditarReserva}
              onMarcarNoLlego={(id) => cambiarEstado(id, 'NO_LLEGO')}
              onMarcarPresente={(id) => cambiarEstado(id, 'CLIENTE_PRESENTE')}
              reserva={reserva}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ReservaModal
          formData={formData}
          mesas={mesas}
          onClose={cerrarModal}
          onSubmit={guardarReserva}
          reservaEdit={reservaEdit}
          setFormData={setFormData}
        />
      )}
    </div>
  )
}
