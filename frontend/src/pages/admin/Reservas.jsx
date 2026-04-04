import { useCallback } from 'react'
import { CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline'

import ReservaCard from '../../components/reservas/ReservaCard'
import ReservaDetalleModal from '../../components/reservas/ReservaDetalleModal'
import ReservasFilterBar from '../../components/reservas/ReservasFilterBar'
import ReservaModal from '../../components/reservas/ReservaModal'
import { Button, PageHeader, Spinner } from '../../components/ui'
import useReservasPage from '../../hooks/useReservasPage'

export default function Reservas() {
  const {
    abrirDetalleReserva,
    abrirEditarReserva,
    abrirNuevaReserva,
    cambiarEstado,
    cerrarDetalle,
    cerrarModal,
    fechaFiltro,
    formData,
    formatHora,
    guardarReserva,
    loading,
    mesas,
    reservaDetalle,
    reservas,
    reservasCount,
    reservaEdit,
    setFechaFiltro,
    setFormData,
    showModal,
  } = useReservasPage()

  const handleEditarDesdeDetalle = useCallback((reserva) => {
    cerrarDetalle()
    abrirEditarReserva(reserva)
  }, [cerrarDetalle, abrirEditarReserva])

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
            <div key={reserva.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => abrirDetalleReserva(reserva)} onKeyDown={(e) => e.key === 'Enter' && abrirDetalleReserva(reserva)}>
              <ReservaCard
                formatHora={formatHora}
                onCancelar={(id) => cambiarEstado(id, 'CANCELADA')}
                onEditar={abrirEditarReserva}
                onMarcarNoLlego={(id) => cambiarEstado(id, 'NO_LLEGO')}
                onMarcarPresente={(id) => cambiarEstado(id, 'CLIENTE_PRESENTE')}
                reserva={reserva}
              />
            </div>
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

      <ReservaDetalleModal
        reserva={reservaDetalle}
        open={Boolean(reservaDetalle)}
        onClose={cerrarDetalle}
        formatHora={formatHora}
        onMarcarPresente={(id) => { cerrarDetalle(); cambiarEstado(id, 'CLIENTE_PRESENTE') }}
        onMarcarNoLlego={(id) => { cerrarDetalle(); cambiarEstado(id, 'NO_LLEGO') }}
        onEditar={handleEditarDesdeDetalle}
        onCancelar={(id) => { cerrarDetalle(); cambiarEstado(id, 'CANCELADA') }}
      />
    </div>
  )
}
