import { CalendarDaysIcon } from '@heroicons/react/24/outline'

export default function ReservasFilterBar({ fechaFiltro, reservasCount, setFechaFiltro }) {
  return (
    <div className="card mb-6">
      <div className="flex items-center gap-4">
        <CalendarDaysIcon className="h-5 w-5 text-text-tertiary" />
        <label htmlFor="reservas-fecha" className="sr-only">
          Fecha
        </label>
        <input
          id="reservas-fecha"
          type="date"
          value={fechaFiltro}
          onChange={(event) => setFechaFiltro(event.target.value)}
          className="input max-w-xs"
        />
        <span className="text-sm text-text-secondary">{reservasCount} reservas</span>
      </div>
    </div>
  )
}
