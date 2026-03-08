export default function MovimientoStockModal({
  ingredienteSeleccionado,
  movForm,
  onClose,
  onSubmit,
  setMovForm,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-heading-3 mb-4">
          Movimiento de Stock: {ingredienteSeleccionado?.nombre}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="ingrediente-mov-tipo">
              Tipo de Movimiento
            </label>
            <select
              id="ingrediente-mov-tipo"
              className="input"
              value={movForm.tipo}
              onChange={(event) =>
                setMovForm((current) => ({
                  ...current,
                  tipo: event.target.value,
                  codigoLote: event.target.value === 'ENTRADA' ? current.codigoLote : '',
                  fechaVencimiento:
                    event.target.value === 'ENTRADA' ? current.fechaVencimiento : '',
                  costoUnitario:
                    event.target.value === 'ENTRADA' ? current.costoUnitario : '',
                }))
              }
            >
              <option value="ENTRADA">Entrada (Compra/Recepcion)</option>
              <option value="SALIDA">Salida (Merma/Perdida)</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ingrediente-mov-cantidad">
              Cantidad ({ingredienteSeleccionado?.unidad})
            </label>
            <input
              id="ingrediente-mov-cantidad"
              type="number"
              step="0.01"
              className="input"
              value={movForm.cantidad}
              onChange={(event) =>
                setMovForm((current) => ({ ...current, cantidad: event.target.value }))
              }
              required
            />
          </div>

          {movForm.tipo === 'ENTRADA' && (
            <>
              <div>
                <label className="label" htmlFor="ingrediente-mov-lote">
                  Codigo de lote
                </label>
                <input
                  id="ingrediente-mov-lote"
                  type="text"
                  className="input"
                  value={movForm.codigoLote}
                  onChange={(event) =>
                    setMovForm((current) => ({
                      ...current,
                      codigoLote: event.target.value,
                    }))
                  }
                  placeholder="Opcional. Si queda vacio, se genera uno automaticamente"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="ingrediente-mov-vencimiento">
                    Fecha de vencimiento
                  </label>
                  <input
                    id="ingrediente-mov-vencimiento"
                    type="date"
                    className="input"
                    value={movForm.fechaVencimiento}
                    onChange={(event) =>
                      setMovForm((current) => ({
                        ...current,
                        fechaVencimiento: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ingrediente-mov-costo">
                    Costo del lote ($)
                  </label>
                  <input
                    id="ingrediente-mov-costo"
                    type="number"
                    step="0.01"
                    className="input"
                    value={movForm.costoUnitario}
                    onChange={(event) =>
                      setMovForm((current) => ({
                        ...current,
                        costoUnitario: event.target.value,
                      }))
                    }
                    placeholder={
                      ingredienteSeleccionado?.costo
                        ? `Actual: ${ingredienteSeleccionado.costo}`
                        : 'Opcional'
                    }
                  />
                </div>
              </div>

              <p className="text-xs text-text-secondary">
                Las entradas con lote alimentan el descuento FIFO usado al pasar pedidos a
                preparacion.
              </p>
            </>
          )}

          <div>
            <label className="label" htmlFor="ingrediente-mov-motivo">
              Motivo
            </label>
            <input
              id="ingrediente-mov-motivo"
              type="text"
              className="input"
              value={movForm.motivo}
              onChange={(event) =>
                setMovForm((current) => ({ ...current, motivo: event.target.value }))
              }
              placeholder="Compra proveedor, merma, etc."
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
