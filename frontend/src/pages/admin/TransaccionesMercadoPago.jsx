import { FunnelIcon } from '@heroicons/react/24/outline'

import TransaccionesFilters from '../../components/transacciones-mp/TransaccionesFilters'
import TransaccionesSummaryCards from '../../components/transacciones-mp/TransaccionesSummaryCards'
import TransaccionesTable from '../../components/transacciones-mp/TransaccionesTable'
import { Button, PageHeader } from '../../components/ui'
import useTransaccionesMercadoPagoPage from '../../hooks/useTransaccionesMercadoPagoPage'

export default function TransaccionesMercadoPago() {
  const {
    cargarTransaccionesAsync,
    clearFiltros,
    errorMessage,
    filtros,
    formatDate,
    formatMoney,
    goToNextPage,
    goToPrevPage,
    loading,
    pagination,
    showFiltros,
    toggleFiltros,
    totales,
    transacciones,
    updateFiltros,
  } = useTransaccionesMercadoPagoPage()

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Transacciones MercadoPago"
        actions={(
          <Button
            variant={showFiltros ? 'primary' : 'secondary'}
            icon={FunnelIcon}
            onClick={toggleFiltros}
          >
            Filtros
          </Button>
        )}
      />

      <TransaccionesFilters
        filtros={filtros}
        onClear={clearFiltros}
        showFiltros={showFiltros}
        updateFiltros={updateFiltros}
      />

      <TransaccionesSummaryCards formatMoney={formatMoney} totales={totales} />

      <TransaccionesTable
        errorMessage={errorMessage}
        formatDate={formatDate}
        formatMoney={formatMoney}
        loading={loading}
        onNextPage={goToNextPage}
        onPrevPage={goToPrevPage}
        onRetry={() => cargarTransaccionesAsync().catch(() => {})}
        pagination={pagination}
        transacciones={transacciones}
      />
    </div>
  )
}
