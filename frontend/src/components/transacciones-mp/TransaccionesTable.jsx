import { Link } from 'react-router-dom'
import {
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

const getPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'approved':
      return (
        <span className="badge badge-success">
          <CheckCircleIcon className="h-3 w-3" />
          Aprobado
        </span>
      )
    case 'rejected':
      return (
        <span className="badge badge-error">
          <XCircleIcon className="h-3 w-3" />
          Rechazado
        </span>
      )
    case 'pending':
    case 'in_process':
      return (
        <span className="badge badge-warning">
          <ClockIcon className="h-3 w-3" />
          Pendiente
        </span>
      )
    default:
      return <span className="badge">{status}</span>
  }
}

const getPaymentMethodLabel = (method) => {
  const methods = {
    credit_card: 'Tarjeta de Credito',
    debit_card: 'Tarjeta de Debito',
    account_money: 'Dinero en Cuenta',
    ticket: 'Pago Facil / Rapipago',
    bank_transfer: 'Transferencia',
  }
  return methods[method] || method || '-'
}

export default function TransaccionesTable({
  errorMessage,
  formatDate,
  formatMoney,
  loading,
  onNextPage,
  onPrevPage,
  onRetry,
  pagination,
  transacciones,
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
      ) : transacciones.length === 0 ? (
        <div className="py-12 text-center">
          <CreditCardIcon className="mx-auto mb-4 h-16 w-16 text-text-tertiary" />
          <p className="text-text-secondary">No hay transacciones registradas</p>
          <p className="mt-1 text-sm text-text-tertiary">
            Las transacciones apareceran aqui cuando los clientes paguen con MercadoPago
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pedido</th>
                  <th>Monto</th>
                  <th>Comision</th>
                  <th>Neto</th>
                  <th>Estado</th>
                  <th>Metodo</th>
                  <th>Pagador</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map((tx) => {
                  const pedidoId = getPositiveInt(tx?.pago?.pedido?.id)

                  return (
                    <tr key={tx.id}>
                      <td className="text-text-secondary">{formatDate(tx.createdAt)}</td>
                      <td>
                        {pedidoId ? (
                          <Link
                            to={`/pedidos?pedidoId=${pedidoId}`}
                            className="font-medium text-primary-600 hover:underline"
                          >
                            #{pedidoId}
                          </Link>
                        ) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </td>
                      <td className="font-medium text-text-primary">{formatMoney(tx.amount)}</td>
                      <td className="text-error-600">{tx.fee ? `-${formatMoney(tx.fee)}` : '-'}</td>
                      <td className="font-medium text-success-600">
                        {tx.netAmount ? formatMoney(tx.netAmount) : '-'}
                      </td>
                      <td>{getStatusBadge(tx.status)}</td>
                      <td className="text-text-secondary">
                        {getPaymentMethodLabel(tx.paymentMethod)}
                        {tx.installments > 1 && (
                          <span className="ml-1 text-xs text-text-tertiary">({tx.installments} cuotas)</span>
                        )}
                      </td>
                      <td className="max-w-[150px] truncate text-text-tertiary">{tx.payerEmail || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border-default bg-surface-hover px-4 py-3">
              <p className="text-sm text-text-secondary">
                Mostrando {transacciones.length} de {pagination.total} transacciones
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
