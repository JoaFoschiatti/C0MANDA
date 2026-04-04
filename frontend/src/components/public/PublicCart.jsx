import {
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline'

import { Button, Drawer, EmptyState } from '../ui'

function QuantityStepper({ value, onDecrease, onIncrease }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="qty-btn" onClick={onDecrease} aria-label="Reducir cantidad">
        <MinusIcon className="w-4 h-4" />
      </button>
      <span className="w-8 text-center text-sm font-medium">{value}</span>
      <button type="button" className="qty-btn" onClick={onIncrease} aria-label="Aumentar cantidad">
        <PlusIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function CartPanel({
  cart,
  totalItems,
  subtotal,
  deliveryCost,
  total,
  tipoEntrega,
  config,
  onTipoEntregaChange,
  onCheckout,
  onUpdateQty,
  title = 'Tu pedido'
}) {
  const showDelivery = Boolean(config?.delivery_habilitado)

  return (
    <div className="public-cart-panel">
      <div className="public-cart-panel__header">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary-500 text-primary-950 flex items-center justify-center">
            <ShoppingCartIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <p className="text-xs text-text-tertiary">
              {totalItems > 0 ? `${totalItems} item${totalItems === 1 ? '' : 's'}` : 'Sin productos cargados'}
            </p>
          </div>
        </div>
      </div>

      <div className="public-cart-panel__body">
        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingCartIcon}
            title="El carrito esta vacio"
            description="Agrega productos para continuar con tu pedido."
            className="py-10"
          />
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="public-cart-line">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{item.nombre}</p>
                  <p className="text-xs text-text-tertiary">
                    ${Number(item.precio || 0).toLocaleString('es-AR')} c/u
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <QuantityStepper
                    value={item.cantidad}
                    onDecrease={() => onUpdateQty(item.id, -1)}
                    onIncrease={() => onUpdateQty(item.id, 1)}
                  />
                  <div className="min-w-[72px] text-right font-semibold text-text-primary">
                    ${Math.round(Number(item.precio || 0) * item.cantidad).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="public-cart-panel__footer">
          <div className="grid gap-2 sm:grid-cols-2">
            {showDelivery && (
              <button
                type="button"
                className={`public-choice-card ${tipoEntrega === 'DELIVERY' ? 'is-active' : ''}`}
                onClick={() => onTipoEntregaChange('DELIVERY')}
              >
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
              <div>
                <p className="font-medium">Retiro</p>
                <p className="text-xs text-text-tertiary">Sin costo extra</p>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>Subtotal</span>
              <span>${Number(subtotal || 0).toLocaleString('es-AR')}</span>
            </div>
            {deliveryCost > 0 && (
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Delivery</span>
                <span>${Number(deliveryCost || 0).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border-default pt-3 text-lg font-semibold text-text-primary">
              <span>Total</span>
              <span>${Number(total || 0).toLocaleString('es-AR')}</span>
            </div>
          </div>

          <Button type="button" className="w-full" onClick={onCheckout}>
            Continuar pedido
          </Button>
        </div>
      )}
    </div>
  )
}

export function FloatingCartButton({ totalItems, total, onClick }) {
  if (totalItems <= 0) {
    return null
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="floating-cart-btn lg:hidden"
    >
      <ShoppingCartIcon className="w-5 h-5" />
      <div className="flex flex-col items-start">
        <span className="text-xs uppercase tracking-[0.18em]">Pedido</span>
        <span className="text-sm font-semibold">{totalItems} item{totalItems === 1 ? '' : 's'}</span>
      </div>
      <span className="ml-auto text-base font-semibold">
        ${total.toLocaleString('es-AR')}
      </span>
    </button>
  )
}

export function CartDrawer({
  open,
  onClose,
  cart,
  totalItems,
  subtotal,
  deliveryCost,
  total,
  tipoEntrega,
  config,
  onTipoEntregaChange,
  onCheckout,
  onUpdateQty
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Tu pedido" placement="bottom">
      <CartPanel
        cart={cart}
        totalItems={totalItems}
        subtotal={subtotal}
        deliveryCost={deliveryCost}
        total={total}
        tipoEntrega={tipoEntrega}
        config={config}
        onTipoEntregaChange={onTipoEntregaChange}
        onCheckout={onCheckout}
        onUpdateQty={onUpdateQty}
        title="Tu pedido"
      />
    </Drawer>
  )
}

export function CartSidebar({
  cart,
  totalItems,
  subtotal,
  deliveryCost,
  total,
  tipoEntrega,
  config,
  onTipoEntregaChange,
  onCheckout,
  onUpdateQty
}) {
  return (
    <aside className="hidden lg:block lg:sticky lg:top-36">
      <CartPanel
        cart={cart}
        totalItems={totalItems}
        subtotal={subtotal}
        deliveryCost={deliveryCost}
        total={total}
        tipoEntrega={tipoEntrega}
        config={config}
        onTipoEntregaChange={onTipoEntregaChange}
        onCheckout={onCheckout}
        onUpdateQty={onUpdateQty}
      />
    </aside>
  )
}
