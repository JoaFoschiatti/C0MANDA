import PublicCategoryTabs from '../components/public/PublicCategoryTabs'
import { CartDrawer, CartSidebar, FloatingCartButton } from '../components/public/PublicCart'
import PublicCheckoutModal from '../components/public/PublicCheckoutModal'
import PublicHero from '../components/public/PublicHero'
import PublicPaymentFlow from '../components/public/PublicPaymentFlow'
import PublicProductCard from '../components/public/PublicProductCard'
import { Alert, Card, EmptyState } from '../components/ui'
import useMenuPublico from '../hooks/useMenuPublico'
import { PUBLIC_BACKEND_URL } from '../utils/public-fetch'

export default function MenuPublico() {
  const {
    config,
    categorias,
    categoriaActiva,
    setCategoriaActiva,
    variantesSeleccionadas,
    carrito,
    showCarrito,
    showCheckout,
    clienteData,
    tipoEntrega,
    setTipoEntrega,
    metodoPago,
    setMetodoPago,
    montoAbonado,
    setMontoAbonado,
    pedidoExitoso,
    pedidoPendienteMp,
    verificandoPago,
    tiempoEspera,
    pageError,
    checkoutError,
    loadError,
    loading,
    enviandoPedido,
    procesandoPagoPendiente,
    paymentMethodsAvailable,
    subtotal,
    deliveryCost,
    total,
    totalItems,
    vuelto,
    productosFiltrados,
    pendingPaymentCopy,
    loadMenu,
    seleccionarVariante,
    agregarAlCarrito,
    actualizarCantidad,
    handleClienteDataChange,
    handleWhatsAppFallback,
    enviarPedido,
    retryPendingMercadoPagoPayment,
    verifyPendingOrderManually,
    handleCancelPendingOrder,
    handleRestartAfterSuccess,
    handleOpenCheckout,
    handleCloseCheckout,
    handleOpenCarrito,
    handleCloseCarrito,
    handleOpenCheckoutFromDrawer,
    handleDismissPageError
  } = useMenuPublico()

  const showFullPageState = loading
    || verificandoPago
    || loadError
    || (config && !config.tienda_abierta)
    || pedidoPendienteMp
    || pedidoExitoso

  if (showFullPageState) {
    return (
      <PublicPaymentFlow
        loading={loading}
        verificandoPago={verificandoPago}
        tiempoEspera={tiempoEspera}
        loadError={loadError}
        config={config}
        pedidoPendienteMp={pedidoPendienteMp}
        pedidoExitoso={pedidoExitoso}
        pendingPaymentCopy={pendingPaymentCopy}
        procesandoPagoPendiente={procesandoPagoPendiente}
        onLoadMenu={loadMenu}
        onVerifyManually={verifyPendingOrderManually}
        onResumePayment={retryPendingMercadoPagoPayment}
        onCancelPending={handleCancelPendingOrder}
        onRestart={handleRestartAfterSuccess}
      />
    )
  }

  return (
    <div className="public-page">
      <PublicHero config={config} backendUrl={PUBLIC_BACKEND_URL} />

      <div className="public-page__content">
        {pageError && (
          <Alert variant="error" dismissible onDismiss={handleDismissPageError} className="mb-6">
            {pageError}
          </Alert>
        )}

        <div className="public-page__sticky-nav">
          <PublicCategoryTabs
            categories={categorias}
            activeCategory={categoriaActiva}
            onSelectCategory={setCategoriaActiva}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] items-start">
          <main className="space-y-5">
            <div className="public-section-intro">
              <div className="min-w-0">
                <p className="text-label">Catalogo</p>
                <h2 className="text-heading-2">Pedi lo que quieras</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Elegi rapido y manda el pedido sin vueltas.
                </p>
              </div>
              <div className="text-sm text-text-tertiary whitespace-nowrap">
                {productosFiltrados.length} producto{productosFiltrados.length === 1 ? '' : 's'}
              </div>
            </div>

            {productosFiltrados.length === 0 ? (
              <Card>
                <EmptyState
                  title="No hay productos en esta categoria"
                  description="Selecciona otra categoria para ver opciones disponibles."
                />
              </Card>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {productosFiltrados.map((producto) => (
                  <PublicProductCard
                    key={producto.id}
                    product={producto}
                    backendUrl={PUBLIC_BACKEND_URL}
                    selectedVariantId={variantesSeleccionadas[producto.id]}
                    onSelectVariant={seleccionarVariante}
                    onAdd={agregarAlCarrito}
                  />
                ))}
              </div>
            )}
          </main>

          <CartSidebar
            cart={carrito}
            totalItems={totalItems}
            subtotal={subtotal}
            deliveryCost={deliveryCost}
            total={total}
            tipoEntrega={tipoEntrega}
            config={config}
            onTipoEntregaChange={setTipoEntrega}
            onCheckout={handleOpenCheckout}
            onUpdateQty={actualizarCantidad}
          />
        </div>
      </div>

      <FloatingCartButton
        totalItems={totalItems}
        total={total}
        onClick={handleOpenCarrito}
      />

      <CartDrawer
        open={showCarrito}
        onClose={handleCloseCarrito}
        cart={carrito}
        totalItems={totalItems}
        subtotal={subtotal}
        deliveryCost={deliveryCost}
        total={total}
        tipoEntrega={tipoEntrega}
        config={config}
        onTipoEntregaChange={setTipoEntrega}
        onCheckout={handleOpenCheckoutFromDrawer}
        onUpdateQty={actualizarCantidad}
      />

      <PublicCheckoutModal
        open={showCheckout}
        config={config}
        cart={carrito}
        subtotal={subtotal}
        deliveryCost={deliveryCost}
        total={total}
        tipoEntrega={tipoEntrega}
        metodoPago={metodoPago}
        montoAbonado={montoAbonado}
        vuelto={vuelto}
        clienteData={clienteData}
        checkoutError={checkoutError}
        enviandoPedido={enviandoPedido}
        disableSubmit={!paymentMethodsAvailable || Boolean(pedidoPendienteMp?.id)}
        onClose={handleCloseCheckout}
        onTipoEntregaChange={setTipoEntrega}
        onMetodoPagoChange={setMetodoPago}
        onMontoAbonadoChange={setMontoAbonado}
        onClienteDataChange={handleClienteDataChange}
        onSubmit={enviarPedido}
        onWhatsAppFallback={handleWhatsAppFallback}
      />
    </div>
  )
}
