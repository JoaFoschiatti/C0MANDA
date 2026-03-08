import { useDraggable } from '@dnd-kit/core'

const estadoClasses = {
  LIBRE: 'bg-success-100 border-success-300 text-success-800',
  OCUPADA: 'bg-error-100 border-error-300 text-error-800',
  RESERVADA: 'bg-warning-100 border-warning-300 text-warning-800',
  ESPERANDO_CUENTA: 'bg-amber-100 border-amber-300 text-amber-800',
  CERRADA: 'bg-slate-100 border-slate-300 text-slate-700',
}

export default function MesaChip({ mesa, isOverlay = false, reservaProxima, onPedirCuenta, grupoColor }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mesa-${mesa.id}`,
    data: { mesa },
    disabled: isOverlay,
  })

  const capacidad = mesa.capacidad || 4
  const esGrande = capacidad >= 6
  const width = esGrande ? 100 : 56
  const height = esGrande ? 48 : 56
  const rotacion = mesa.rotacion || 0

  const style = isOverlay
    ? { width, height, transform: `rotate(${rotacion}deg)` }
    : {
        position: 'absolute',
        left: mesa.posX ?? 0,
        top: mesa.posY ?? 0,
        width,
        height,
        transform: `rotate(${rotacion}deg)`,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 0 : 10,
      }

  const estadoClass = estadoClasses[mesa.estado] || 'bg-surface-secondary border-border-default text-text-secondary'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`
        flex flex-col items-center justify-center
        rounded-lg border-2 cursor-grab active:cursor-grabbing
        select-none text-center leading-tight
        transition-shadow hover:shadow-md
        ${estadoClass}
        ${grupoColor ? `ring-2 ring-offset-1 ${grupoColor}` : ''}
      `}
      title={`Mesa ${mesa.numero} - ${mesa.estado} (${capacidad}p)${reservaProxima ? ` | Reserva: ${reservaProxima.clienteNombre}` : ''}`}
    >
      <span className="font-bold text-sm leading-none">{mesa.numero}</span>
      <span className="text-[10px] opacity-70">{capacidad}p</span>

      {reservaProxima && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-warning-500 rounded-full border border-white" />
      )}

      {['OCUPADA', 'ESPERANDO_CUENTA'].includes(mesa.estado) && onPedirCuenta && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPedirCuenta(mesa)
          }}
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-[8px] px-1.5 py-0.5 rounded-full whitespace-nowrap hover:bg-primary-600 transition-colors"
        >
          Cuenta
        </button>
      )}
    </div>
  )
}
