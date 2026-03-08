import {
  PencilIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LinkSlashIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'

export default function ProductosGrid({
  expandedProducts,
  onCreateVariant,
  onDesagrupar,
  onEdit,
  onToggleDisponible,
  onToggleExpanded,
  productos,
}) {
  return (
    <div className="space-y-4">
      {productos.map((producto) => (
        <div
          key={producto.id}
          className={`card card-hover ${!producto.disponible ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {producto.variantes && producto.variantes.length > 0 && (
                <button
                  onClick={() => onToggleExpanded(producto.id)}
                  type="button"
                  className="p-1 hover:bg-surface-hover rounded transition-colors"
                  aria-label={`${expandedProducts[producto.id] ? 'Contraer' : 'Expandir'} variantes de ${producto.nombre}`}
                >
                  {expandedProducts[producto.id] ? (
                    <ChevronDownIcon className="w-5 h-5 text-text-tertiary" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-text-tertiary" />
                  )}
                </button>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text-primary">{producto.nombre}</h3>
                  {producto.productoBase && (
                    <span className="badge badge-info">
                      Variante de {producto.productoBase.nombre}
                    </span>
                  )}
                  {producto.variantes && producto.variantes.length > 0 && (
                    <span className="badge badge-info">
                      {producto.variantes.length} variante
                      {producto.variantes.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {producto.destacado && <span className="badge badge-warning">Destacado</span>}
                </div>
                <p className="text-sm text-text-secondary">{producto.categoria?.nombre}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-primary-500">
                ${parseFloat(producto.precio).toLocaleString('es-AR')}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => onToggleDisponible(producto)}
                  className={`badge cursor-pointer transition-colors ${
                    producto.disponible
                      ? 'badge-success hover:bg-success-200'
                      : 'badge-error hover:bg-error-200'
                  }`}
                >
                  {producto.disponible ? 'Disponible' : 'No disponible'}
                </button>

                {!producto.productoBase && (
                  <button
                    onClick={() => onCreateVariant(producto)}
                    type="button"
                    className="p-1.5 text-primary-500 hover:bg-primary-50 rounded transition-colors"
                    title="Crear variante"
                    aria-label={`Crear variante para ${producto.nombre}`}
                  >
                    <CubeIcon className="w-5 h-5" />
                  </button>
                )}

                {producto.productoBase && (
                  <button
                    onClick={() => onDesagrupar(producto.id)}
                    type="button"
                    className="p-1.5 text-warning-500 hover:bg-warning-50 rounded transition-colors"
                    title="Desagrupar variante"
                    aria-label={`Desagrupar variante ${producto.nombre}`}
                  >
                    <LinkSlashIcon className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={() => onEdit(producto)}
                  type="button"
                  className="p-1.5 text-primary-500 hover:bg-primary-50 rounded transition-colors"
                  aria-label={`Editar producto: ${producto.nombre}`}
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {producto.variantes &&
            producto.variantes.length > 0 &&
            expandedProducts[producto.id] && (
              <div className="mt-4 ml-8 border-l-2 border-border-default pl-4 space-y-3">
                {producto.variantes.map((variante) => (
                  <div
                    key={variante.id}
                    className={`flex items-center justify-between p-3 bg-surface-hover rounded-xl ${
                      !variante.disponible ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {variante.nombreVariante || variante.nombre}
                        </span>
                        {variante.esVariantePredeterminada && (
                          <span className="badge badge-success">Predeterminada</span>
                        )}
                        <span className="text-xs text-text-tertiary">
                          Multiplicador: {variante.multiplicadorInsumos}x
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary-500">
                        ${parseFloat(variante.precio).toLocaleString('es-AR')}
                      </span>
                      <button
                        onClick={() => onDesagrupar(variante.id)}
                        type="button"
                        className="p-1 text-warning-500 hover:bg-warning-50 rounded transition-colors"
                        title="Desagrupar"
                        aria-label={`Desagrupar variante ${variante.nombreVariante || variante.nombre}`}
                      >
                        <LinkSlashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      ))}
    </div>
  )
}
