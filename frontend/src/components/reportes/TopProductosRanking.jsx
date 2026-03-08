import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

export default function TopProductosRanking({ data, agrupadoPorBase }) {
  const [expandedItems, setExpandedItems] = useState({})

  if (!data || data.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos de productos</p>
  }

  const top5 = data.slice(0, 5)
  const maxVentas = Math.max(...top5.map((producto) => Number(producto.totalVentas) || 0))
  const medals = ['1.', '2.', '3.', '4.', '5.']
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#9CA3AF', '#9CA3AF']

  const toggleExpand = (index) => {
    setExpandedItems((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="space-y-4">
      {top5.map((producto, index) => (
        <div key={index}>
          <div className="flex items-center gap-3">
            {agrupadoPorBase && producto.variantes && producto.variantes.length > 0 && (
              <button
                onClick={() => toggleExpand(index)}
                type="button"
                className="p-1 hover:bg-surface-hover rounded"
                aria-label={`${expandedItems[index] ? 'Contraer' : 'Expandir'} variantes de ${producto.producto}`}
              >
                {expandedItems[index] ? (
                  <ChevronDownIcon className="w-4 h-4 text-text-tertiary" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-text-tertiary" />
                )}
              </button>
            )}

            <span className="text-2xl w-10 text-center">{medals[index]}</span>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-text-primary truncate pr-2">
                  {producto.producto}
                </span>
                <span className="text-xs text-text-tertiary whitespace-nowrap">
                  {producto.cantidadVendida} uds
                </span>
              </div>

              <div className="h-5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: maxVentas > 0 ? `${(Number(producto.totalVentas) / maxVentas) * 100}%` : '0%',
                    backgroundColor: colors[index],
                  }}
                />
              </div>

              <div className="text-right text-sm font-bold text-success-600 mt-1">
                ${Number(producto.totalVentas).toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          {agrupadoPorBase && producto.variantes && producto.variantes.length > 0 && expandedItems[index] && (
            <div className="ml-16 mt-2 space-y-1">
              {producto.variantes.map((variante, varianteIndex) => (
                <div
                  key={varianteIndex}
                  className="flex justify-between text-sm text-text-secondary bg-surface-hover px-3 py-1.5 rounded"
                >
                  <span>{variante.nombreVariante || variante.nombre}</span>
                  <span>
                    {variante.cantidadVendida} uds - $
                    {Number(variante.totalVentas).toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
