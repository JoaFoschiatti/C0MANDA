import { PlusIcon, Square2StackIcon } from '@heroicons/react/24/outline'

import { Button, PageHeader, Spinner } from '../../components/ui'
import ProductosGrid from '../../components/productos/ProductosGrid'
import ProductoFormModal from '../../components/productos/ProductoFormModal'
import VarianteFormModal from '../../components/productos/VarianteFormModal'
import AgruparVariantesModal from '../../components/productos/AgruparVariantesModal'
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
        <ProductoFormModal
          form={form}
          setForm={setForm}
          editando={editando}
          categorias={categorias}
          imagePreview={imagePreview}
          onImageChange={handleImageChange}
          onSubmit={handleSubmit}
          onClose={cerrarProductoModal}
        />
      )}

      {showVarianteModal && productoBase && (
        <VarianteFormModal
          productoBase={productoBase}
          varianteForm={varianteForm}
          setVarianteForm={setVarianteForm}
          onSubmit={handleCrearVariante}
          onClose={cerrarVarianteModal}
        />
      )}

      {showAgruparModal && (
        <AgruparVariantesModal
          agruparForm={agruparForm}
          setAgruparForm={setAgruparForm}
          productos={productos}
          productosDisponibles={productosDisponiblesParaAgrupar}
          onSubmit={handleAgruparVariantes}
          onClose={cerrarAgruparModal}
        />
      )}
    </div>
  )
}
