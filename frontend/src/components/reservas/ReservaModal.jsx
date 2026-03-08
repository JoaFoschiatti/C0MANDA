export default function ReservaModal({
  formData,
  mesas,
  onClose,
  onSubmit,
  reservaEdit,
  setFormData,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="mb-4 text-heading-3">{reservaEdit ? 'Editar Reserva' : 'Nueva Reserva'}</h3>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="reserva-mesa">
              Mesa
            </label>
            <select
              id="reserva-mesa"
              value={formData.mesaId}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  mesaId: event.target.value,
                }))
              }
              className="input"
              required
              disabled={Boolean(reservaEdit)}
            >
              <option value="">Seleccionar mesa...</option>
              {mesas.map((mesa) => (
                <option key={mesa.id} value={mesa.id}>
                  Mesa {mesa.numero} {mesa.zona && `(${mesa.zona})`} - {mesa.capacidad} personas
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="reserva-fecha-hora">
              Fecha y Hora
            </label>
            <input
              id="reserva-fecha-hora"
              type="datetime-local"
              value={formData.fechaHora}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  fechaHora: event.target.value,
                }))
              }
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="reserva-cliente-nombre">
              Nombre del cliente
            </label>
            <input
              id="reserva-cliente-nombre"
              type="text"
              value={formData.clienteNombre}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  clienteNombre: event.target.value,
                }))
              }
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="reserva-cliente-telefono">
              Telefono (opcional)
            </label>
            <input
              id="reserva-cliente-telefono"
              type="tel"
              value={formData.clienteTelefono}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  clienteTelefono: event.target.value,
                }))
              }
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="reserva-cantidad-personas">
              Cantidad de personas
            </label>
            <input
              id="reserva-cantidad-personas"
              type="number"
              min="1"
              max="20"
              value={formData.cantidadPersonas}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  cantidadPersonas: Number.parseInt(event.target.value, 10) || '',
                }))
              }
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="reserva-observaciones">
              Observaciones (opcional)
            </label>
            <textarea
              id="reserva-observaciones"
              value={formData.observaciones}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  observaciones: event.target.value,
                }))
              }
              className="input"
              rows="2"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {reservaEdit ? 'Guardar Cambios' : 'Crear Reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
