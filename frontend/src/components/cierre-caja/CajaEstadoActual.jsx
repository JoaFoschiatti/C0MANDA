import {
  BanknotesIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline'

export default function CajaEstadoActual({
  cajaActual,
  formatCurrency,
  formatDateTime,
  onAbrirCaja,
  onPrepararCierre,
}) {
  return (
    <div className="card mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-heading-3">Estado Actual</h2>
        {cajaActual?.cajaAbierta ? (
          <span className="badge badge-success flex items-center gap-2">
            <LockOpenIcon className="h-4 w-4" />
            Caja Abierta
          </span>
        ) : (
          <span className="badge badge-info flex items-center gap-2">
            <LockClosedIcon className="h-4 w-4" />
            Caja Cerrada
          </span>
        )}
      </div>

      {cajaActual?.cajaAbierta ? (
        <div>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-info-50 p-4">
              <p className="text-sm text-info-600">Fondo Inicial</p>
              <p className="text-2xl font-bold text-info-700">
                {formatCurrency(cajaActual.caja.fondoInicial)}
              </p>
            </div>
            <div className="rounded-xl bg-success-50 p-4">
              <p className="text-sm text-success-600">Ventas Efectivo</p>
              <p className="text-2xl font-bold text-success-700">
                {formatCurrency(cajaActual.caja.ventasActuales?.efectivo)}
              </p>
            </div>
            <div className="rounded-xl bg-primary-50 p-4">
              <p className="text-sm text-primary-600">Ventas Tarjeta</p>
              <p className="text-2xl font-bold text-primary-700">
                {formatCurrency(cajaActual.caja.ventasActuales?.tarjeta)}
              </p>
            </div>
            <div className="rounded-xl bg-warning-50 p-4">
              <p className="text-sm text-warning-600">MercadoPago</p>
              <p className="text-2xl font-bold text-warning-700">
                {formatCurrency(cajaActual.caja.ventasActuales?.mercadopago)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-default pt-4">
            <div>
              <p className="text-sm text-text-secondary">
                Abierta por: {cajaActual.caja.usuario?.nombre}
              </p>
              <p className="text-sm text-text-tertiary">
                Hora apertura: {formatDateTime(cajaActual.caja.horaApertura)}
              </p>
            </div>
            <button onClick={onPrepararCierre} className="btn btn-primary flex items-center gap-2">
              <LockClosedIcon className="h-5 w-5" />
              Cerrar Caja
            </button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <BanknotesIcon className="mx-auto mb-4 h-16 w-16 text-text-tertiary" />
          <p className="mb-4 text-text-secondary">No hay caja abierta</p>
          <button onClick={onAbrirCaja} className="btn btn-primary">
            Abrir Caja
          </button>
        </div>
      )}
    </div>
  )
}
