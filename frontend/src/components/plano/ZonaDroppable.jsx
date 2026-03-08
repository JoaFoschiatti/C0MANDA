import { useDroppable } from '@dnd-kit/core'
import MesaChip from './MesaChip'
import ParedSVG from './ParedSVG'

export default function ZonaDroppable({
  zona,
  mesas,
  paredes,
  reservasProximas = [],
  grupoColores = {},
  onPedirCuenta,
  mostrarParedes,
  onParedesChange,
  dibujarPared,
  onDibujarParedChange,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zona-${zona}`,
    data: { zona },
  })

  const mesasEnZona = mesas.filter((m) => (m.zona || 'Interior') === zona)

  const getReservaProxima = (mesaId) => {
    return reservasProximas.find((r) => r.mesaId === mesaId)
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        relative w-full bg-surface-primary border-2 border-dashed rounded-xl overflow-hidden
        transition-colors
        ${isOver ? 'border-primary-400 bg-primary-50/50' : 'border-border-default'}
      `}
      style={{ height: 500 }}
    >
      {/* Etiqueta de zona */}
      <div className="absolute top-2 left-3 text-xs font-medium text-text-tertiary uppercase tracking-wider z-20 pointer-events-none">
        {zona}
      </div>

      {/* Paredes SVG */}
      {mostrarParedes && (
        <ParedSVG
          paredes={paredes}
          onChange={onParedesChange}
          dibujar={dibujarPared}
          onDibujarChange={onDibujarParedChange}
        />
      )}

      {/* Mesas */}
      {mesasEnZona.map((mesa) => (
        <MesaChip
          key={mesa.id}
          mesa={mesa}
          reservaProxima={getReservaProxima(mesa.id)}
          grupoColor={grupoColores[mesa.grupoMesaId]}
          onPedirCuenta={onPedirCuenta}
        />
      ))}

      {/* Mesas sin posición (stack en esquina) */}
      <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 z-20">
        {mesasEnZona
          .filter((m) => m.posX == null || m.posY == null)
          .map((mesa) => (
            <div
              key={`unplaced-${mesa.id}`}
              className="text-[10px] bg-surface-secondary text-text-tertiary px-1.5 py-0.5 rounded border border-border-subtle"
            >
              Mesa {mesa.numero} (sin ubicar)
            </div>
          ))}
      </div>
    </div>
  )
}
