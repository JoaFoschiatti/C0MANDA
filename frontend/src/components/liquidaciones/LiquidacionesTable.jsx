import { CheckIcon } from '@heroicons/react/24/outline'

export default function LiquidacionesTable({ liquidaciones, onMarcarPagada }) {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Período</th>
            <th>Horas</th>
            <th>Total</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {liquidaciones.map((liq) => (
            <tr key={liq.id}>
              <td>
                <div className="font-medium text-text-primary">
                  {liq.empleado?.nombre} {liq.empleado?.apellido}
                </div>
              </td>
              <td className="text-text-secondary">
                {new Date(liq.periodoDesde).toLocaleDateString('es-AR')} -
                {new Date(liq.periodoHasta).toLocaleDateString('es-AR')}
              </td>
              <td className="text-text-secondary">{parseFloat(liq.horasTotales).toFixed(1)}h</td>
              <td className="font-medium text-text-primary">
                ${parseFloat(liq.totalPagar).toLocaleString('es-AR')}
              </td>
              <td>
                <span className={`badge ${liq.pagado ? 'badge-success' : 'badge-warning'}`}>
                  {liq.pagado ? 'Pagado' : 'Pendiente'}
                </span>
              </td>
              <td className="text-right">
                {!liq.pagado && (
                  <button
                    onClick={() => onMarcarPagada(liq.id)}
                    className="text-success-500 transition-colors hover:text-success-600"
                    title="Marcar como pagada"
                    aria-label={`Marcar liquidación #${liq.id} como pagada`}
                  >
                    <CheckIcon className="h-5 w-5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
