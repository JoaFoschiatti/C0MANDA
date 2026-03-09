import { UNIDADES, getDecimalesUnidad } from '../../constants/unidades'

export default function IngredienteModal({
  editando,
  form,
  onClose,
  onSubmit,
  setForm,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-heading-3 mb-4">
          {editando ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="ingrediente-nombre">
              Nombre
            </label>
            <input
              id="ingrediente-nombre"
              type="text"
              className="input"
              value={form.nombre}
              onChange={(event) =>
                setForm((current) => ({ ...current, nombre: event.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="ingrediente-unidad">
                Unidad
              </label>
              <select
                id="ingrediente-unidad"
                className="input"
                value={form.unidad}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unidad: event.target.value }))
                }
                required
              >
                <option value="">Seleccionar unidad</option>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ingrediente-costo">
                Costo Unitario ($)
              </label>
              <input
                id="ingrediente-costo"
                type="number"
                step="0.01"
                className="input"
                value={form.costo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, costo: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="ingrediente-stock-actual">
                Stock Actual
              </label>
              <input
                id="ingrediente-stock-actual"
                type="number"
                step={getDecimalesUnidad(form.unidad) > 0 ? '0.01' : '1'}
                className="input"
                value={form.stockActual}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stockActual: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="ingrediente-stock-minimo">
                Stock Minimo
              </label>
              <input
                id="ingrediente-stock-minimo"
                type="number"
                step={getDecimalesUnidad(form.unidad) > 0 ? '0.01' : '1'}
                className="input"
                value={form.stockMinimo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stockMinimo: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {editando ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
