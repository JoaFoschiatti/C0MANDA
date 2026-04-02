import { useState } from 'react'
import clsx from 'clsx'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'

import { MESA_OPERATION_CARD_SIZE_CLASS, getMesaStatusUi } from '../../utils/mesa-status-ui'

export default function MesaOperationCard({
  mesa,
  secondaryText,
  reservaTooltip,
  onClick,
  className,
  overlay,
  forceOverlayVisible = false,
  mobileFill = false,
}) {
  const [overlayActive, setOverlayActive] = useState(false)
  const statusUi = getMesaStatusUi(mesa.estado)
  const overlayVisible = Boolean(overlay) && (forceOverlayVisible || overlayActive)

  return (
    <div
      id={`mesa-card-${mesa.id}`}
      data-estado={mesa.estado}
      className={clsx(
        'mesa-status-card mesa-status-card--interactive relative isolate flex shrink-0 flex-col overflow-hidden p-2.5 text-center sm:p-3',
        mobileFill ? 'w-full h-[8.75rem] sm:w-32 sm:h-32' : MESA_OPERATION_CARD_SIZE_CLASS,
        statusUi.themeClass,
        onClick && 'cursor-pointer',
        className
      )}
      onMouseEnter={overlay ? () => setOverlayActive(true) : undefined}
      onMouseLeave={overlay
        ? (event) => {
            if (event.currentTarget.contains(document.activeElement)) {
              return
            }

            setOverlayActive(false)
          }
        : undefined}
      onFocus={overlay ? () => setOverlayActive(true) : undefined}
      onBlur={overlay
        ? (event) => {
            if (event.currentTarget.contains(event.relatedTarget)) {
              return
            }

            setOverlayActive(false)
          }
        : undefined}
    >
      {onClick ? (
        <button
          type="button"
          aria-label={`Mesa ${mesa.numero} - ${statusUi.label}`}
          className="mesa-status-card-hitarea"
          onClick={onClick}
        />
      ) : null}

      {reservaTooltip && (
        <div
          className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-warning-500 p-1 text-white shadow-sm"
          title={reservaTooltip}
        >
          <CalendarDaysIcon className="w-4 h-4" />
        </div>
      )}

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center">
        <div className="text-[1.75rem] font-bold leading-none mesa-status-accent sm:text-[2rem]">
          {mesa.numero}
        </div>
        <div className="mt-1 text-[11px] font-medium mesa-status-muted">
          {mesa.capacidad} personas
        </div>
        <span className="mesa-status-pill mt-1.5 sm:mt-2">
          {statusUi.label}
        </span>
        {secondaryText ? (
          <div className="mt-auto w-full truncate pt-1.5 text-[11px] font-semibold mesa-status-note sm:pt-2">
            {secondaryText}
          </div>
        ) : (
          <div className="mt-auto h-[22px]" />
        )}
      </div>

      {overlayVisible ? (
        <div className="mesa-status-card-overlay">
          {overlay}
        </div>
      ) : null}
    </div>
  )
}
