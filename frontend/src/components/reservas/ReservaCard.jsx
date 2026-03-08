import {
  CheckCircleIcon,
  PencilIcon,
  PhoneIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

const getEstadoBadge = (estado) => {
  switch (estado) {
    case 'CONFIRMADA':
      return 'badge-info'
    case 'CLIENTE_PRESENTE':
      return 'badge-success'
    case 'NO_LLEGO':
      return 'badge-error'
    case 'CANCELADA':
      return 'badge-warning'
    default:
      return 'badge-info'
  }
}

const getEstadoLabel = (estado) => {
  switch (estado) {
    case 'CONFIRMADA':
      return 'Confirmada'
    case 'CLIENTE_PRESENTE':
      return 'Presente'
    case 'NO_LLEGO':
      return 'No llego'
    case 'CANCELADA':
      return 'Cancelada'
    default:
      return estado
  }
}

export default function ReservaCard({
  formatHora,
  onCancelar,
  onEditar,
  onMarcarNoLlego,
  onMarcarPresente,
  reserva,
}) {
  return (
    <div
      className={`card card-hover ${
        reserva.estado === 'CANCELADA' || reserva.estado === 'NO_LLEGO' ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="text-2xl font-bold text-primary-500">{formatHora(reserva.fechaHora)}</span>
          <p className="text-sm text-text-secondary">
            Mesa {reserva.mesa.numero}
            {reserva.mesa.zona && ` - ${reserva.mesa.zona}`}
          </p>
        </div>
        <span className={`badge ${getEstadoBadge(reserva.estado)}`}>{getEstadoLabel(reserva.estado)}</span>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <UserIcon className="h-4 w-4 text-text-tertiary" />
          <span className="font-medium text-text-primary">{reserva.clienteNombre}</span>
        </div>
        {reserva.clienteTelefono && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <PhoneIcon className="h-4 w-4 text-text-tertiary" />
            {reserva.clienteTelefono}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <UsersIcon className="h-4 w-4 text-text-tertiary" />
          {reserva.cantidadPersonas} personas
        </div>
        {reserva.observaciones && (
          <p className="text-sm italic text-text-tertiary">"{reserva.observaciones}"</p>
        )}
      </div>

      {reserva.estado === 'CONFIRMADA' && (
        <div className="flex gap-2 border-t border-border-default pt-3">
          <button onClick={() => onMarcarPresente(reserva.id)} className="btn btn-success flex-1 py-2 text-sm">
            <CheckCircleIcon className="mr-1 h-4 w-4" />
            Llego
          </button>
          <button onClick={() => onMarcarNoLlego(reserva.id)} className="btn btn-secondary flex-1 py-2 text-sm">
            <XCircleIcon className="mr-1 h-4 w-4" />
            No llego
          </button>
          <button
            onClick={() => onEditar(reserva)}
            className="btn btn-secondary px-2 py-2 text-sm"
            title="Editar"
            aria-label={`Editar reserva: ${reserva.clienteNombre}`}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onCancelar(reserva.id)}
            className="btn btn-danger px-2 py-2 text-sm"
            title="Cancelar"
            aria-label={`Cancelar reserva: ${reserva.clienteNombre}`}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
