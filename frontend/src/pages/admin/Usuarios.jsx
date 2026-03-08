import { PlusIcon } from '@heroicons/react/24/outline'

import UsuarioModal from '../../components/usuarios/UsuarioModal'
import UsuariosTable from '../../components/usuarios/UsuariosTable'
import { Button, PageHeader, Spinner } from '../../components/ui'
import useUsuariosPage from '../../hooks/useUsuariosPage'

export default function Usuarios() {
  const {
    abrirNuevoUsuario,
    cerrarModal,
    editando,
    usuarios,
    form,
    handleToggleActivo,
    handleEdit,
    handleSubmit,
    loading,
    setForm,
    showModal,
  } = useUsuariosPage()

  if (loading && usuarios.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" label="Cargando usuarios..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        actions={(
          <Button onClick={abrirNuevoUsuario} icon={PlusIcon}>
            Nuevo Usuario
          </Button>
        )}
      />

      <UsuariosTable usuarios={usuarios} onEdit={handleEdit} onToggleActivo={handleToggleActivo} />

      {showModal && (
        <UsuarioModal
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
