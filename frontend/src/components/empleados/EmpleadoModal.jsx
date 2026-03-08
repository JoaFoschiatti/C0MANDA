export default function EmpleadoModal({ editando, form, onClose, onSubmit, setForm }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="mb-4 text-heading-3">{editando ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="empleado-nombre">
                Nombre
              </label>
              <input
                id="empleado-nombre"
                type="text"
                className="input"
                value={form.nombre}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nombre: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="empleado-apellido">
                Apellido
              </label>
              <input
                id="empleado-apellido"
                type="text"
                className="input"
                value={form.apellido}
                onChange={(event) =>
                  setForm((current) => ({ ...current, apellido: event.target.value }))
                }
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="empleado-dni">
              DNI
            </label>
            <input
              id="empleado-dni"
              type="text"
              className="input"
              value={form.dni}
              onChange={(event) =>
                setForm((current) => ({ ...current, dni: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="empleado-telefono">
              TelÃ©fono
            </label>
            <input
              id="empleado-telefono"
              type="text"
              className="input"
              value={form.telefono}
              onChange={(event) =>
                setForm((current) => ({ ...current, telefono: event.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="empleado-rol">
                Rol
              </label>
              <select
                id="empleado-rol"
                className="input"
                value={form.rol}
                onChange={(event) =>
                  setForm((current) => ({ ...current, rol: event.target.value }))
                }
              >
                <option value="MOZO">Mozo</option>
                <option value="COCINERO">Cocinero</option>
                <option value="CAJERO">Cajero</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="empleado-tarifa">
                Tarifa por Hora ($)
              </label>
              <input
                id="empleado-tarifa"
                type="number"
                className="input"
                value={form.tarifaHora}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tarifaHora: event.target.value }))
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
