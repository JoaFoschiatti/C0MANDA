import {
  PublicClosedState,
  PublicErrorState,
  PublicLoadingState,
  PublicPendingPaymentState,
  PublicSuccessState,
  PublicVerifyingPaymentState
} from './PublicOrderState'

export default function PublicPaymentFlow({
  loading,
  verificandoPago,
  tiempoEspera,
  loadError,
  config,
  pedidoPendienteMp,
  pedidoExitoso,
  pendingPaymentCopy,
  procesandoPagoPendiente,
  onLoadMenu,
  onVerifyManually,
  onResumePayment,
  onCancelPending,
  onRestart
}) {
  if (loading) {
    return <PublicLoadingState label="Cargando menu..." />
  }

  if (verificandoPago) {
    return <PublicVerifyingPaymentState tiempoEspera={tiempoEspera} />
  }

  if (loadError) {
    return (
      <PublicErrorState
        title="No pudimos cargar el menu"
        message={loadError}
        actionLabel="Reintentar"
        onAction={() => onLoadMenu().catch(() => {})}
      />
    )
  }

  if (config && !config.tienda_abierta) {
    return <PublicClosedState config={config} />
  }

  if (pedidoPendienteMp) {
    return (
      <PublicPendingPaymentState
        pedido={pedidoPendienteMp}
        total={pedidoPendienteMp.total}
        title={pendingPaymentCopy.title}
        message={pendingPaymentCopy.message}
        busy={procesandoPagoPendiente}
        onRetry={onVerifyManually}
        onResumePayment={onResumePayment}
        onCancel={onCancelPending}
      />
    )
  }

  if (pedidoExitoso) {
    return (
      <PublicSuccessState
        pedido={pedidoExitoso}
        onRestart={onRestart}
      />
    )
  }

  return null
}
