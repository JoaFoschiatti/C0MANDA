import { PlusIcon, Square2StackIcon, PhotoIcon } from '@heroicons/react/24/outline'

import { Button, PageHeader, Spinner } from '../../components/ui'
import ProductosGrid from '../../components/productos/ProductosGrid'
import useProductosPage from '../../hooks/useProductosPage'

export default function Productos() {
  const {
    agruparForm,
    categorias,
    cerrarAgruparModal,
    cerrarProductoModal,
    cerrarVarianteModal,
    editando,
    expandedProducts,
    form,
    handleAgruparVariantes,
    handleCrearVariante,
    handleDesagrupar,
    handleEdit,
    handleImageChange,
    handleSubmit,
    handleToggleDisponible,
    imagePreview,
    loading,
    openVarianteModal,
    productoBase,
    productos,
    productosDisponiblesParaAgrupar,
    setAgruparForm,
    setForm,
    setShowAgruparModal,
    setVarianteForm,
    setVistaAgrupada,
    showAgruparModal,
    showModal,
    showVarianteModal,
    toggleExpanded,
    abrirNuevoProducto,
    varianteForm,
    vistaAgrupada,
  } = useProductosPage()

  if (loading && productos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Cargando productos..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        eyebrow="Catalogo"
        description="Gestion del menu, variantes y disponibilidad del salon."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAgruparModal(true)}
              icon={Square2StackIcon}
            >
              Agrupar Variantes
            </Button>
            <Button onClick={abrirNuevoProducto} icon={PlusIcon}>
              Nuevo Producto
            </Button>
          </div>
        }
      />

      <div className="tabs mb-6">
        <button
          onClick={() => setVistaAgrupada(true)}
          className={`tab ${vistaAgrupada ? 'active' : ''}`}
        >
          Vista agrupada
        </button>
        <button
          onClick={() => setVistaAgrupada(false)}
          className={`tab ${!vistaAgrupada ? 'active' : ''}`}
        >
          Vista plana
        </button>
      </div>

      <ProductosGrid
        expandedProducts={expandedProducts}
        onCreateVariant={openVarianteModal}
        onDesagrupar={handleDesagrupar}
        onEdit={handleEdit}
        onToggleDisponible={handleToggleDisponible}
        onToggleExpanded={toggleExpanded}
        productos={productos}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">
              {editando ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label" htmlFor="producto-nombre">
                  Nombre
                </label>
                <input
                  id="producto-nombre"
                  type="text"
                  className="input"
                  value={form.nombre}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="producto-descripcion">
                  Descripcion
                </label>
                <textarea
                  id="producto-descripcion"
                  className="input"
                  value={form.descripcion}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, descripcion: event.target.value }))
                  }
                  rows="3"
                />
              </div>

              <div>
                <label className="label" htmlFor="imagen-input">
                  Imagen
                </label>
                <input
                  type="file"
                  id="imagen-input"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
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
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-xl mb-2"
                      />
                      <span className="text-sm text-text-secondary">
                        Click para cambiar imagen
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-text-tertiary">
                      <PhotoIcon className="w-12 h-12 mb-2" />
                      <span className="text-sm">Click para subir imagen</span>
                      <span className="text-xs mt-1">PNG, JPG, WebP (max. 5MB)</span>
                    </div>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="producto-precio">
                    Precio ($)
                  </label>
                  <input
                    id="producto-precio"
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.precio}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, precio: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="producto-categoria">
                    Categoria
                  </label>
                  <select
                    id="producto-categoria"
                    className="input"
                    value={form.categoriaId}
                    onChange={(event) => {
                      const value = event.target.value
                      setForm((prev) => ({
                        ...prev,
                        categoriaId: value === '' ? '' : parseInt(value, 10),
                      }))
                    }}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.disponible}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, disponible: event.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Disponible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.destacado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, destacado: event.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Destacado</span>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={cerrarProductoModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVarianteModal && productoBase && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-2">Crear Variante</h2>
            <p className="text-sm text-text-secondary mb-4">
              Variante de: <span className="font-medium text-text-primary">{productoBase.nombre}</span>
            </p>
            <form onSubmit={handleCrearVariante} className="space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label" htmlFor="variante-nombre">
                  Nombre de la Variante *
                </label>
                <input
                  id="variante-nombre"
                  type="text"
                  className="input"
                  value={varianteForm.nombreVariante}
                  onChange={(event) =>
                    setVarianteForm((prev) => ({
                      ...prev,
                      nombreVariante: event.target.value,
                    }))
                  }
                  placeholder="Ej: Simple, Doble, Triple"
                  required
                />
                <p className="input-hint">
                  Se mostrara como: {productoBase.nombre} {varianteForm.nombreVariante}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="variante-precio">
                    Precio ($) *
                  </label>
                  <input
                    id="variante-precio"
                    type="number"
                    step="0.01"
                    className="input"
                    value={varianteForm.precio}
                    onChange={(event) =>
                      setVarianteForm((prev) => ({ ...prev, precio: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="variante-multiplicador">
                    Multiplicador Insumos
                  </label>
                  <input
                    id="variante-multiplicador"
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="input"
                    value={varianteForm.multiplicadorInsumos}
                    onChange={(event) =>
                      setVarianteForm((prev) => ({
                        ...prev,
                        multiplicadorInsumos: event.target.value,
                      }))
                    }
                  />
                  <p className="input-hint">1.0 = igual, 2.0 = doble insumos</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="variante-orden">
                    Orden
                  </label>
                  <input
                    id="variante-orden"
                    type="number"
                    className="input"
                    value={varianteForm.ordenVariante}
                    onChange={(event) =>
                      setVarianteForm((prev) => ({
                        ...prev,
                        ordenVariante: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={varianteForm.esVariantePredeterminada}
                      onChange={(event) =>
                        setVarianteForm((prev) => ({
                          ...prev,
                          esVariantePredeterminada: event.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Predeterminada</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="variante-descripcion">
                  Descripcion (opcional)
                </label>
                <textarea
                  id="variante-descripcion"
                  className="input"
                  value={varianteForm.descripcion}
                  onChange={(event) =>
                    setVarianteForm((prev) => ({
                      ...prev,
                      descripcion: event.target.value,
                    }))
                  }
                  rows="2"
                  placeholder="Dejar vacio para usar la del producto base"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={cerrarVarianteModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Crear Variante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAgruparModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <h2 className="text-heading-3 mb-4">Agrupar Productos como Variantes</h2>
            <form onSubmit={handleAgruparVariantes} className="space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label" htmlFor="agrupar-producto-base">
                  Producto Base *
                </label>
                <select
                  id="agrupar-producto-base"
                  className="input"
                  value={agruparForm.productoBaseId}
                  onChange={(event) =>
                    setAgruparForm((prev) => ({
                      ...prev,
                      productoBaseId: event.target.value,
                      productosSeleccionados: [],
                    }))
                  }
                  required
                >
                  <option value="">Seleccionar producto base...</option>
                  {productos
                    .filter((producto) => !producto.productoBaseId)
                    .map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </option>
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
                    {productosDisponiblesParaAgrupar.map((producto) => {
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
                              onChange={(event) => {
                                if (event.target.checked) {
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
                                onChange={(event) =>
                                  setAgruparForm((prev) => ({
                                    ...prev,
                                    productosSeleccionados: prev.productosSeleccionados.map((item) =>
                                      item.id === producto.id
                                        ? { ...item, nombreVariante: event.target.value }
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
                                onChange={(event) =>
                                  setAgruparForm((prev) => ({
                                    ...prev,
                                    productosSeleccionados: prev.productosSeleccionados.map((item) =>
                                      item.id === producto.id
                                        ? { ...item, multiplicadorInsumos: event.target.value }
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
                <button
                  type="button"
                  onClick={cerrarAgruparModal}
                  className="btn btn-secondary flex-1"
                >
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
      )}
    </div>
  )
}
