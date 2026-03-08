export default function VentasPorMozoRanking({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos de mozos</p>
  }

  const maxVentas = Math.max(...data.map((mozo) => Number(mozo.totalVentas) || 0))

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((mozo, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-tertiary w-6">{index + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-text-primary truncate">{mozo.mozo}</span>
              <span className="text-xs text-text-tertiary">{mozo.pedidos} pedidos</span>
            </div>
            <div className="h-4 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{
                  width: maxVentas > 0 ? `${(Number(mozo.totalVentas) / maxVentas) * 100}%` : '0%',
                }}
              />
            </div>
            <div className="text-right text-sm font-bold text-success-600 mt-1">
              ${Number(mozo.totalVentas).toLocaleString('es-AR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
