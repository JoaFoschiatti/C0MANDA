import clsx from 'clsx'
import {
  MapPinIcon,
  PhoneIcon,
  PrinterIcon,
  ShoppingCartIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

import { Button } from '../ui'
import PedidoItemRow from './PedidoItemRow'

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`

export default function PedidoSummaryPanel({
  carrito,
  clienteData,
  expandedItemNotes,
  formatContextBadge,
  onCancel,
  onClienteDataChange,
  onEliminarItem,
  onSubmit,
  onToggleItemNote,
  onUpdateItemNote,
  onUpdateQty,
  observaciones,
  setObservaciones,
  showCustomerName,
  showDeliveryContactFields,
  showGeneralObservaciones = true,
  submitLabel,
  submittingLabel,
  submitting,
  tipo,
  total,
  totalItems,
}) {
  const renderEmptyState = (
    <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border-default bg-surface px-6 py-10 text-center">
      <div className="space-y-2">
        <p className="text-base font-semibold text-text-primary">Agrega productos al pedido</p>
        <p className="text-sm leading-relaxed text-text-secondary">
          Selecciona productos del catalogo para empezar a armar el pedido.
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl border border-border-default bg-surface shadow-card">
      <div className="space-y-4 border-b border-border-subtle px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-text-primary">
              <ShoppingCartIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-heading-3">Resumen del pedido</h2>
            </div>
            <p className="text-sm text-text-secondary">
              {totalItems > 0
                ? `${totalItems} item${totalItems === 1 ? '' : 's'} cargado${totalItems === 1 ? '' : 's'}`
                : 'Todavia no agregaste productos.'}
            </p>
          </div>

          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">
            {formatContextBadge(tipo)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-primary-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700">Items</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{totalItems}</p>
          </div>
          <div className="rounded-2xl bg-surface-hover px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Total</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      {(showCustomerName || showDeliveryContactFields) && (
        <div className="space-y-3 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <UserIcon className="h-4 w-4 text-primary-600" />
            Datos del pedido
          </div>

          {showCustomerName && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Cliente
              </span>
              <input
                type="text"
                className="input"
                placeholder={tipo === 'DELIVERY' ? 'Nombre del cliente *' : 'Nombre del cliente'}
                value={clienteData.nombre}
                onChange={(event) => onClienteDataChange('nombre', event.target.value)}
              />
            </label>
          )}

          {showDeliveryContactFields && (
            <>
              <label className="block space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  <PhoneIcon className="h-3.5 w-3.5" />
                  Telefono
                </span>
                <input
                  type="text"
                  className="input"
                  placeholder="Telefono"
                  value={clienteData.telefono}
                  onChange={(event) => onClienteDataChange('telefono', event.target.value)}
                />
              </label>

              <label className="block space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  Direccion de entrega
                </span>
                <input
                  type="text"
                  className="input"
                  placeholder="Direccion de entrega"
                  value={clienteData.direccion}
                  onChange={(event) => onClienteDataChange('direccion', event.target.value)}
                />
              </label>
            </>
          )}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 cart-scroll sm:px-5">
        {carrito.length === 0
          ? renderEmptyState
          : carrito.map((item) => {
            const noteVisible = expandedItemNotes[item.itemId] || Boolean(item.observaciones)

            return (
              <PedidoItemRow
                key={item.itemId}
                item={item}
                noteVisible={noteVisible}
                onEliminarItem={onEliminarItem}
                onToggleItemNote={onToggleItemNote}
                onUpdateItemNote={onUpdateItemNote}
                onUpdateQty={onUpdateQty}
              />
            )
          })}
      </div>

      <div className="space-y-4 border-t border-border-subtle bg-surface px-4 py-4 sm:px-5">
        {showGeneralObservaciones && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              Observaciones generales
            </span>
            <textarea
              className="input min-h-[82px] text-sm"
              rows="3"
              placeholder="Indicaciones generales del pedido"
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
            />
          </label>
        )}

        <div className="rounded-2xl bg-primary-50 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Total de items</span>
            <span className="font-medium text-text-primary">{totalItems}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xl font-bold">
            <span className="text-text-primary">Total</span>
            <span className="text-primary-700">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className={clsx('flex gap-3', onCancel ? 'flex-row' : 'flex-col')}>
          {onCancel && (
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            icon={PrinterIcon}
            className="flex-1"
            loading={submitting}
            disabled={carrito.length === 0}
            onClick={onSubmit}
          >
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
