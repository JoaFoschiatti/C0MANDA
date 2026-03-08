import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

const getRolBadge = (rol) => {
  switch (rol) {
    case 'COCINERO':
      return 'badge-warning'
    case 'MOZO':
      return 'badge-info'
    case 'CAJERO':
      return 'badge-success'
    default:
      return 'badge-info'
  }
}

export default function EmpleadosTable({ empleados, onDelete, onEdit }) {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>DNI</th>
            <th>Rol</th>
            <th>Tarifa/Hora</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((empleado) => (
            <tr key={empleado.id}>
              <td>
                <div className="font-medium text-text-primary">
                  {empleado.nombre} {empleado.apellido}
                </div>
                <div className="text-sm text-text-tertiary">{empleado.telefono}</div>
              </td>
              <td className="text-text-secondary">{empleado.dni}</td>
              <td>
                <span className={`badge ${getRolBadge(empleado.rol)}`}>{empleado.rol}</span>
              </td>
              <td className="text-text-primary">
                ${parseFloat(empleado.tarifaHora).toLocaleString('es-AR')}
              </td>
              <td>
                <span className={`badge ${empleado.activo ? 'badge-success' : 'badge-error'}`}>
                  {empleado.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="space-x-2 text-right">
                <button
                  onClick={() => onEdit(empleado)}
                  type="button"
                  aria-label={`Editar empleado: ${empleado.nombre} ${empleado.apellido}`}
                  className="text-primary-500 transition-colors hover:text-primary-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(empleado.id)}
                  type="button"
                  aria-label={`Desactivar empleado: ${empleado.nombre} ${empleado.apellido}`}
                  className="text-error-500 transition-colors hover:text-error-600"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
