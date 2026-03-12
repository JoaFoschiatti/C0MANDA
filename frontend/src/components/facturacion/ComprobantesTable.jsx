import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

const TIPO_LABELS = {
  CONSUMIDOR_FINAL: 'Cons. Final',
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
}

const getEstadoBadge = (estado) => {
  switch (estado) {
    case 'AUTORIZADO':
      return (
        <span className="badge badge-success">
          <CheckCircleIcon className="h-3 w-3" />
          Autorizado
        </span>
      )
    case 'AUTORIZADO_CON_OBSERVACIONES':
      return (
        <span className="badge badge-info">
          <ExclamationTriangleIcon className="h-3 w-3" />
          Autorizado (obs.)
        </span>
      )
    case 'PENDIENTE_ENVIO':
    case 'PENDIENTE_CONFIGURACION_ARCA':
    case 'PENDIENTE_PUNTO_VENTA':
      return (
        <span className="badge badge-warning">
          <ClockIcon className="h-3 w-3" />
          Pendiente
        </span>
      )
    case 'RECHAZADO_ARCA':
      return (
        <span className="badge badge-error">
          <XCircleIcon className="h-3 w-3" />
          Rechazado
        </span>
      )
    case 'ERROR_ARCA':
      return (
        <span className="badge badge-error">
          <XCircleIcon className="h-3 w-3" />
          Error
        </span>
      )
    default:
      return <span className="badge">{estado}</span>
  }
}

export default function ComprobantesTable({
  comprobantes,
  errorMessage,
  formatDate,
  formatMoney,
  loading,
  onClickRow,
  onNextPage,
  onPrevPage,
  onRetry,
  pagination,
}) {
  return (
    <div className="card overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner spinner-lg" />
        </div>
      ) : errorMessage ? (
        <div className="py-12 text-center">
          <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-error-300" />
          <p className="text-error-600">{errorMessage}</p>
          <button type="button" onClick={onRetry} className="btn btn-secondary mt-4">
            Reintentar
          </button>
        </div>
      ) : comprobantes.length === 0 ? (
        <div className="py-12 text-center">
          <DocumentTextIcon className="mx-auto mb-4 h-16 w-16 text-text-tertiary" />
          <p className="text-text-secondary">No hay comprobantes fiscales</p>
          <p className="mt-1 text-sm text-text-tertiary">
            Los comprobantes apareceran aqui cuando se facturen pedidos
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>N. Comprobante</th>
                  <th>Tipo</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.map((comp) => (
                  <tr
                    key={comp.id}
                    onClick={() => onClickRow(comp)}
                    className="cursor-pointer hover:bg-surface-hover"
                  >
                    <td className="text-text-secondary">{formatDate(comp.createdAt)}</td>
                    <td className="font-medium text-text-primary">
                      {comp.numeroComprobante || '-'}
                    </td>
                    <td className="text-text-secondary">
                      {TIPO_LABELS[comp.tipoComprobante] || comp.tipoComprobante}
                    </td>
                    <td>
                      <span className="font-medium text-primary-600">
                        #{comp.pedido?.id}
                      </span>
                      {comp.pedido?.mesa?.numero && (
                        <span className="ml-1 text-xs text-text-tertiary">
                          (Mesa {comp.pedido.mesa.numero})
                        </span>
                      )}
                    </td>
                    <td className="max-w-[150px] truncate text-text-secondary">
                      {comp.clienteFiscal?.nombre || '-'}
                      {comp.clienteFiscal?.cuit && (
                        <span className="ml-1 text-xs text-text-tertiary">
                          ({comp.clienteFiscal.cuit})
                        </span>
                      )}
                    </td>
                    <td className="font-medium text-text-primary">
                      {comp.pedido?.total ? formatMoney(comp.pedido.total) : '-'}
                    </td>
                    <td>{getEstadoBadge(comp.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border-default bg-surface-hover px-4 py-3">
              <p className="text-sm text-text-secondary">
                Mostrando {comprobantes.length} de {pagination.total} comprobantes
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onPrevPage}
                  disabled={pagination.page === 1}
                  className="btn btn-secondary btn-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="px-3 py-1 text-sm text-text-primary">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  type="button"
                  onClick={onNextPage}
                  disabled={pagination.page === pagination.pages}
                  className="btn btn-secondary btn-sm disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
