export default function TransaccionesFilters({ filtros, onClear, showFiltros, updateFiltros }) {
  if (!showFiltros) {
    return null
  }

  return (
    <div className="card mb-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label className="label" htmlFor="tx-desde">
            Desde
          </label>
          <input
            id="tx-desde"
            type="date"
            value={filtros.desde}
            onChange={(event) => updateFiltros((current) => ({ ...current, desde: event.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="tx-hasta">
            Hasta
          </label>
          <input
            id="tx-hasta"
            type="date"
            value={filtros.hasta}
            onChange={(event) => updateFiltros((current) => ({ ...current, hasta: event.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="tx-estado">
            Estado
          </label>
          <select
            id="tx-estado"
            value={filtros.status}
            onChange={(event) => updateFiltros((current) => ({ ...current, status: event.target.value }))}
            className="input"
          >
            <option value="">Todos</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
            <option value="pending">Pendientes</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={onClear} className="btn btn-secondary w-full">
            Limpiar Filtros
          </button>
        </div>
      </div>
    </div>
  )
}
