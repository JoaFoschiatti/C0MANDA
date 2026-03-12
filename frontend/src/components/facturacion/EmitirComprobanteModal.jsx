import { useState } from 'react'
import toast from 'react-hot-toast'

import api from '../../services/api'
import Modal from '../ui/Modal'
import ClienteFiscalForm from './ClienteFiscalForm'

const TIPO_OPTIONS = [
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'FACTURA_A', label: 'Factura A' },
  { value: 'FACTURA_B', label: 'Factura B' },
  { value: 'FACTURA_C', label: 'Factura C' },
]

const emptyClienteFiscal = {
  nombre: '',
  cuit: '',
  condicionIva: '',
  tipoDocumento: '',
  numeroDocumento: '',
  email: '',
}

const formatMoney = (amount) =>
  parseFloat(amount || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function EmitirComprobanteModal({ onClose, onSuccess, open, pedido }) {
  const [tipoComprobante, setTipoComprobante] = useState('CONSUMIDOR_FINAL')
  const [clienteFiscal, setClienteFiscal] = useState(emptyClienteFiscal)
  const [observaciones, setObservaciones] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)

  const necesitaCliente = tipoComprobante !== 'CONSUMIDOR_FINAL'
  const requiereCuit = tipoComprobante === 'FACTURA_A'

  const validar = () => {
    if (requiereCuit) {
      if (!clienteFiscal.nombre.trim()) return 'Nombre / Razon social es obligatorio para Factura A'
      if (!clienteFiscal.cuit.trim()) return 'CUIT es obligatorio para Factura A'
      if (!clienteFiscal.condicionIva) return 'Condicion IVA es obligatoria para Factura A'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const error = validar()
    if (error) {
      toast.error(error)
      return
    }

    setEmitiendo(true)
    try {
      const body = {
        pedidoId: pedido.id,
        tipoComprobante,
        observaciones: observaciones.trim() || undefined,
      }

      if (necesitaCliente) {
        body.clienteFiscal = {}
        for (const [key, value] of Object.entries(clienteFiscal)) {
          if (value.trim()) body.clienteFiscal[key] = value.trim()
        }
      }

      const response = await api.post('/facturacion/comprobantes', body)
      toast.success(response.data.message || 'Comprobante creado')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error emitiendo comprobante:', err)
    } finally {
      setEmitiendo(false)
    }
  }

  if (!pedido) return null

  return (
    <Modal open={open} onClose={onClose} title="Emitir comprobante fiscal" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Resumen del pedido */}
          <div className="card">
            <h4 className="text-sm font-semibold text-text-primary mb-2">
              Pedido #{pedido.id}
              {pedido.mesa?.numero && ` - Mesa ${pedido.mesa.numero}`}
            </h4>
            {pedido.items?.length > 0 && (
              <div className="space-y-1 mb-2">
                {pedido.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-text-secondary">
                      {item.cantidad}x {item.producto?.nombre}
                    </span>
                    <span className="text-text-primary">{formatMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-bold text-text-primary border-t border-border-default pt-2">
              <span>Total</span>
              <span>{formatMoney(pedido.total)}</span>
            </div>
          </div>

          {/* Tipo comprobante */}
          <div>
            <label className="label" htmlFor="ec-tipo">
              Tipo de comprobante
            </label>
            <select
              id="ec-tipo"
              value={tipoComprobante}
              onChange={(e) => {
                setTipoComprobante(e.target.value)
                if (e.target.value === 'CONSUMIDOR_FINAL') {
                  setClienteFiscal(emptyClienteFiscal)
                }
              }}
              className="input"
            >
              {TIPO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Cliente fiscal */}
          {necesitaCliente && (
            <ClienteFiscalForm
              form={clienteFiscal}
              onChange={setClienteFiscal}
              requiereCuit={requiereCuit}
            />
          )}

          {/* Observaciones */}
          <div>
            <label className="label" htmlFor="ec-obs">
              Observaciones (opcional)
            </label>
            <textarea
              id="ec-obs"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="input"
              rows={2}
              placeholder="Observaciones adicionales..."
            />
          </div>
        </div>

        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={emitiendo}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={emitiendo}>
            {emitiendo ? 'Emitiendo...' : 'Emitir comprobante'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
