export default function UsuarioModal({ editando, form, onClose, onSubmit, setForm }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="mb-4 text-heading-3">{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="usuario-nombre">Nombre *</label>
              <input
                id="usuario-nombre"
                type="text"
                className="input"
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="usuario-apellido">Apellido</label>
              <input
                id="usuario-apellido"
                type="text"
                className="input"
                value={form.apellido}
                onChange={(e) => setForm((prev) => ({ ...prev, apellido: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="usuario-email">Email *</label>
            <input
              id="usuario-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          {!editando && (
            <div>
              <label className="label" htmlFor="usuario-password">Password *</label>
              <input
                id="usuario-password"
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                minLength={6}
                required
              />
              <p className="input-hint">Minimo 6 caracteres</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="usuario-dni">DNI</label>
            <input
              id="usuario-dni"
              type="text"
              className="input"
              value={form.dni}
              onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="usuario-telefono">Telefono</label>
              <input
                id="usuario-telefono"
                type="text"
                className="input"
                value={form.telefono}
                onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="usuario-direccion">Direccion</label>
              <input
                id="usuario-direccion"
                type="text"
                className="input"
                value={form.direccion}
                onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="usuario-rol">Rol *</label>
              <select
                id="usuario-rol"
                className="input"
                value={form.rol}
                onChange={(e) => setForm((prev) => ({ ...prev, rol: e.target.value }))}
              >
                <option value="ADMIN">Administrador</option>
                <option value="MOZO">Mozo</option>
                <option value="COCINERO">Cocinero</option>
                <option value="CAJERO">Cajero</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="usuario-tarifa">Tarifa/Hora ($)</label>
              <input
                id="usuario-tarifa"
                type="number"
                step="0.01"
                className="input"
                value={form.tarifaHora}
                onChange={(e) => setForm((prev) => ({ ...prev, tarifaHora: e.target.value }))}
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
