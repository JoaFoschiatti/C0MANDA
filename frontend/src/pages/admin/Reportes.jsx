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
    compararActivo,
    exportarCSV,
    fechaDesde,
    fechaHasta,
    loadingReportes,
    productosMasVendidos,
    setAgruparPorBase,
    setCompararActivo,
    setFechaDesde,
    setFechaHasta,
    setTabActiva,
    tabActiva,
    ventas,
    ventasPorHora,
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={compararActivo}
              onChange={(e) => setCompararActivo(e.target.checked)}
              className="rounded"
            />
            <span className="text-text-secondary">Comparar periodo anterior</span>
          </label>
          <button
            onClick={() => {
              if (tabActiva === 'ventas') exportarCSV('ventas')
              else if (tabActiva === 'insumos') exportarCSV('insumos')
              else if (tabActiva === 'horasPico') exportarCSV('horasPico')
            }}
            className="btn btn-secondary"
            disabled={loadingReportes}
          >
            Exportar CSV
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
        <button
          onClick={() => setTabActiva('horasPico')}
          className={`tab ${tabActiva === 'horasPico' ? 'active' : ''}`}
        >
          Horas Pico
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
              {ventas.variacion?.totalVentas != null && (
                <p className={`text-sm font-medium ${ventas.variacion.totalVentas >= 0 ? 'text-success-600' : 'text-error-500'}`}>
                  {ventas.variacion.totalVentas >= 0 ? '+' : ''}{ventas.variacion.totalVentas}%
                </p>
              )}
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Total Pedidos</p>
              <p className="text-2xl font-bold text-text-primary">{ventas.totalPedidos}</p>
              {ventas.variacion?.totalPedidos != null && (
                <p className={`text-sm font-medium ${ventas.variacion.totalPedidos >= 0 ? 'text-success-600' : 'text-error-500'}`}>
                  {ventas.variacion.totalPedidos >= 0 ? '+' : ''}{ventas.variacion.totalPedidos}%
                </p>
              )}
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Ticket Promedio</p>
              <p className="text-2xl font-bold text-primary-600">
                ${ventas.ticketPromedio?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </p>
              {ventas.variacion?.ticketPromedio != null && (
                <p className={`text-sm font-medium ${ventas.variacion.ticketPromedio >= 0 ? 'text-success-600' : 'text-error-500'}`}>
                  {ventas.variacion.ticketPromedio >= 0 ? '+' : ''}{ventas.variacion.ticketPromedio}%
                </p>
              )}
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

      {tabActiva === 'horasPico' && ventasPorHora && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-text-secondary">Hora Pico (mas pedidos)</p>
              <p className="text-2xl font-bold text-primary-600">{ventasPorHora.horaPico}</p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Hora Mayor Facturacion</p>
              <p className="text-2xl font-bold text-success-600">{ventasPorHora.horaMaxVentas}</p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Total Horas con Actividad</p>
              <p className="text-2xl font-bold text-text-primary">
                {ventasPorHora.horas?.filter((h) => h.cantidadPedidos > 0).length || 0}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-heading-3 mb-4">Pedidos por Hora del Dia</h3>
            <div className="space-y-1">
              {ventasPorHora.horas?.map((h) => {
                const maxPedidos = Math.max(...ventasPorHora.horas.map((x) => x.cantidadPedidos), 1)
                const widthPct = (h.cantidadPedidos / maxPedidos) * 100
                const isPico = h.hora === ventasPorHora.horaPico
                return (
                  <div key={h.hora} className="flex items-center gap-3 text-sm">
                    <span className="w-12 text-right text-text-secondary font-mono">{h.hora}</span>
                    <div className="flex-1 h-6 bg-surface-hover rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${isPico ? 'bg-primary-500' : 'bg-primary-300'}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-text-primary font-medium">{h.cantidadPedidos}</span>
                    <span className="w-24 text-right text-text-secondary">
                      ${h.totalVentas.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
