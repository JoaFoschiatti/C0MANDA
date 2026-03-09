import { formatStock } from '../../constants/unidades'

export default function DescarteLoteModal({
  descarteForm,
  ingredienteSeleccionado,
  loteDescarteSeleccionado,
  lotesVencidosSeleccionados,
  onClose,
  onSubmit,
  setDescarteForm,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-heading-3 mb-4">
          Descartar lote vencido: {ingredienteSeleccionado?.nombre}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="ingrediente-descarte-lote">
              Lote vencido
            </label>
            <select
              id="ingrediente-descarte-lote"
              className="input"
              value={descarteForm.loteId}
              onChange={(event) => {
                const nextLote = lotesVencidosSeleccionados.find(
                  (lote) => String(lote.id) === event.target.value
                )
                setDescarteForm((current) => ({
                  ...current,
                  loteId: event.target.value,
                  cantidad: nextLote
                    ? String(formatStock(nextLote.stockActual, ingredienteSeleccionado?.unidad))
                    : current.cantidad,
                }))
              }}
            >
              {lotesVencidosSeleccionados.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.codigoLote} - {formatStock(lote.stockActual, ingredienteSeleccionado?.unidad)}{' '}
                  {ingredienteSeleccionado?.unidad}
                </option>
              ))}
            </select>
          </div>

          {loteDescarteSeleccionado && (
            <p className="text-sm text-text-secondary">
              Este lote ya no se puede consumir. El descarte requiere motivo y queda
              registrado como ajuste manual.
            </p>
          )}

          <div>
            <label className="label" htmlFor="ingrediente-descarte-cantidad">
              Cantidad a descartar ({ingredienteSeleccionado?.unidad})
            </label>
            <input
              id="ingrediente-descarte-cantidad"
              type="number"
              step="0.01"
              min="0.01"
              max={
                loteDescarteSeleccionado
                  ? parseFloat(loteDescarteSeleccionado.stockActual)
                  : undefined
              }
              className="input"
              value={descarteForm.cantidad}
              onChange={(event) =>
                setDescarteForm((current) => ({
                  ...current,
                  cantidad: event.target.value,
                }))
              }
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="ingrediente-descarte-motivo">
              Motivo del descarte
            </label>
            <input
              id="ingrediente-descarte-motivo"
              type="text"
              className="input"
              value={descarteForm.motivo}
              onChange={(event) =>
                setDescarteForm((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              placeholder="Vencimiento, control bromatologico, etc."
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              Confirmar descarte
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
