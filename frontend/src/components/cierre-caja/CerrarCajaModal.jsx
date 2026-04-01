const getDifferenceTone = (difference) => {
  if (difference === 0) {
    return 'text-success-600'
  }
  return difference > 0 ? 'text-info-600' : 'text-error-600'
}

const getDifferenceLabel = (difference) => {
  if (difference === 0) {
    return ' (Cuadra perfecto)'
  }
  return difference > 0 ? ' (Sobrante)' : ' (Faltante)'
}

export default function CerrarCajaModal({
  efectivoFisico,
  formatCurrency,
  observaciones,
  onClose,
  onSubmit,
  resumen,
  setEfectivoFisico,
  setObservaciones,
}) {
  const difference = efectivoFisico ? parseFloat(efectivoFisico) - resumen.efectivoEsperado : null

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg">
        <h3 className="mb-4 text-heading-3">Cerrar Caja</h3>

        <div className="mb-4 rounded-xl bg-surface-hover p-4">
          <h4 className="mb-3 font-medium text-text-primary">Resumen del Turno</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Fondo Inicial:</span>
              <span className="font-medium text-text-primary">{formatCurrency(resumen.fondoInicial)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Ventas Efectivo:</span>
              <span className="font-medium text-success-600">{formatCurrency(resumen.ventasEfectivo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Ventas MercadoPago:</span>
              <span className="font-medium text-warning-600">
                {formatCurrency(resumen.ventasMercadoPago)}
              </span>
            </div>
            <hr className="my-2 border-border-default" />
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Ventas:</span>
              <span className="font-bold text-text-primary">{formatCurrency(resumen.totalVentas)}</span>
            </div>
            <div className="-mx-2 flex justify-between rounded-lg bg-info-100 p-2">
              <span className="font-medium text-info-700">Efectivo Esperado:</span>
              <span className="font-bold text-info-700">{formatCurrency(resumen.efectivoEsperado)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label className="label" htmlFor="caja-efectivo-contado">
              Efectivo Contado (en caja)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
              <input
                id="caja-efectivo-contado"
                type="number"
                step="0.01"
                min="0"
                value={efectivoFisico}
                onChange={(event) => setEfectivoFisico(event.target.value)}
                className="input pl-8"
                placeholder="0"
                autoFocus
                required
              />
            </div>
            {difference !== null && (
              <p className={`mt-1 text-sm ${getDifferenceTone(difference)}`}>
                Diferencia: {formatCurrency(difference)}
                {getDifferenceLabel(difference)}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="caja-observaciones">
              Observaciones (opcional)
            </label>
            <textarea
              id="caja-observaciones"
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              className="input"
              rows="2"
              placeholder="Notas sobre el cierre..."
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Confirmar Cierre
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
