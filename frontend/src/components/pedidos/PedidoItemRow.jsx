import clsx from 'clsx'
import {
  MinusIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`

export default function PedidoItemRow({
  item,
  noteVisible,
  onEliminarItem,
  onToggleItemNote,
  onUpdateItemNote,
  onUpdateQty,
}) {
  return (
    <div className="rounded-3xl border border-border-default bg-surface-hover p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{item.nombre}</h3>
              <p className="mt-1 text-xs text-text-tertiary">
                {formatCurrency(item.precio)} c/u
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-text-primary">
              {formatCurrency(parseFloat(item.precio) * item.cantidad)}
            </span>
          </div>

          {item.modificadores.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.modificadores.map((mod) => (
                <span
                  key={mod.id}
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    mod.tipo === 'EXCLUSION'
                      ? 'bg-error-50 text-error-700'
                      : 'bg-success-50 text-success-700'
                  )}
                >
                  {mod.tipo === 'EXCLUSION' ? `Sin ${mod.nombre}` : `Extra ${mod.nombre}`}
                  {parseFloat(mod.precio) > 0 ? ` (${formatCurrency(mod.precio)})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label={`Eliminar ${item.nombre} del carrito`}
          onClick={() => onEliminarItem(item.itemId)}
          className="rounded-full p-2 text-error-500 transition-colors hover:bg-error-50 hover:text-error-700"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface px-1.5 py-1">
          <button
            type="button"
            aria-label={`Reducir cantidad de ${item.nombre}`}
            onClick={() => onUpdateQty(item.itemId, -1)}
            className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold text-text-primary">
            {item.cantidad}
          </span>
          <button
            type="button"
            aria-label={`Aumentar cantidad de ${item.nombre}`}
            onClick={() => onUpdateQty(item.itemId, 1)}
            className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleItemNote(item.itemId)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
        >
          <PencilSquareIcon className="h-4 w-4" />
          {noteVisible ? 'Ocultar nota' : item.observaciones ? 'Editar nota' : 'Agregar nota'}
        </button>
      </div>

      {noteVisible && (
        <textarea
          className="input mt-3 min-h-[76px] text-sm"
          rows="3"
          placeholder="Aclaraciones para cocina o caja"
          value={item.observaciones}
          onChange={(event) => onUpdateItemNote(item.itemId, event.target.value)}
        />
      )}
    </div>
  )
}
