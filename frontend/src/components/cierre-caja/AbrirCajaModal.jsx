export default function AbrirCajaModal({ fondoInicial, onClose, onSubmit, setFondoInicial }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="mb-4 text-heading-3">Abrir Caja</h3>
        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label className="label" htmlFor="caja-fondo-inicial">
              Fondo Inicial (efectivo en caja)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
              <input
                id="caja-fondo-inicial"
                type="number"
                step="0.01"
                min="0"
                value={fondoInicial}
                onChange={(event) => setFondoInicial(event.target.value)}
                className="input pl-8"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Abrir Caja
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
