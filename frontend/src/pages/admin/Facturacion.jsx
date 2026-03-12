import { FunnelIcon } from '@heroicons/react/24/outline'

import ComprobanteDetailModal from '../../components/facturacion/ComprobanteDetailModal'
import ComprobantesFilters from '../../components/facturacion/ComprobantesFilters'
import ComprobantesTable from '../../components/facturacion/ComprobantesTable'
import { Button, PageHeader } from '../../components/ui'
import useFacturacionPage from '../../hooks/useFacturacionPage'

export default function Facturacion() {
  const {
    abrirDetalle,
    cargarComprobantesAsync,
    cerrarDetalle,
    clearFiltros,
    comprobanteDetalle,
    comprobantes,
    errorMessage,
    filtros,
    formatDate,
    formatMoney,
    goToNextPage,
    goToPrevPage,
    loading,
    pagination,
    showDetalleModal,
    showFiltros,
    toggleFiltros,
    updateFiltros,
  } = useFacturacionPage()

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Facturacion"
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

      <ComprobantesFilters
        filtros={filtros}
        onClear={clearFiltros}
        showFiltros={showFiltros}
        updateFiltros={updateFiltros}
      />

      <ComprobantesTable
        comprobantes={comprobantes}
        errorMessage={errorMessage}
        formatDate={formatDate}
        formatMoney={formatMoney}
        loading={loading}
        onClickRow={abrirDetalle}
        onNextPage={goToNextPage}
        onPrevPage={goToPrevPage}
        onRetry={() => cargarComprobantesAsync().catch(() => {})}
        pagination={pagination}
      />

      <ComprobanteDetailModal
        comprobante={comprobanteDetalle}
        onClose={cerrarDetalle}
        open={showDetalleModal}
      />
    </div>
  )
}
