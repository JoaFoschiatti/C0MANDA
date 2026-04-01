import { PhotoIcon } from '@heroicons/react/24/outline'

export default function ProductoFormModal({
  form, setForm, editando, categorias, imagePreview,
  onImageChange, onSubmit, onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-heading-3 mb-4">
          {editando ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="label" htmlFor="producto-nombre">Nombre</label>
            <input
              id="producto-nombre"
              type="text"
              className="input"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="producto-descripcion">Descripcion</label>
            <textarea
              id="producto-descripcion"
              className="input"
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              rows="3"
            />
          </div>

          <div>
            <label className="label" htmlFor="imagen-input">Imagen principal del producto</label>
            <p className="mt-1 text-sm text-text-secondary">
              Se mostrara en el catalogo del admin y en el menu publico.
            </p>
            <input
              type="file"
              id="imagen-input"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={onImageChange}
              className="hidden"
            />
            <label
              htmlFor="imagen-input"
              className="block cursor-pointer border border-dashed border-border-default rounded-xl p-4 hover:border-primary-400 transition-colors"
            >
              {imagePreview ? (
                <div className="flex flex-col items-center">
                  <img
                    src={imagePreview}
                    alt={`Preview de ${form.nombre || 'producto'}`}
                    className="w-32 h-32 object-cover rounded-xl mb-2"
                  />
                  <span className="text-sm text-text-secondary">
                    Vista previa disponible. Click para reemplazar imagen.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-text-tertiary">
                  <PhotoIcon className="w-12 h-12 mb-2" />
                  <span className="text-sm">Click para subir imagen principal</span>
                  <span className="text-xs mt-1">PNG, JPG, WebP (max. 5MB)</span>
                </div>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="producto-precio">Precio ($)</label>
              <input
                id="producto-precio"
                type="number"
                step="0.01"
                className="input"
                value={form.precio}
                onChange={(e) => setForm((prev) => ({ ...prev, precio: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="producto-categoria">Categoria</label>
              <select
                id="producto-categoria"
                className="input"
                value={form.categoriaId}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({
                    ...prev,
                    categoriaId: value === '' ? '' : parseInt(value, 10),
                  }))
                }}
                required
              >
                <option value="">Seleccionar...</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.disponible}
                onChange={(e) => setForm((prev) => ({ ...prev, disponible: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Disponible</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.destacado}
                onChange={(e) => setForm((prev) => ({ ...prev, destacado: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Destacado</span>
            </label>
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
