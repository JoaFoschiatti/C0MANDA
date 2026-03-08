export default function LiquidacionModal({
  usuarioSeleccionado,
  usuarios,
  form,
  horas,
  onClose,
  onSubmit,
  setForm,
  subtotal,
  tarifaHora,
  totalPagar,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <h2 className="mb-4 text-heading-3">Nueva Liquidación</h2>
        <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto">
          <div>
            <label className="label" htmlFor="liquidacion-usuario">
              Usuario
            </label>
            <select
              id="liquidacion-usuario"
              className="input"
              value={form.usuarioId}
              onChange={(event) =>
                setForm((current) => ({ ...current, usuarioId: event.target.value }))
              }
              required
            >
              <option value="">Seleccionar...</option>
              {usuarios.map((usr) => (
                <option key={usr.id} value={usr.id}>
                  {usr.nombre} {usr.apellido || ''} - {usr.rol}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="liquidacion-desde">
                Período Desde
              </label>
              <input
                id="liquidacion-desde"
                type="date"
                className="input"
                value={form.periodoDesde}
                onChange={(event) =>
                  setForm((current) => ({ ...current, periodoDesde: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="liquidacion-hasta">
                Período Hasta
              </label>
              <input
                id="liquidacion-hasta"
                type="date"
                className="input"
                value={form.periodoHasta}
                onChange={(event) =>
                  setForm((current) => ({ ...current, periodoHasta: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="liquidacion-horas">
              Horas trabajadas
            </label>
            <input
              id="liquidacion-horas"
              type="number"
              className="input"
              placeholder="Ej: 160"
              min="0"
              step="0.5"
              value={form.horasTotales}
              onChange={(event) =>
                setForm((current) => ({ ...current, horasTotales: event.target.value }))
              }
              required
            />
          </div>

          {usuarioSeleccionado && horas > 0 && (
            <div className="space-y-2 rounded-xl bg-surface-hover p-4">
              <div className="flex justify-between text-text-secondary">
                <span>Horas trabajadas:</span>
                <span className="font-medium text-text-primary">{horas}h</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Tarifa/hora:</span>
                <span className="font-medium text-text-primary">
                  ${tarifaHora.toLocaleString('es-AR')}
                </span>
              </div>
              <hr className="border-border-default" />
              <div className="flex justify-between text-lg font-bold text-text-primary">
                <span>Subtotal:</span>
                <span>${subtotal.toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="liquidacion-descuentos">
                Descuentos ($)
              </label>
              <input
                id="liquidacion-descuentos"
                type="number"
                className="input"
                value={form.descuentos}
                onChange={(event) =>
                  setForm((current) => ({ ...current, descuentos: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="liquidacion-adicionales">
                Adicionales ($)
              </label>
              <input
                id="liquidacion-adicionales"
                type="number"
                className="input"
                value={form.adicionales}
                onChange={(event) =>
                  setForm((current) => ({ ...current, adicionales: event.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="liquidacion-observaciones">
              Observaciones
            </label>
            <textarea
              id="liquidacion-observaciones"
              className="input"
              value={form.observaciones}
              onChange={(event) =>
                setForm((current) => ({ ...current, observaciones: event.target.value }))
              }
              rows="2"
            />
          </div>

          {horas > 0 && (parseFloat(form.descuentos) > 0 || parseFloat(form.adicionales) > 0) && (
            <div className="rounded-xl bg-primary-50 p-4">
              <div className="flex justify-between text-lg font-bold text-primary-600">
                <span>TOTAL A PAGAR:</span>
                <span>${totalPagar.toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={!usuarioSeleccionado || horas <= 0}
            >
              Crear Liquidación
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
