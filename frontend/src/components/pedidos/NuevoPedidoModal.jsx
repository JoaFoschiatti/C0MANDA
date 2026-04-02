import PedidoComposer from './PedidoComposer'
import { Modal } from '../ui'

export default function NuevoPedidoModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) {
    return null
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Nuevo pedido manual"
      size="full"
      className="!max-w-7xl !p-0 overflow-hidden flex max-h-[90vh] flex-col"
      bodyClassName="!p-0 flex-1 min-h-0"
    >
      <PedidoComposer
        surface="modal"
        availableTipos={['MOSTRADOR', 'DELIVERY', 'MESA']}
        initialTipo="MOSTRADOR"
        showMesaSelector
        showSucursalSelector
        showCustomerNameForTipos={['MOSTRADOR', 'DELIVERY', 'MESA']}
        submitLabel="Confirmar pedido"
        submittingLabel="Creando..."
        successMessageBuilder={(pedido) => `Pedido #${pedido.id} creado!`}
        onCancel={onClose}
        onSubmitSuccess={(pedido, context) => {
          onSuccess?.(pedido, context)
        }}
      />
    </Modal>
  )
}
