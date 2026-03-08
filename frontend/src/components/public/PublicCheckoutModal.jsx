import {
  BanknotesIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon
} from '@heroicons/react/24/outline'

import { Alert, Button, Input, Modal, Textarea } from '../ui'

function SummaryRow({ label, value, total = false }) {
  return (
    <div className={`flex items-center justify-between ${total ? 'text-base font-semibold text-text-primary' : 'text-sm text-text-secondary'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function PublicCheckoutModal({
  open,
  config,
  cart,
  subtotal,
  deliveryCost,
  total,
  tipoEntrega,
  metodoPago,
  montoAbonado,
  vuelto,
  clienteData,
  checkoutError,
  enviandoPedido,
  onClose,
  onTipoEntregaChange,
  onMetodoPagoChange,
  onMontoAbonadoChange,
  onClienteDataChange,
  onSubmit,
  onWhatsAppFallback
}) {
  return (
    <Modal open={open} onClose={onClose} title="Confirmar pedido" size="lg">
      <div className="space-y-5">
        {checkoutError && (
          <Alert variant="error">{checkoutError}</Alert>
        )}

        <section className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Entrega</h3>
            <p className="text-body-sm mt-1">Defini como queres recibir el pedido.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {config?.delivery_habilitado && (
              <button
                type="button"
                className={`public-choice-card ${tipoEntrega === 'DELIVERY' ? 'is-active' : ''}`}
                onClick={() => onTipoEntregaChange('DELIVERY')}
              >
                <TruckIcon className="w-5 h-5" />
                <div>
                  <p className="font-medium">Delivery</p>
                  <p className="text-xs text-text-tertiary">
                    +${Number(config.costo_delivery || 0).toLocaleString('es-AR')}
                  </p>
                </div>
              </button>
            )}
            <button
              type="button"
              className={`public-choice-card ${tipoEntrega === 'RETIRO' ? 'is-active' : ''}`}
              onClick={() => onTipoEntregaChange('RETIRO')}
            >
              <MapPinIcon className="w-5 h-5" />
              <div>
                <p className="font-medium">Retiro</p>
                <p className="text-xs text-text-tertiary">
                  {config?.direccion_retiro || 'Retiras en el local'}
                </p>
              </div>
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            value={clienteData.nombre}
            onChange={(event) => onClienteDataChange('nombre', event.target.value)}
            placeholder="Tu nombre"
          />
          <Input
            label="Telefono"
            value={clienteData.telefono}
            onChange={(event) => onClienteDataChange('telefono', event.target.value)}
            placeholder="11XXXXXXXX"
          />
          <Input
            label="Email"
            type="email"
            value={clienteData.email}
            onChange={(event) => onClienteDataChange('email', event.target.value)}
            placeholder="tu@email.com"
            className="sm:col-span-2"
          />
          {tipoEntrega === 'DELIVERY' && (
            <Input
              label="Direccion"
              value={clienteData.direccion}
              onChange={(event) => onClienteDataChange('direccion', event.target.value)}
              placeholder="Calle, numero, piso, depto"
              className="sm:col-span-2"
            />
          )}
          <Textarea
            label="Observaciones"
            rows={3}
            value={clienteData.observaciones}
            onChange={(event) => onClienteDataChange('observaciones', event.target.value)}
            placeholder="Indicaciones para cocina o entrega"
            className="sm:col-span-2"
          />
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Pago</h3>
            <p className="text-body-sm mt-1">Elegi un medio de pago disponible.</p>
          </div>

          {!config?.mercadopago_enabled && !config?.efectivo_enabled ? (
            <Alert variant="warning">
              <div className="space-y-2">
                <p>El local no tiene medios de pago habilitados en este momento.</p>
                <Button type="button" variant="outline" size="sm" onClick={onWhatsAppFallback}>
                  Consultar por WhatsApp
                </Button>
              </div>
            </Alert>
          ) : (
            <div className={`grid gap-3 ${config?.mercadopago_enabled && config?.efectivo_enabled ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
              {config?.mercadopago_enabled && (
                <button
                  type="button"
                  className={`public-choice-card ${metodoPago === 'MERCADOPAGO' ? 'is-active' : ''}`}
                  onClick={() => onMetodoPagoChange('MERCADOPAGO')}
                >
                  <CreditCardIcon className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Mercado Pago</p>
                    <p className="text-xs text-text-tertiary">Tarjeta o dinero en cuenta</p>
                  </div>
                </button>
              )}
              {config?.efectivo_enabled && (
                <button
                  type="button"
                  className={`public-choice-card ${metodoPago === 'EFECTIVO' ? 'is-active' : ''}`}
                  onClick={() => onMetodoPagoChange('EFECTIVO')}
                >
                  <BanknotesIcon className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Efectivo</p>
                    <p className="text-xs text-text-tertiary">Pagas al recibir</p>
                  </div>
                </button>
              )}
            </div>
          )}

          {metodoPago === 'EFECTIVO' && (
            <div className="space-y-3 rounded-2xl border border-success-100 bg-success-50 p-4">
              <Input
                label="Con cuanto abonas"
                type="number"
                value={montoAbonado}
                onChange={(event) => onMontoAbonadoChange(event.target.value)}
                placeholder={`Minimo $${Number(total || 0).toLocaleString('es-AR')}`}
                min={total}
              />
              {vuelto > 0 && (
                <div className="flex items-center justify-between text-sm font-medium text-success-700">
                  <span>Vuelto estimado</span>
                  <span>${Number(vuelto).toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border-default bg-canvas-subtle p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Resumen</h3>
            <span className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
              {cart.reduce((sum, item) => sum + item.cantidad, 0)} items
            </span>
          </div>
          <div className="space-y-2">
            {cart.map((item) => (
              <SummaryRow
                key={item.id}
                label={`${item.cantidad}x ${item.nombre}`}
                value={`$${(Number(item.precio || 0) * item.cantidad).toLocaleString('es-AR')}`}
              />
            ))}
          </div>
          <div className="border-t border-border-default pt-3 space-y-2">
            <SummaryRow label="Subtotal" value={`$${Number(subtotal || 0).toLocaleString('es-AR')}`} />
            {deliveryCost > 0 && (
              <SummaryRow label="Delivery" value={`$${Number(deliveryCost || 0).toLocaleString('es-AR')}`} />
            )}
            <SummaryRow label="Total" value={`$${Number(total || 0).toLocaleString('es-AR')}`} total />
          </div>
        </section>
      </div>

      <Modal.Footer className="pt-5">
        {config?.whatsapp_numero && (
          <Button type="button" variant="outline" onClick={onWhatsAppFallback}>
            Consultar por WhatsApp
          </Button>
        )}
        <Button
          type="button"
          variant={metodoPago === 'MERCADOPAGO' ? 'success' : 'primary'}
          className="min-w-[180px]"
          loading={enviandoPedido}
          onClick={onSubmit}
        >
          {metodoPago === 'MERCADOPAGO' ? 'Ir a Mercado Pago' : 'Confirmar pedido'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
