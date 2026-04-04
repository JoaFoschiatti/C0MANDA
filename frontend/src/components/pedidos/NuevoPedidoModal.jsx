import PedidoComposer from './PedidoComposer'
import { Modal } from '../ui'

export default function NuevoPedidoModal({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  pedidoId = null,
  fixedMesaId = null,
  title = null,
}) {
  if (!isOpen) {
    return null
  }

  const isAppendMode = mode === 'append'
  const modalTitle = title || (isAppendMode ? 'Agregar consumo' : 'Nuevo pedido manual')
  const submitLabel = isAppendMode ? 'Agregar consumo' : 'Confirmar pedido'
  const submittingLabel = isAppendMode ? 'Agregando...' : 'Creando...'

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="full"
      className="!max-w-7xl !p-0 overflow-hidden flex max-h-[90vh] flex-col"
      bodyClassName="!p-0 flex-1 min-h-0"
    >
      <PedidoComposer
        surface="modal"
        availableTipos={isAppendMode ? ['MESA'] : ['MOSTRADOR', 'DELIVERY', 'MESA']}
        initialTipo={isAppendMode ? 'MESA' : 'MOSTRADOR'}
        mode={mode}
        existingPedidoId={pedidoId}
        fixedMesaId={fixedMesaId}
        showMesaSelector={!isAppendMode}
        showSucursalSelector={!isAppendMode}
        showCustomerNameForTipos={isAppendMode ? [] : ['MOSTRADOR', 'DELIVERY', 'MESA']}
        showGeneralObservaciones={!isAppendMode}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        successMessageBuilder={(pedido, context) => (
          isAppendMode
            ? `Ronda ${context?.ronda?.numero || ''} agregada al pedido #${pedido.id}!`.replace('  ', ' ')
            : `Pedido #${pedido.id} creado!`
        )}
        onCancel={onClose}
        onSubmitSuccess={(pedido, context) => {
          onSuccess?.(pedido, context)
        }}
      />
    </Modal>
  )
}
