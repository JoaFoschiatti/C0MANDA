import { PageHeader, Spinner } from '../../components/ui'
import AbrirCajaModal from '../../components/cierre-caja/AbrirCajaModal'
import CajaEstadoActual from '../../components/cierre-caja/CajaEstadoActual'
import CerrarCajaModal from '../../components/cierre-caja/CerrarCajaModal'
import HistoricoCierresTable from '../../components/cierre-caja/HistoricoCierresTable'
import useCierreCajaPage from '../../hooks/useCierreCajaPage'

export default function CierreCaja() {
  const {
    abrirCaja,
    cajaActual,
    cerrarCaja,
    cerrarAbrirModal,
    cerrarCerrarModal,
    efectivoFisico,
    fondoInicial,
    formatCurrency,
    formatDateTime,
    historico,
    loading,
    observaciones,
    prepararCierre,
    resumen,
    setEfectivoFisico,
    setFondoInicial,
    setObservaciones,
    setShowAbrirModal,
    showAbrirModal,
    showCerrarModal,
  } = useCierreCajaPage()

  if (loading && !cajaActual && historico.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Cierre de Caja" />

      <CajaEstadoActual
        cajaActual={cajaActual}
        formatCurrency={formatCurrency}
        formatDateTime={formatDateTime}
        onAbrirCaja={() => setShowAbrirModal(true)}
        onPrepararCierre={prepararCierre}
      />

      <HistoricoCierresTable
        formatCurrency={formatCurrency}
        formatDateTime={formatDateTime}
        historico={historico}
      />

      {showAbrirModal && (
        <AbrirCajaModal
          fondoInicial={fondoInicial}
          onClose={cerrarAbrirModal}
          onSubmit={abrirCaja}
          setFondoInicial={setFondoInicial}
        />
      )}

      {showCerrarModal && resumen && (
        <CerrarCajaModal
          efectivoFisico={efectivoFisico}
          formatCurrency={formatCurrency}
          observaciones={observaciones}
          onClose={cerrarCerrarModal}
          onSubmit={cerrarCaja}
          resumen={resumen}
          setEfectivoFisico={setEfectivoFisico}
          setObservaciones={setObservaciones}
        />
      )}
    </div>
  )
}
