import {
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { Button, Input } from '../ui'

export default function PedidoFilters({
  filtroBusqueda,
  filtroEstado,
  filtroTipo,
  filtroFecha,
  mostrarFiltrosAvanzados,
  hayFiltrosActivos,
  placeholderBusqueda,
  handleBusquedaChange,
  handleEstadoFilterChange,
  handleTipoFilterChange,
  handleFechaFilterChange,
  toggleFiltrosAvanzados,
  limpiarFiltros
}) {
  return (
    <div className="border-b border-border-default px-4 py-4">
      <div
        data-testid="pedidos-list-toolbar"
        className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_11rem]">
          <div>
            <label className="sr-only" htmlFor="pedidos-filtro-busqueda">Buscar pedidos</label>
            <Input
              id="pedidos-filtro-busqueda"
              icon={MagnifyingGlassIcon}
              placeholder={placeholderBusqueda}
              value={filtroBusqueda}
              onChange={handleBusquedaChange}
              autoComplete="off"
              aria-label="Buscar pedidos"
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="pedidos-filtro-estado">Filtrar por estado</label>
            <select
              id="pedidos-filtro-estado"
              className="input"
              aria-label="Filtrar por estado"
              value={filtroEstado}
              onChange={handleEstadoFilterChange}
            >
              <option value="">Activos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PREPARACION">En preparacion</option>
              <option value="LISTO">Listo</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="COBRADO">Cobrado</option>
              <option value="CERRADO">Cerrado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant={mostrarFiltrosAvanzados ? 'secondary' : 'ghost'}
            size="sm"
            icon={AdjustmentsHorizontalIcon}
            onClick={toggleFiltrosAvanzados}
          >
            Mas filtros
          </Button>

          {hayFiltrosActivos && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {mostrarFiltrosAvanzados && (
        <div
          data-testid="pedidos-advanced-filters"
          className="mt-3 grid gap-3 border-t border-border-default pt-3 md:grid-cols-2"
        >
          <div>
            <label className="label" htmlFor="pedidos-filtro-tipo">Tipo</label>
            <select
              id="pedidos-filtro-tipo"
              className="input"
              value={filtroTipo}
              onChange={handleTipoFilterChange}
            >
              <option value="">Todos</option>
              <option value="MESA">Mesa</option>
              <option value="DELIVERY">Delivery</option>
              <option value="MOSTRADOR">Mostrador</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="pedidos-filtro-fecha">Fecha</label>
            <input
              id="pedidos-filtro-fecha"
              type="date"
              className="input"
              value={filtroFecha}
              onChange={handleFechaFilterChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}
