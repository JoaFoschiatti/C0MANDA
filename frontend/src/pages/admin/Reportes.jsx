import { lazy, Suspense } from 'react'

import useReportesData from '../../hooks/useReportesData'
import { PageHeader, Spinner } from '../../components/ui'
import TopProductosRanking from '../../components/reportes/TopProductosRanking'
import VentasPorMozoRanking from '../../components/reportes/VentasPorMozoRanking'
import ConsumoInsumosTable from '../../components/reportes/ConsumoInsumosTable'

const DonutChart = lazy(() => import('../../components/reportes/DonutChart'))

const COLORS_METODO = {
  EFECTIVO: '#22c55e',
  MERCADOPAGO: '#06b6d4',
}

const COLORS_TIPO = {
  MESA: '#3b82f6',
  DELIVERY: '#f97316',
  MOSTRADOR: '#6b7280',
}

function ChartFallback() {
  return (
    <div className="h-64 flex items-center justify-center">
      <Spinner size="md" />
    </div>
  )
}

export default function Reportes() {
  const {
    agruparPorBase,
    cargarReportesAsync,
    consumoInsumos,
    datosMetodosPago,
    datosTipoPedido,
    fechaDesde,
    fechaHasta,
    loadingReportes,
    productosMasVendidos,
    setAgruparPorBase,
    setFechaDesde,
    setFechaHasta,
    setTabActiva,
    tabActiva,
    ventas,
    ventasPorMozo,
  } = useReportesData()

  return (
    <div>
      <PageHeader
        title="Reportes"
        eyebrow="Analitica"
        description="Ventas, mix de pagos y consumo operativo del restaurante."
      />

      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label" htmlFor="reportes-fecha-desde">
              Desde
            </label>
            <input
              id="reportes-fecha-desde"
              type="date"
              className="input"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="reportes-fecha-hasta">
              Hasta
            </label>
            <input
              id="reportes-fecha-hasta"
              type="date"
              className="input"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
            />
          </div>
          <button
            onClick={cargarReportesAsync}
            className="btn btn-primary"
            disabled={loadingReportes}
          >
            {loadingReportes ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="tabs mb-6">
        <button
          onClick={() => setTabActiva('ventas')}
          className={`tab ${tabActiva === 'ventas' ? 'active' : ''}`}
        >
          Ventas
        </button>
        <button
          onClick={() => setTabActiva('insumos')}
          className={`tab ${tabActiva === 'insumos' ? 'active' : ''}`}
        >
          Consumo de Insumos
        </button>
      </div>

      {tabActiva === 'ventas' && ventas && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-text-secondary">Total Ventas</p>
              <p className="text-2xl font-bold text-success-600">
                ${ventas.totalVentas?.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Total Pedidos</p>
              <p className="text-2xl font-bold text-text-primary">{ventas.totalPedidos}</p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Ticket Promedio</p>
              <p className="text-2xl font-bold text-primary-600">
                ${ventas.ticketPromedio?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Ventas por Tipo</p>
              <div className="text-sm mt-2">
                {Object.entries(ventas.ventasPorTipo || {}).map(([tipo, data]) => (
                  <div key={tipo} className="flex justify-between text-text-secondary">
                    <span>{tipo}:</span>
                    <span className="font-medium text-text-primary">{data.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-heading-3 flex items-center gap-2">
                  <span className="text-xl">1.</span>
                  Top 5 Productos por Ingresos
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agruparPorBase}
                    onChange={(event) => setAgruparPorBase(event.target.checked)}
                    className="rounded"
                  />
                  <span className="text-text-secondary">Agrupar variantes</span>
                </label>
              </div>
              <TopProductosRanking
                data={productosMasVendidos}
                agrupadoPorBase={agruparPorBase}
              />
            </div>

            <div className="card">
              <h3 className="text-heading-3 mb-4">Metodos de Pago</h3>
              {datosMetodosPago.length > 0 ? (
                <Suspense fallback={<ChartFallback />}>
                  <DonutChart
                    data={datosMetodosPago}
                    colors={Object.values(COLORS_METODO)}
                    formatValue={(value) => `$${value.toLocaleString('es-AR')}`}
                  />
                </Suspense>
              ) : (
                <p className="text-text-secondary text-center py-8">Sin datos de pagos</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-heading-3 mb-4">Tipo de Pedido</h3>
              {datosTipoPedido.length > 0 ? (
                <Suspense fallback={<ChartFallback />}>
                  <DonutChart
                    data={datosTipoPedido}
                    colors={Object.values(COLORS_TIPO)}
                    formatValue={(value) => `$${value.toLocaleString('es-AR')}`}
                  />
                </Suspense>
              ) : (
                <p className="text-text-secondary text-center py-8">Sin datos de pedidos</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-heading-3 mb-4 flex items-center gap-2">
                <span className="text-xl">2.</span>
                Ventas por Mozo
              </h3>
              <VentasPorMozoRanking data={ventasPorMozo} />
            </div>
          </div>
        </>
      )}

      {tabActiva === 'insumos' && (
        <div className="card">
          <h3 className="text-heading-3 mb-4 flex items-center gap-2">
            <span className="text-xl">3.</span>
            Consumo de Insumos
            <span className="text-sm font-normal text-text-tertiary">
              (con multiplicadores de variantes)
            </span>
          </h3>
          <ConsumoInsumosTable data={consumoInsumos} />
        </div>
      )}
    </div>
  )
}
