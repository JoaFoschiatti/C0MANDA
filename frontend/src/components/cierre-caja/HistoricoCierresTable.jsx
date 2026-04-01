import {
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const getDifferenceClassName = (difference) => {
  if (difference === null) {
    return 'text-text-tertiary'
  }
  if (parseFloat(difference) === 0) {
    return 'text-success-600'
  }
  return parseFloat(difference) > 0 ? 'text-info-600' : 'text-error-600'
}

export default function HistoricoCierresTable({ formatCurrency, formatDateTime, historico }) {
  return (
    <div className="card">
      <h2 className="mb-4 text-heading-3">Historico de Cierres</h2>

      {historico.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">No hay cierres registrados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th className="text-right">Fondo</th>
                <th className="text-right">Efectivo</th>
                <th className="text-right">MP</th>
                <th className="text-right">Diferencia</th>
                <th className="text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((cierre) => (
                <tr key={cierre.id}>
                  <td className="text-text-primary">{formatDateTime(cierre.horaApertura)}</td>
                  <td className="text-text-secondary">{cierre.usuario?.nombre}</td>
                  <td className="text-right text-text-secondary">{formatCurrency(cierre.fondoInicial)}</td>
                  <td className="text-right text-success-600">{formatCurrency(cierre.totalEfectivo)}</td>
                  <td className="text-right text-warning-600">{formatCurrency(cierre.totalMP)}</td>
                  <td className={`text-right font-medium ${getDifferenceClassName(cierre.diferencia)}`}>
                    {cierre.diferencia !== null ? formatCurrency(cierre.diferencia) : '-'}
                  </td>
                  <td className="text-center">
                    {cierre.estado === 'CERRADO' ? (
                      <span className="badge badge-info">
                        <CheckCircleIcon className="mr-1 h-3 w-3" />
                        Cerrado
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <ClockIcon className="mr-1 h-3 w-3" />
                        Abierto
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
