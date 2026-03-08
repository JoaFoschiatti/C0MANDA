export default function VarianteFormModal({
  productoBase, varianteForm, setVarianteForm, onSubmit, onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-heading-3 mb-2">Crear Variante</h2>
        <p className="text-sm text-text-secondary mb-4">
          Variante de: <span className="font-medium text-text-primary">{productoBase.nombre}</span>
        </p>
        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="label" htmlFor="variante-nombre">Nombre de la Variante *</label>
            <input
              id="variante-nombre"
              type="text"
              className="input"
              value={varianteForm.nombreVariante}
              onChange={(e) => setVarianteForm((prev) => ({ ...prev, nombreVariante: e.target.value }))}
              placeholder="Ej: Simple, Doble, Triple"
              required
            />
            <p className="input-hint">
              Se mostrara como: {productoBase.nombre} {varianteForm.nombreVariante}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="variante-precio">Precio ($) *</label>
              <input
                id="variante-precio"
                type="number"
                step="0.01"
                className="input"
                value={varianteForm.precio}
                onChange={(e) => setVarianteForm((prev) => ({ ...prev, precio: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="variante-multiplicador">Multiplicador Insumos</label>
              <input
                id="variante-multiplicador"
                type="number"
                step="0.1"
                min="0.1"
                className="input"
                value={varianteForm.multiplicadorInsumos}
                onChange={(e) => setVarianteForm((prev) => ({ ...prev, multiplicadorInsumos: e.target.value }))}
              />
              <p className="input-hint">1.0 = igual, 2.0 = doble insumos</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="variante-orden">Orden</label>
              <input
                id="variante-orden"
                type="number"
                className="input"
                value={varianteForm.ordenVariante}
                onChange={(e) => setVarianteForm((prev) => ({ ...prev, ordenVariante: e.target.value }))}
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={varianteForm.esVariantePredeterminada}
                  onChange={(e) => setVarianteForm((prev) => ({ ...prev, esVariantePredeterminada: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Predeterminada</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="variante-descripcion">Descripcion (opcional)</label>
            <textarea
              id="variante-descripcion"
              className="input"
              value={varianteForm.descripcion}
              onChange={(e) => setVarianteForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              rows="2"
              placeholder="Dejar vacio para usar la del producto base"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              Crear Variante
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
