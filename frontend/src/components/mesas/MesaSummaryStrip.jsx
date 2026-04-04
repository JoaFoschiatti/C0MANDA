import clsx from 'clsx'
import { getMesaStatusUi } from '../../utils/mesa-status-ui'

const COUNTERS = [
  { estado: 'OCUPADA', label: 'Ocupadas' },
  { estado: 'ESPERANDO_CUENTA', label: 'Cuenta' },
  { estado: 'RESERVADA', label: 'Reservadas' },
  { estado: 'LIBRE', label: 'Libres' },
]

export default function MesaSummaryStrip({ mesas, className }) {
  const counts = {}
  for (const mesa of mesas) {
    counts[mesa.estado] = (counts[mesa.estado] || 0) + 1
  }

  return (
    <div className={clsx('flex items-center gap-3 overflow-x-auto py-2 text-xs font-semibold', className)}>
      <span className="text-text-secondary whitespace-nowrap">{mesas.length} mesas</span>
      <span className="text-border-default">|</span>
      {COUNTERS.map(({ estado, label }) => {
        const count = counts[estado] || 0
        if (count === 0) return null

        const statusUi = getMesaStatusUi(estado)
        return (
          <div
            key={estado}
            className={clsx('flex items-center gap-1.5 whitespace-nowrap', statusUi.themeClass)}
          >
            <span className="mesa-status-swatch" aria-hidden="true" />
            <span className="mesa-status-accent">{count}</span>
            <span className="text-text-secondary">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
