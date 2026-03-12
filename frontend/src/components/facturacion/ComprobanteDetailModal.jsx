import { useState } from 'react'
import {
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import Modal from '../ui/Modal'

const TIPO_LABELS = {
  CONSUMIDOR_FINAL: 'Consumidor Final',
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
}

const getEstadoBadge = (estado) => {
  const map = {
    AUTORIZADO: { cls: 'badge-success', icon: CheckCircleIcon, label: 'Autorizado' },
    AUTORIZADO_CON_OBSERVACIONES: { cls: 'badge-info', icon: ExclamationTriangleIcon, label: 'Autorizado (obs.)' },
    PENDIENTE_ENVIO: { cls: 'badge-warning', icon: ClockIcon, label: 'Pendiente de envio' },
    PENDIENTE_CONFIGURACION_ARCA: { cls: 'badge-warning', icon: ClockIcon, label: 'Config. pendiente' },
    PENDIENTE_PUNTO_VENTA: { cls: 'badge-warning', icon: ClockIcon, label: 'PV pendiente' },
    RECHAZADO_ARCA: { cls: 'badge-error', icon: XCircleIcon, label: 'Rechazado por ARCA' },
    ERROR_ARCA: { cls: 'badge-error', icon: XCircleIcon, label: 'Error ARCA' },
  }
  const entry = map[estado] || { cls: '', icon: ClockIcon, label: estado }
  const Icon = entry.icon
  return (
    <span className={`badge ${entry.cls}`}>
      <Icon className="h-3 w-3" />
      {entry.label}
    </span>
  )
}

const formatMoney = (amount) =>
  parseFloat(amount || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-medium">{value || '-'}</span>
    </div>
  )
}

function CollapsibleJson({ title, data }) {
  const [open, setOpen] = useState(false)

  if (!data) return null

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
      >
        {open ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
        {title}
      </button>
      {open && (
        <pre className="px-3 py-2 text-xs bg-surface-hover overflow-x-auto max-h-64 border-t border-border-default">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function ComprobanteDetailModal({ comprobante, onClose, open }) {
  if (!comprobante) return null

  const pedido = comprobante.pedido
  const cliente = comprobante.clienteFiscal

  return (
    <Modal open={open} onClose={onClose} title="Detalle de Comprobante" size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-text-primary">
            {TIPO_LABELS[comprobante.tipoComprobante] || comprobante.tipoComprobante}
          </span>
          {getEstadoBadge(comprobante.estado)}
        </div>

        {/* Datos generales */}
        <div className="card">
          <h4 className="text-sm font-semibold text-text-primary mb-2">Datos del comprobante</h4>
          <InfoRow label="N. Comprobante" value={comprobante.numeroComprobante} />
          <InfoRow label="Fecha" value={formatDate(comprobante.createdAt)} />
          <InfoRow
            label="Punto de venta"
            value={comprobante.puntoVentaFiscal?.puntoVenta}
          />
          {pedido && (
            <InfoRow label="Pedido" value={`#${pedido.id}${pedido.mesa ? ` (Mesa ${pedido.mesa.numero})` : ''}`} />
          )}
          {pedido?.total && (
            <InfoRow label="Monto total" value={formatMoney(pedido.total)} />
          )}
        </div>

        {/* CAE */}
        {comprobante.cae && (
          <div className="card">
            <h4 className="text-sm font-semibold text-text-primary mb-2">CAE</h4>
            <InfoRow label="CAE" value={comprobante.cae} />
            <InfoRow label="Vencimiento CAE" value={formatDate(comprobante.caeVencimiento)} />
          </div>
        )}

        {/* Cliente fiscal */}
        {cliente && (
          <div className="card">
            <h4 className="text-sm font-semibold text-text-primary mb-2">Cliente fiscal</h4>
            <InfoRow label="Nombre" value={cliente.nombre} />
            {cliente.cuit && <InfoRow label="CUIT" value={cliente.cuit} />}
            {cliente.condicionIva && <InfoRow label="Condicion IVA" value={cliente.condicionIva} />}
            {cliente.tipoDocumento && <InfoRow label="Tipo documento" value={cliente.tipoDocumento} />}
            {cliente.numeroDocumento && <InfoRow label="N. Documento" value={cliente.numeroDocumento} />}
            {cliente.email && <InfoRow label="Email" value={cliente.email} />}
          </div>
        )}

        {/* Items del pedido */}
        {pedido?.items?.length > 0 && (
          <div className="card">
            <h4 className="text-sm font-semibold text-text-primary mb-2">Items del pedido</h4>
            <div className="space-y-1">
              {pedido.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-text-primary">
                    {item.cantidad}x {item.producto?.nombre}
                  </span>
                  <span className="text-text-primary">{formatMoney(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm border-t border-border-default pt-1 mt-1">
                <span>Total</span>
                <span>{formatMoney(pedido.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Observaciones */}
        {comprobante.observaciones && (
          <div className="card">
            <h4 className="text-sm font-semibold text-text-primary mb-1">Observaciones</h4>
            <p className="text-sm text-text-secondary">{comprobante.observaciones}</p>
          </div>
        )}

        {/* Respuesta ARCA */}
        <CollapsibleJson title="Respuesta ARCA" data={comprobante.respuestaArca} />
        <CollapsibleJson title="Payload enviado" data={comprobante.payload} />
      </div>

      <Modal.Footer>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  )
}
