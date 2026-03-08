export default function AgruparVariantesModal({
  agruparForm, setAgruparForm, productos, productosDisponibles,
  onSubmit, onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <h2 className="text-heading-3 mb-4">Agrupar Productos como Variantes</h2>
        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="label" htmlFor="agrupar-producto-base">Producto Base *</label>
            <select
              id="agrupar-producto-base"
              className="input"
              value={agruparForm.productoBaseId}
              onChange={(e) =>
                setAgruparForm((prev) => ({
                  ...prev,
                  productoBaseId: e.target.value,
                  productosSeleccionados: [],
                }))
              }
              required
            >
              <option value="">Seleccionar producto base...</option>
              {productos
                .filter((p) => !p.productoBaseId)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
            </select>
            <p className="input-hint">
              Este sera el producto principal que agrupa las variantes
            </p>
          </div>

          {agruparForm.productoBaseId && (
            <div>
              <label className="label">Seleccionar Variantes</label>
              <div className="border border-border-default rounded-xl max-h-60 overflow-y-auto">
                {productosDisponibles.map((producto) => {
                  const isSelected = agruparForm.productosSeleccionados.some(
                    (item) => item.id === producto.id
                  )
                  const selectedProd = agruparForm.productosSeleccionados.find(
                    (item) => item.id === producto.id
                  )

                  return (
                    <div
                      key={producto.id}
                      className={`p-3 border-b border-border-default last:border-b-0 ${
                        isSelected ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${producto.nombre} como variante`}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAgruparForm((prev) => ({
                                ...prev,
                                productosSeleccionados: [
                                  ...prev.productosSeleccionados,
                                  {
                                    id: producto.id,
                                    nombre: producto.nombre,
                                    nombreVariante: '',
                                    multiplicadorInsumos: '1.0',
                                  },
                                ],
                              }))
                              return
                            }
                            setAgruparForm((prev) => ({
                              ...prev,
                              productosSeleccionados: prev.productosSeleccionados.filter(
                                (item) => item.id !== producto.id
                              ),
                            }))
                          }}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-text-primary">{producto.nombre}</span>
                          <span className="text-sm text-text-secondary ml-2">
                            ${parseFloat(producto.precio).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="input text-sm"
                            aria-label={`Nombre de variante para ${producto.nombre}`}
                            placeholder="Nombre variante (ej: Doble)"
                            value={selectedProd?.nombreVariante || ''}
                            onChange={(e) =>
                              setAgruparForm((prev) => ({
                                ...prev,
                                productosSeleccionados: prev.productosSeleccionados.map((item) =>
                                  item.id === producto.id
                                    ? { ...item, nombreVariante: e.target.value }
                                    : item
                                ),
                              }))
                            }
                          />
                          <input
                            type="number"
                            step="0.1"
                            className="input text-sm"
                            aria-label={`Multiplicador de insumos para ${producto.nombre}`}
                            placeholder="Multiplicador"
                            value={selectedProd?.multiplicadorInsumos || '1.0'}
                            onChange={(e) =>
                              setAgruparForm((prev) => ({
                                ...prev,
                                productosSeleccionados: prev.productosSeleccionados.map((item) =>
                                  item.id === producto.id
                                    ? { ...item, multiplicadorInsumos: e.target.value }
                                    : item
                                ),
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
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
              disabled={
                !agruparForm.productoBaseId ||
                agruparForm.productosSeleccionados.length === 0
              }
            >
              Agrupar Variantes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
