import { useNavigate, useParams } from 'react-router-dom'

import PedidoComposer from '../../components/pedidos/PedidoComposer'
import { PageHeader } from '../../components/ui'

export default function NuevoPedido() {
  const { mesaId } = useParams()
  const navigate = useNavigate()
  const fixedMesaId = mesaId ? Number.parseInt(mesaId, 10) : null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salon"
        title="Nuevo pedido"
        description={
          fixedMesaId
            ? 'Carga el pedido de la mesa y envialo a cocina.'
            : 'Crea pedidos de mesa o mostrador desde una sola pantalla.'
        }
      />

      <PedidoComposer
        surface="page"
        availableTipos={fixedMesaId ? ['MESA'] : ['MESA', 'MOSTRADOR']}
        initialTipo="MESA"
        fixedMesaId={fixedMesaId}
        showMesaSelector={!fixedMesaId}
        submitLabel="Confirmar pedido"
        submittingLabel="Enviando..."
        successMessageBuilder={(pedido) => `Pedido #${pedido.id} creado! Se imprimira al iniciar preparacion.`}
        onSubmitSuccess={(_pedido, context) => {
          navigate(context.tipo === 'MESA' ? '/mozo/mesas' : '/pedidos')
        }}
      />
    </div>
  )
}
