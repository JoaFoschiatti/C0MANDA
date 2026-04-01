import { PencilIcon } from '@heroicons/react/24/outline'

const ROL_BADGE = {
  ADMIN: 'badge-error',
  COCINERO: 'badge-warning',
  MOZO: 'badge-info',
  CAJERO: 'badge-success',
  DELIVERY: 'badge-info',
}

export default function UsuariosTable({ usuarios, onEdit, onToggleActivo }) {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td>
                <div className="font-medium text-text-primary">
                  {usuario.nombre} {usuario.apellido || ''}
                </div>
                {usuario.dni && (
                  <div className="text-sm text-text-tertiary">DNI: {usuario.dni}</div>
                )}
              </td>
              <td className="text-text-secondary">{usuario.email}</td>
              <td>
                <span className={`badge ${ROL_BADGE[usuario.rol] || 'badge-info'}`}>
                  {usuario.rol}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => onToggleActivo(usuario)}
                  className={`badge cursor-pointer ${usuario.activo ? 'badge-success' : 'badge-error'}`}
                >
                  {usuario.activo ? 'Activo' : 'Inactivo'}
                </button>
              </td>
              <td className="text-right">
                <button
                  onClick={() => onEdit(usuario)}
                  type="button"
                  aria-label={`Editar usuario: ${usuario.nombre}`}
                  title="Editar"
                  className="text-primary-500 transition-colors hover:text-primary-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
