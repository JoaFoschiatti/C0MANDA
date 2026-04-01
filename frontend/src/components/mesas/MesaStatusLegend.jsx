import clsx from 'clsx'
import { MESA_STATUS_ORDER, getMesaStatusUi } from '../../utils/mesa-status-ui'

export default function MesaStatusLegend({ className }) {
  return (
    <div className={clsx('flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary', className)}>
      {MESA_STATUS_ORDER.map((estado) => {
        const statusUi = getMesaStatusUi(estado)

        return (
          <div key={estado} className={clsx('flex items-center gap-2', statusUi.themeClass)}>
            <span className="mesa-status-swatch" aria-hidden="true" />
            <span>{statusUi.label}</span>
          </div>
        )
      })}
    </div>
  )
}
