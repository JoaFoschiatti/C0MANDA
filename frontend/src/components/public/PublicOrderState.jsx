import {
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

import { Alert, Button, Card } from '../ui'

export function PublicLoadingState({ label }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="spinner spinner-lg mx-auto" />
        <p className="text-text-secondary">{label}</p>
      </div>
    </div>
  )
}

export function PublicErrorState({ title, message, actionLabel, onAction }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <Card className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-error-50 text-error-600 flex items-center justify-center mx-auto">
          <ExclamationTriangleIcon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-heading-2">{title}</h2>
          <p className="text-body-sm mt-2">{message}</p>
        </div>
        {actionLabel && onAction && (
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Card>
    </div>
  )
}

export function PublicClosedState({ config }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Card className="text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto">
          <ClockIcon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-heading-2">No estamos tomando pedidos ahora</h2>
          <p className="text-body-sm mt-2">
            {config?.nombre_negocio || 'El local'} esta fuera de horario.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border-default px-4 py-2 text-sm text-text-secondary">
          <ClockIcon className="w-4 h-4" />
          <span>
            {config?.horario_apertura || '--:--'} a {config?.horario_cierre || '--:--'}
          </span>
        </div>
      </Card>
    </div>
  )
}

export function PublicPendingPaymentState({ pedido, total, onCancel }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Card className="text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-info-50 text-info-600 flex items-center justify-center mx-auto">
          <CreditCardIcon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-heading-2">Esperando confirmacion de pago</h2>
          <p className="text-body-sm mt-2">
            Completa el pago en Mercado Pago. Esta pantalla se actualiza automaticamente.
          </p>
        </div>
        <div className="rounded-2xl border border-border-default bg-canvas-subtle px-4 py-5">
          <p className="text-sm text-text-tertiary">Pedido #{pedido?.id}</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">
            ${Number(total || pedido?.total || 0).toLocaleString('es-AR')}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar seguimiento
        </Button>
      </Card>
    </div>
  )
}

export function PublicVerifyingPaymentState({ tiempoEspera }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Card className="text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
          <ClockIcon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-heading-2">Verificando tu pago</h2>
          <p className="text-body-sm mt-2">
            Estamos confirmando tu pago con Mercado Pago. No cierres esta ventana.
          </p>
        </div>
        <div className="space-y-3">
          <div className="w-full bg-border-subtle rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${Math.min((tiempoEspera / 60) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-tertiary">
            Tiempo de espera: {tiempoEspera} segundos
          </p>
        </div>
      </Card>
    </div>
  )
}

export function PublicSuccessState({ pedido, onRestart }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Card className="text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center mx-auto">
          <CheckCircleIcon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-heading-2">Pedido confirmado</h2>
          <p className="text-body-sm mt-2">
            Tu pedido #{pedido?.id} fue recibido correctamente.
          </p>
        </div>
        {pedido?.pagoAprobado && (
          <Alert variant="success">
            Pago aprobado.
          </Alert>
        )}
        <Button type="button" onClick={onRestart} className="w-full">
          Hacer otro pedido
        </Button>
      </Card>
    </div>
  )
}
