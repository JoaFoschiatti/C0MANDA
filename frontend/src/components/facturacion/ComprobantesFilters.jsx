export default function ComprobantesFilters({ filtros, onClear, showFiltros, updateFiltros }) {
  if (!showFiltros) {
    return null
  }

  return (
    <div className="card mb-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div>
          <label className="label" htmlFor="fc-desde">
            Desde
          </label>
          <input
            id="fc-desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => updateFiltros((c) => ({ ...c, desde: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="fc-hasta">
            Hasta
          </label>
          <input
            id="fc-hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => updateFiltros((c) => ({ ...c, hasta: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="fc-estado">
            Estado
          </label>
          <select
            id="fc-estado"
            value={filtros.estado}
            onChange={(e) => updateFiltros((c) => ({ ...c, estado: e.target.value }))}
            className="input"
          >
            <option value="">Todos</option>
            <option value="AUTORIZADO">Autorizado</option>
            <option value="AUTORIZADO_CON_OBSERVACIONES">Autorizado (obs.)</option>
            <option value="PENDIENTE_ENVIO">Pendiente</option>
            <option value="PENDIENTE_CONFIGURACION_ARCA">Config. pendiente</option>
            <option value="RECHAZADO_ARCA">Rechazado</option>
            <option value="ERROR_ARCA">Error</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fc-tipo">
            Tipo
          </label>
          <select
            id="fc-tipo"
            value={filtros.tipoComprobante}
            onChange={(e) => updateFiltros((c) => ({ ...c, tipoComprobante: e.target.value }))}
            className="input"
          >
            <option value="">Todos</option>
            <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
            <option value="FACTURA_A">Factura A</option>
            <option value="FACTURA_B">Factura B</option>
            <option value="FACTURA_C">Factura C</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={onClear} className="btn btn-secondary w-full">
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}
