import { PlusIcon } from '@heroicons/react/24/outline'

import { Button, PageHeader, Spinner } from '../../components/ui'
import DescarteLoteModal from '../../components/ingredientes/DescarteLoteModal'
import IngredienteModal from '../../components/ingredientes/IngredienteModal'
import IngredientesTable from '../../components/ingredientes/IngredientesTable'
import MovimientoStockModal from '../../components/ingredientes/MovimientoStockModal'
import useIngredientesPage from '../../hooks/useIngredientesPage'

export default function Ingredientes() {
  const {
    abrirDescarte,
    abrirMovimiento,
    abrirNuevoIngrediente,
    cambiarSucursalActiva,
    cerrarDescarteModal,
    cerrarIngredienteModal,
    cerrarMovimientoModal,
    descarteForm,
    editando,
    form,
    formatFecha,
    getEstadoIngrediente,
    handleDescarte,
    handleEdit,
    handleMovimiento,
    handleSubmit,
    ingredienteEnfocadoId,
    ingredienteSeleccionado,
    ingredientes,
    loading,
    loteDescarteSeleccionado,
    lotesVencidosSeleccionados,
    movForm,
    setDescarteForm,
    setForm,
    setMovForm,
    showDescarteModal,
    showModal,
    showMovModal,
    stockBajo,
    sucursalActiva,
    sucursales,
  } = useIngredientesPage()

  if (loading && ingredientes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Ingredientes / Stock"
        actions={(
          <Button icon={PlusIcon} onClick={abrirNuevoIngrediente}>
            Nuevo Ingrediente
          </Button>
        )}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {sucursales.map((sucursal) => (
          <button
            key={sucursal.id}
            type="button"
            onClick={() => cambiarSucursalActiva(sucursal.id)}
            className={`btn ${sucursalActiva.id === sucursal.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {sucursal.nombre}
          </button>
        ))}
      </div>

      <IngredientesTable
        formatFecha={formatFecha}
        getEstadoIngrediente={getEstadoIngrediente}
        ingredienteEnfocadoId={ingredienteEnfocadoId}
        ingredientes={ingredientes}
        onAbrirDescarte={abrirDescarte}
        onAbrirMovimiento={abrirMovimiento}
        onEdit={handleEdit}
        stockBajo={stockBajo}
      />

      {showModal && (
        <IngredienteModal
          editando={editando}
          form={form}
          onClose={cerrarIngredienteModal}
          onSubmit={handleSubmit}
          setForm={setForm}
        />
      )}

      {showMovModal && (
        <MovimientoStockModal
          ingredienteSeleccionado={ingredienteSeleccionado}
          movForm={movForm}
          onClose={cerrarMovimientoModal}
          onSubmit={handleMovimiento}
          setMovForm={setMovForm}
        />
      )}

      {showDescarteModal && (
        <DescarteLoteModal
          descarteForm={descarteForm}
          ingredienteSeleccionado={ingredienteSeleccionado}
          loteDescarteSeleccionado={loteDescarteSeleccionado}
          lotesVencidosSeleccionados={lotesVencidosSeleccionados}
          onClose={cerrarDescarteModal}
          onSubmit={handleDescarte}
          setDescarteForm={setDescarteForm}
        />
      )}
    </div>
  )
}
