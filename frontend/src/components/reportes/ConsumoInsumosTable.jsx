import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

export default function ConsumoInsumosTable({ data }) {
  const [expandedItems, setExpandedItems] = useState({})

  if (!data || !data.ingredientes || data.ingredientes.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos de consumo</p>
  }

  const toggleExpand = (ingredienteId) => {
    setExpandedItems((prev) => ({ ...prev, [ingredienteId]: !prev[ingredienteId] }))
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-surface-hover p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-text-primary">{data.resumen.totalIngredientes}</p>
          <p className="text-xs text-text-tertiary">Ingredientes</p>
        </div>
        <div className="bg-error-50 p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-error-600">{data.resumen.ingredientesBajoStock}</p>
          <p className="text-xs text-text-tertiary">Bajo Stock</p>
        </div>
        <div className="bg-success-50 p-3 rounded-lg text-center">
          <p className="text-lg font-bold text-success-600">
            $
            {data.resumen.costoTotalEstimado?.toLocaleString('es-AR', {
              maximumFractionDigits: 0,
            }) || '-'}
          </p>
          <p className="text-xs text-text-tertiary">Costo Total</p>
        </div>
      </div>

      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th className="text-left">Ingrediente</th>
              <th className="text-right">Consumo</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.ingredientes.slice(0, 10).map((ingrediente) => (
              <FragmentRow
                key={ingrediente.ingredienteId}
                ingrediente={ingrediente}
                expanded={Boolean(expandedItems[ingrediente.ingredienteId])}
                onToggle={() => toggleExpand(ingrediente.ingredienteId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentRow({ ingrediente, expanded, onToggle }) {
  return (
    <>
      <tr className="hover:bg-surface-hover">
        <td>
          <div className="flex items-center gap-2">
            {ingrediente.detalleProductos && ingrediente.detalleProductos.length > 0 && (
              <button
                onClick={onToggle}
                type="button"
                className="p-0.5 hover:bg-surface-hover rounded"
                aria-label={`${expanded ? 'Contraer' : 'Expandir'} detalle de ${ingrediente.nombre}`}
              >
                {expanded ? (
                  <ChevronDownIcon className="w-4 h-4 text-text-tertiary" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-text-tertiary" />
                )}
              </button>
            )}
            <span className="font-medium text-text-primary">{ingrediente.nombre}</span>
          </div>
        </td>
        <td className="text-right text-text-secondary">
          {ingrediente.consumoTotal.toFixed(2)} {ingrediente.unidad}
        </td>
        <td className="text-right text-text-secondary">
          {ingrediente.stockActual.toFixed(2)} {ingrediente.unidad}
        </td>
        <td className="text-right">
          <span className={`badge ${ingrediente.estado === 'BAJO' ? 'badge-error' : 'badge-success'}`}>
            {ingrediente.estado}
          </span>
        </td>
      </tr>
      {expanded && ingrediente.detalleProductos && (
        <tr>
          <td colSpan={4} className="bg-surface-hover px-6 py-2">
            <div className="text-xs space-y-1">
              {ingrediente.detalleProductos.map((producto, index) => (
                <div key={index} className="flex justify-between text-text-secondary">
                  <span>
                    {producto.producto}
                    {producto.multiplicador !== 1 && (
                      <span className="text-primary-600 ml-1">(x{producto.multiplicador})</span>
                    )}
                  </span>
                  <span>
                    {producto.cantidad} uds = {producto.consumo.toFixed(2)} {ingrediente.unidad}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
