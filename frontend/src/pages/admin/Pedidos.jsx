import { useCallback } from 'react'
import {
  ArrowLeftIcon,
  PlusIcon,
  LinkIcon,
  TableCellsIcon,
  EyeIcon,
  PrinterIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  TruckIcon
} from '@heroicons/react/24/outline'
import { Alert, Button, Dropdown, EmptyState, Input, Modal, PageHeader, Spinner, Table } from '../../components/ui'
import NuevoPedidoModal from '../../components/pedidos/NuevoPedidoModal'
import EmitirComprobanteModal from '../../components/facturacion/EmitirComprobanteModal'
import PedidoFilters from '../../components/pedidos/PedidoFilters'
import PedidoDetallePanel from '../../components/pedidos/PedidoDetallePanel'
import usePedidosPage, { estadoBadges } from '../../hooks/usePedidosPage'
import { formatArsPos } from '../../utils/currency'

export default function Pedidos() {
  const hook = usePedidosPage()

  const {
    navigate,
    esSoloMozo,
    isMobileViewport,
    rutaMesas,

    pedidos,
    totalPedidos,
    loading,
    loadingMore,

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
    limpiarFiltros,

    mesaIdFiltrada,
    mesaContextoTitulo,
    limpiarFiltroMesa,
    modoAgregarConsumoMesa,
    pedidoMesaAbierto,

    showModal,
    setShowModal,
    pedidoSeleccionado,
    setPedidoSeleccionado,
    verDetalle,

    cambiarEstado,
    cerrarPedido,
    liberarMesa,
    abrirFacturacion,
    abrirPago,
    abrirCambiarMesa,
    abrirNuevoPedido,

    showPagoModal,
    cerrarModalPago,
    pagoForm,
    setPagoForm,
    registrandoPago,
    registrarPago,
    mostrarPropina,
    handleTogglePropina,
    handleMetodoPagoChange,
    handlePropinaMontoChange,
    handlePropinaMetodoChange,
    handleUsarMontoPendiente,
    montoInputRef,
    metodoPagoInputRef,
    montoAbonadoInputRef,
    referenciaInputRef,
    propinaMontoInputRef,
    transferenciaMpConfig,
    aliasTransferenciaConfigurado,
    mostrarTransferenciaMercadoPago,
    mercadoPagoNoDisponible,
    montoPago,
    propinaMonto,
    totalARegistrar,
    efectivoInsuficiente,
    montoFueEditado,
    montoError,
    montoAbonadoHelper,
    montoPendienteSugerido,
    saldoPendienteActual,
    resumenCobro,
    referenciaLabel,
    referenciaPlaceholder,
    pagoFormId,
    submitDisabled,

    showDescuentoModal,
    setShowDescuentoModal,
    descuentoForm,
    setDescuentoForm,
    aplicandoDescuento,
    handleAplicarDescuento,

    showCambiarMesaModal,
    setShowCambiarMesaModal,
    mesasLibres,
    nuevaMesaId,
    setNuevaMesaId,
    cambiandoMesa,
    handleCambiarMesa,

    showAsignarDeliveryModal,
    setShowAsignarDeliveryModal,
    pedidoDeliveryListoId,
    setPedidoDeliveryListoId,
    deliveryModalPedidoRef,
    repartidores,
    repartidorSeleccionado,
    setRepartidorSeleccionado,
    asignandoDelivery,
    confirmarAsignarDelivery,

    showNuevoPedidoModal,
    setShowNuevoPedidoModal,

    showFacturacionModal,
    setShowFacturacionModal,
    pedidoParaFacturar,
    setPedidoParaFacturar,

    handleLoadMore,

    metricas,
    pedidosPorCerrar,
    descripcionPedidos,
    emptyStateTitle,
    emptyStateDescription,
    mostrarCtaNuevoPedidoEnHeader,
    mostrarCtaNuevoPedidoFlotante,
    ctaNuevoPedidoLabel,
    ctaNuevoPedidoMobileLabel,

    refetchPedidosWindow,
    obtenerPedidoPorId,
    cargarPedidosAsync,

    puedeAsignarDelivery,
    puedeRegistrarPago,
    puedeFacturar,
    puedeCerrarPedido,
    puedeLiberarMesa,

    imprimirComanda,
    abrirAsignarDelivery
  } = hook

  const renderImpresion = (impresion) => {
    if (!impresion) {
      return <span className="text-xs text-text-tertiary">-</span>
    }

    const label = impresion.status === 'OK'
      ? `OK ${impresion.ok}/${impresion.total}`
      : impresion.status === 'ERROR'
        ? `ERR ${impresion.ok}/${impresion.total}`
        : `${impresion.ok}/${impresion.total}`

    const badgeClass = impresion.status === 'OK'
      ? 'badge-success'
      : impresion.status === 'ERROR'
        ? 'badge-error'
        : 'badge-warning'

    return (
      <span title={impresion.lastError || ''} className={`badge ${badgeClass}`}>
        {label}
      </span>
    )
  }

  const getTipoBadge = (tipo) => {
    switch (tipo) {
      case 'DELIVERY': return 'badge-info'
      case 'MOSTRADOR': return 'badge-warning'
      default: return 'badge-info'
    }
  }

  const getPedidoContextoPrincipal = useCallback((pedido) => {
    if (pedido.tipo === 'MESA') {
      return `Mesa ${pedido.mesa?.numero ?? '-'}`
    }

    if (pedido.tipo === 'MOSTRADOR') {
      return pedido.clienteNombre || 'Mostrador'
    }

    return pedido.clienteNombre || 'Sin nombre'
  }, [])

  const getPedidoHora = useCallback((pedido) => (
    new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  ), [])

  const renderPedidoActions = useCallback((pedido, className = 'flex items-center justify-end gap-2') => (
    <div className={className}>
      <button
        onClick={() => verDetalle(pedido.id)}
        type="button"
        aria-label={`Ver detalle del pedido #${pedido.id}`}
        title="Ver detalle"
        className="text-primary-500 transition-colors hover:text-primary-600"
      >
        <EyeIcon className="w-5 h-5" />
      </button>
      <Dropdown
        trigger={
          <button
            type="button"
            aria-label={`Imprimir pedido #${pedido.id}`}
            title="Imprimir"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <PrinterIcon className="w-5 h-5" />
          </button>
        }
        items={[
          { label: 'Comanda cocina', onClick: () => imprimirComanda(pedido.id, 'COCINA') },
          { label: 'Ticket cliente', onClick: () => imprimirComanda(pedido.id, 'CLIENTE') },
          { label: 'Ticket caja', onClick: () => imprimirComanda(pedido.id, 'CAJA') },
        ]}
      />
      {pedido.tipo === 'DELIVERY' && pedido.estado === 'LISTO' && !pedido.repartidorId && puedeAsignarDelivery && (
        <button
          onClick={() => abrirAsignarDelivery(pedido.id)}
          type="button"
          aria-label={`Asignar repartidor al pedido #${pedido.id}`}
          title="Asignar repartidor"
          className="text-primary-500 transition-colors hover:text-primary-600"
        >
          <TruckIcon className="w-5 h-5" />
        </button>
      )}
      {!['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedido.estado) && puedeRegistrarPago && (
        <button
          onClick={() => abrirPago(pedido)}
          type="button"
          aria-label={`Registrar pago del pedido #${pedido.id}`}
          title="Registrar pago"
          className="text-success-500 transition-colors hover:text-success-600"
        >
          <CurrencyDollarIcon className="w-5 h-5" />
        </button>
      )}
      {['COBRADO', 'CERRADO'].includes(pedido.estado) && !pedido.comprobanteFiscal && puedeFacturar && (
        <button
          onClick={() => abrirFacturacion(pedido)}
          type="button"
          aria-label={`Facturar pedido #${pedido.id}`}
          title="Facturar"
          className="text-primary-500 transition-colors hover:text-primary-600"
        >
          <DocumentTextIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  ), [abrirAsignarDelivery, abrirFacturacion, abrirPago, imprimirComanda, puedeAsignarDelivery, puedeFacturar, puedeRegistrarPago, verDetalle])

  if (loading && pedidos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Cargando pedidos..." />
      </div>
    )
  }

  return (
    <div className={mostrarCtaNuevoPedidoFlotante ? 'pb-28 md:pb-0' : undefined}>
      <PageHeader
        title="Pedidos"
        eyebrow="Operacion"
        description={descripcionPedidos}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mesaIdFiltrada && (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-surface px-3 py-2 text-sm font-semibold text-text-primary shadow-sm">
                  <TableCellsIcon className="h-4 w-4 text-primary-600" />
                  <span>{mesaContextoTitulo}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={limpiarFiltroMesa}>
                  Ver todos
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={ArrowLeftIcon}
                  onClick={() => navigate(rutaMesas)}
                >
                  Volver a Mesas
                </Button>
              </>
            )}
            {mostrarCtaNuevoPedidoEnHeader && (
              <Button onClick={abrirNuevoPedido} icon={PlusIcon}>
                {ctaNuevoPedidoLabel}
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {metricas.map((metric) => (
          <div key={metric.label} className="stat-card flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${metric.accent}`}>
              <metric.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="stat-label">{metric.label}</p>
              <p className="stat-value">{metric.value}</p>
              <p className="mt-1 text-xs text-text-tertiary">{metric.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {pedidosPorCerrar > 0 && (
        <Alert variant="warning" className="mb-6">
          Hay {pedidosPorCerrar} pedidos cobrados que todavia necesitan cierre operativo.
        </Alert>
      )}

      <div className="card overflow-hidden">
        <PedidoFilters
          filtroBusqueda={filtroBusqueda}
          filtroEstado={filtroEstado}
          filtroTipo={filtroTipo}
          filtroFecha={filtroFecha}
          mostrarFiltrosAvanzados={mostrarFiltrosAvanzados}
          hayFiltrosActivos={hayFiltrosActivos}
          placeholderBusqueda={placeholderBusqueda}
          handleBusquedaChange={handleBusquedaChange}
          handleEstadoFilterChange={handleEstadoFilterChange}
          handleTipoFilterChange={handleTipoFilterChange}
          handleFechaFilterChange={handleFechaFilterChange}
          toggleFiltrosAvanzados={toggleFiltrosAvanzados}
          limpiarFiltros={limpiarFiltros}
        />

        {pedidos.length === 0 ? (
          <EmptyState
            title={emptyStateTitle}
            description={emptyStateDescription}
          />
        ) : isMobileViewport ? (
          <div data-testid="pedidos-mobile-list" className="space-y-3 p-4">
            {pedidos.map((pedido) => (
              <article
                key={pedido.id}
                className="rounded-2xl border border-border-default bg-surface px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-text-primary">#{pedido.id}</p>
                      <span className={`badge ${getTipoBadge(pedido.tipo)}`}>
                        {pedido.tipo}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-text-primary">
                      {getPedidoContextoPrincipal(pedido)}
                    </p>
                    {pedido.tipo === 'DELIVERY' && pedido.repartidor && (
                      <p className="mt-1 text-xs text-primary-500">
                        Repartidor: {pedido.repartidor.nombre}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-base font-semibold text-text-primary">
                      ${parseFloat(pedido.total).toLocaleString('es-AR')}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">{getPedidoHora(pedido)}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      Estado
                    </p>
                    <span className={`badge ${estadoBadges[pedido.estado]}`}>
                      {pedido.estado.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      Impresion
                    </p>
                    <div>{renderImpresion(pedido.impresion)}</div>
                  </div>
                </div>

                <div className="mt-4 border-t border-border-default pt-3">
                  {renderPedidoActions(pedido, 'flex items-center justify-end gap-3')}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Header>#</Table.Header>
                <Table.Header>Tipo</Table.Header>
                <Table.Header>Mesa/Cliente</Table.Header>
                <Table.Header>Total</Table.Header>
                <Table.Header>Estado</Table.Header>
                <Table.Header>Impresion</Table.Header>
                <Table.Header>Hora</Table.Header>
                <Table.Header className="text-right">Acciones</Table.Header>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {pedidos.map((pedido) => (
                <Table.Row key={pedido.id}>
                  <Table.Cell className="font-medium text-text-primary">#{pedido.id}</Table.Cell>
                  <Table.Cell>
                    <span className={`badge ${getTipoBadge(pedido.tipo)}`}>
                      {pedido.tipo}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-text-secondary">
                    {getPedidoContextoPrincipal(pedido)}
                    {pedido.tipo === 'DELIVERY' && pedido.repartidor && (
                      <span className="block text-xs text-primary-500">
                        Repartidor: {pedido.repartidor.nombre}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="font-medium text-text-primary">
                    ${parseFloat(pedido.total).toLocaleString('es-AR')}
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`badge ${estadoBadges[pedido.estado]}`}>
                      {pedido.estado.replace('_', ' ')}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {renderImpresion(pedido.impresion)}
                  </Table.Cell>
                  <Table.Cell className="text-text-tertiary">
                    {getPedidoHora(pedido)}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {renderPedidoActions(pedido, 'flex items-center justify-end gap-2')}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {mostrarCtaNuevoPedidoFlotante && (
        <button
          type="button"
          className="page-mobile-cta"
          onClick={abrirNuevoPedido}
          aria-label={ctaNuevoPedidoMobileLabel}
          data-testid="pedidos-mobile-new-order"
        >
          <PlusIcon className="h-5 w-5" />
          <span>{ctaNuevoPedidoMobileLabel}</span>
        </button>
      )}

      {pedidos.length > 0 && pedidos.length < totalPedidos && (
        <div className="mt-4 text-center">
          <Button
            variant="secondary"
            loading={loadingMore}
            onClick={() => {
              handleLoadMore().catch(() => {})
            }}
          >
            Cargar mas ({pedidos.length} de {totalPedidos})
          </Button>
        </div>
      )}

      {/* Modal Detalle */}
      {showModal && pedidoSeleccionado && (
        <PedidoDetallePanel
          pedidoSeleccionado={pedidoSeleccionado}
          esSoloMozo={esSoloMozo}
          puedeFacturar={puedeFacturar}
          puedeCerrarPedido={puedeCerrarPedido}
          puedeLiberarMesa={puedeLiberarMesa}
          setShowModal={setShowModal}
          verDetalle={verDetalle}
          cambiarEstado={cambiarEstado}
          cerrarPedido={cerrarPedido}
          liberarMesa={liberarMesa}
          abrirFacturacion={abrirFacturacion}
          abrirCambiarMesa={abrirCambiarMesa}
          setDescuentoForm={setDescuentoForm}
          setShowDescuentoModal={setShowDescuentoModal}
          cargarPedidosAsync={cargarPedidosAsync}
        />
      )}

      {/* Modal Pago */}
      {showPagoModal && pedidoSeleccionado && (
        <Modal
          open={showPagoModal}
          onClose={cerrarModalPago}
          title="Registrar Pago"
          className="max-w-lg !p-0 overflow-hidden flex max-h-[90vh] flex-col"
          bodyClassName="flex-1 min-h-0 p-0"
          footerClassName="mt-0 px-6 pb-4 pt-4"
          footer={(
            <>
              <button type="button" onClick={cerrarModalPago} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <Button
                type="submit"
                form={pagoFormId}
                variant="success"
                className="flex-1"
                loading={registrandoPago}
                disabled={submitDisabled}
              >
                Registrar Pago
              </Button>
            </>
          )}
        >
          <form id={pagoFormId} onSubmit={registrarPago} className="space-y-4 px-6 pb-5 pt-4">
            <div className="space-y-1">
              <p className="text-sm text-text-secondary">
                Pedido #{pedidoSeleccionado.id}
                {pedidoSeleccionado.mesa ? ` - Mesa ${pedidoSeleccionado.mesa.numero}` : ''}
              </p>
              <div className={`grid grid-cols-1 gap-2 ${resumenCobro.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {resumenCobro.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-lg border px-3 py-2 ${item.emphasize ? 'border-info-100 bg-info-50' : 'border-border-default bg-surface-hover'}`}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-text-tertiary">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {!aliasTransferenciaConfigurado && (
              <Alert variant="warning">
                MercadoPago no esta disponible hasta configurar el alias de transferencia.
              </Alert>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="label mb-0" htmlFor="pago-monto">Monto ($)</label>
                {montoFueEditado && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                    onClick={handleUsarMontoPendiente}
                  >
                    Usar pendiente
                  </button>
                )}
              </div>
              <input
                ref={montoInputRef}
                id="pago-monto"
                type="number"
                step="0.01"
                min="0.01"
                max={montoPendienteSugerido}
                className={`input ${montoError ? 'input-error' : ''}`}
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                required
              />
              <p className="input-hint">Pendiente actual: {formatArsPos(saldoPendienteActual)}</p>
              {montoError && <p className="input-error-message">{montoError}</p>}
            </div>

            <div>
              <label className="label" htmlFor="pago-metodo">Metodo de Pago</label>
              <select
                ref={metodoPagoInputRef}
                id="pago-metodo"
                className="input"
                value={pagoForm.metodo}
                onChange={(e) => handleMetodoPagoChange(e.target.value)}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="MERCADOPAGO" disabled={!aliasTransferenciaConfigurado}>MercadoPago</option>
              </select>
            </div>

            {mostrarTransferenciaMercadoPago && (
              <>
                <div className="rounded-lg border border-border-default bg-surface-hover p-3">
                  <div className="flex items-start gap-2.5">
                    <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary">Transferencia Mercado Pago</p>
                        <p className="text-xs text-text-secondary">
                          La referencia es opcional.
                        </p>
                      </div>

                      <div className="rounded-md border border-border-default bg-surface px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Alias</p>
                        <p className="mt-1 break-all text-sm font-semibold text-text-primary">
                          {transferenciaMpConfig.mercadopago_transfer_alias || 'Pendiente de configuracion'}
                        </p>
                      </div>

                      {(transferenciaMpConfig.mercadopago_transfer_titular || transferenciaMpConfig.mercadopago_transfer_cvu) && (
                        <dl className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                          {transferenciaMpConfig.mercadopago_transfer_titular && (
                            <div className="min-w-0">
                              <dt className="text-[11px] uppercase tracking-wide text-text-tertiary">Titular</dt>
                              <dd className="mt-1 break-words text-sm font-medium text-text-primary">
                                {transferenciaMpConfig.mercadopago_transfer_titular}
                              </dd>
                            </div>
                          )}

                          {transferenciaMpConfig.mercadopago_transfer_cvu && (
                            <div className="min-w-0">
                              <dt className="text-[11px] uppercase tracking-wide text-text-tertiary">CVU</dt>
                              <dd className="mt-1 break-all text-sm text-text-primary">
                                {transferenciaMpConfig.mercadopago_transfer_cvu}
                              </dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="pago-referencia">{referenciaLabel}</label>
                  <input
                    ref={referenciaInputRef}
                    id="pago-referencia"
                    type="text"
                    className="input"
                    value={pagoForm.referencia}
                    onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                    placeholder={referenciaPlaceholder}
                  />
                </div>
              </>
            )}

            <div className="rounded-lg border border-border-default bg-surface-hover p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Propina</p>
                  <p className="text-xs text-text-secondary">Agregala solo si aplica.</p>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  aria-expanded={mostrarPropina}
                  aria-controls="pago-propina-panel"
                  onClick={handleTogglePropina}
                >
                  {mostrarPropina ? 'Quitar propina' : 'Agregar propina'}
                </button>
              </div>

              {mostrarPropina && (
                <div id="pago-propina-panel" className="mt-3 space-y-3">
                  <div>
                    <label className="label" htmlFor="pago-propina">Propina ($)</label>
                    <input
                      ref={propinaMontoInputRef}
                      id="pago-propina"
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={pagoForm.propinaMonto}
                      onChange={(e) => handlePropinaMontoChange(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="pago-propina-metodo">Metodo de Propina</label>
                    <select
                      id="pago-propina-metodo"
                      className="input"
                      value={pagoForm.propinaMetodo}
                      onChange={(e) => handlePropinaMetodoChange(e.target.value)}
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="MERCADOPAGO">MercadoPago</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {pagoForm.metodo === 'EFECTIVO' && (
              <div>
                <label className="label" htmlFor="pago-abonado">Monto abonado ($)</label>
                <input
                  ref={montoAbonadoInputRef}
                  id="pago-abonado"
                  type="number"
                  step="0.01"
                  min="0"
                  className={`input ${efectivoInsuficiente ? 'input-error' : ''}`}
                  value={pagoForm.montoAbonado}
                  onChange={(e) => setPagoForm({ ...pagoForm, montoAbonado: e.target.value })}
                  placeholder={`Minimo ${formatArsPos(totalARegistrar)}`}
                />
                {montoAbonadoHelper && (
                  <p className={efectivoInsuficiente ? 'input-error-message' : 'input-hint'}>
                    {montoAbonadoHelper}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-border-default bg-canvas-subtle px-3 py-2">
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Cobro principal</span>
                <span>{formatArsPos(montoPago)}</span>
              </div>
              {mostrarPropina && (
                <div className="mt-2 flex items-center justify-between text-sm text-text-secondary">
                  <span>Propina</span>
                  <span>{formatArsPos(propinaMonto)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-border-default pt-2 text-sm font-semibold text-text-primary">
                <span>Total a registrar</span>
                <span>{formatArsPos(totalARegistrar)}</span>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Descuento */}
      <Modal
        open={showDescuentoModal}
        onClose={() => setShowDescuentoModal(false)}
        title="Aplicar descuento"
      >
        <div className="space-y-4 p-4">
          {pedidoSeleccionado && (
            <p className="text-sm text-text-secondary">
              Subtotal del pedido: <strong>${parseFloat(pedidoSeleccionado.subtotal).toLocaleString('es-AR')}</strong>
            </p>
          )}
          <Input
            label="Monto del descuento ($)"
            type="number"
            min="0"
            step="0.01"
            value={descuentoForm.descuento}
            onChange={(e) => setDescuentoForm({ ...descuentoForm, descuento: e.target.value })}
            placeholder="0.00"
          />
          <Input
            label="Motivo (opcional)"
            value={descuentoForm.motivo}
            onChange={(e) => setDescuentoForm({ ...descuentoForm, motivo: e.target.value })}
            placeholder="Ej: cortesia, error, etc."
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDescuentoModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAplicarDescuento}
              disabled={aplicandoDescuento || descuentoForm.descuento === ''}
              className="btn btn-primary flex-1"
            >
              {aplicandoDescuento ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Cambiar Mesa */}
      <Modal
        open={showCambiarMesaModal}
        onClose={() => setShowCambiarMesaModal(false)}
        title="Cambiar mesa"
      >
        <div className="space-y-4 p-4">
          {mesasLibres.length === 0 ? (
            <p className="text-sm text-text-secondary">No hay mesas libres disponibles.</p>
          ) : (
            <div>
              <label className="label">Seleccionar nueva mesa</label>
              <select
                className="input w-full"
                value={nuevaMesaId}
                onChange={(e) => setNuevaMesaId(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                {mesasLibres.map((m) => (
                  <option key={m.id} value={m.id}>Mesa {m.numero} ({m.zona || 'Sin zona'})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCambiarMesaModal(false)} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCambiarMesa}
              disabled={cambiandoMesa || !nuevaMesaId}
              className="btn btn-primary flex-1"
            >
              {cambiandoMesa ? 'Cambiando...' : 'Cambiar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Asignar Delivery */}
      {showAsignarDeliveryModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">Asignar Repartidor</h2>
            <p className="text-sm text-text-secondary mb-4">
              Pedido #{pedidoDeliveryListoId} esta listo. Selecciona un repartidor para la entrega.
            </p>
            {repartidores.length === 0 ? (
              <p className="text-sm text-text-tertiary mb-4">No hay repartidores disponibles.</p>
            ) : (
              <div className="mb-4">
                <label className="label" htmlFor="repartidor-select">Repartidor</label>
                <select
                  id="repartidor-select"
                  className="input"
                  value={repartidorSeleccionado}
                  onChange={(e) => setRepartidorSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar repartidor...</option>
                  {repartidores.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}{r.apellido ? ` ${r.apellido}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowAsignarDeliveryModal(false)
                  setPedidoDeliveryListoId(null)
                  deliveryModalPedidoRef.current = null
                  setRepartidorSeleccionado('')
                }}
              >
                Cancelar
              </button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={!repartidorSeleccionado}
                loading={asignandoDelivery}
                onClick={confirmarAsignarDelivery}
              >
                Asignar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Pedido */}
      <NuevoPedidoModal
        isOpen={showNuevoPedidoModal}
        onClose={() => setShowNuevoPedidoModal(false)}
        mode={modoAgregarConsumoMesa ? 'append' : 'create'}
        pedidoId={modoAgregarConsumoMesa ? pedidoMesaAbierto?.id : null}
        fixedMesaId={modoAgregarConsumoMesa ? mesaIdFiltrada : null}
        title={modoAgregarConsumoMesa ? `Agregar consumo a ${mesaContextoTitulo}` : null}
        onSuccess={(pedido) => {
          setShowNuevoPedidoModal(false)
          if (pedidoSeleccionado?.id === pedido?.id) {
            setPedidoSeleccionado(pedido)
          }
          refetchPedidosWindow().catch(() => {})
        }}
      />

      <EmitirComprobanteModal
        open={showFacturacionModal}
        onClose={() => {
          setShowFacturacionModal(false)
          setPedidoParaFacturar(null)
        }}
        onSuccess={() => {
          refetchPedidosWindow().catch(() => {})
          if (pedidoSeleccionado) {
            obtenerPedidoPorId(pedidoSeleccionado.id).then(setPedidoSeleccionado).catch(() => {})
          }
        }}
        pedido={pedidoParaFacturar}
      />
    </div>
  )
}
