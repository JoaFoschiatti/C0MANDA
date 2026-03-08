import { PlusIcon } from '@heroicons/react/24/outline'

import EmpleadoModal from '../../components/empleados/EmpleadoModal'
import EmpleadosTable from '../../components/empleados/EmpleadosTable'
import { Button, PageHeader, Spinner } from '../../components/ui'
import useEmpleadosPage from '../../hooks/useEmpleadosPage'

export default function Empleados() {
  const {
    abrirNuevoEmpleado,
    cerrarModal,
    editando,
    empleados,
    form,
    handleDelete,
    handleEdit,
    handleSubmit,
    loading,
    setForm,
    showModal,
  } = useEmpleadosPage()

  if (loading && empleados.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" label="Cargando empleados..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Empleados"
        actions={(
          <Button onClick={abrirNuevoEmpleado} icon={PlusIcon}>
            Nuevo Empleado
          </Button>
        )}
      />

      <EmpleadosTable empleados={empleados} onDelete={handleDelete} onEdit={handleEdit} />

      {showModal && (
        <EmpleadoModal
          editando={editando}
          form={form}
          onClose={cerrarModal}
          onSubmit={handleSubmit}
          setForm={setForm}
        />
      )}
    </div>
  )
}
