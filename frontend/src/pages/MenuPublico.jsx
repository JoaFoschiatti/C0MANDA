import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

import PublicCategoryTabs from '../components/public/PublicCategoryTabs'
import PublicCheckoutModal from '../components/public/PublicCheckoutModal'
import PublicHero from '../components/public/PublicHero'
import {
  PublicClosedState,
  PublicErrorState,
  PublicLoadingState,
  PublicPendingPaymentState,
  PublicSuccessState,
  PublicVerifyingPaymentState
} from '../components/public/PublicOrderState'
import PublicProductCard from '../components/public/PublicProductCard'
import { Alert, Button, Card, Drawer, EmptyState } from '../components/ui'
import { openExternalUrl, navigateExternalUrl, buildWhatsAppUrl } from '../utils/external-links'
import { fetchJson, PUBLIC_API_URL, PUBLIC_BACKEND_URL } from '../utils/public-fetch'
import {
  clearPendingMercadoPagoOrder,
  loadPendingMercadoPagoOrder,
  savePendingMercadoPagoOrder
} from '../utils/public-storage'
import { parseEnumParam, parsePositiveIntParam } from '../utils/query-params'

const PUBLIC_API_BASE = `${PUBLIC_API_URL}/publico`
const PAYMENT_RESULTS = ['exito', 'error', 'pendiente']

function QuantityStepper({ value, onDecrease, onIncrease }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="qty-btn" onClick={onDecrease} aria-label="Reducir cantidad">
        <MinusIcon className="w-4 h-4" />
      </button>
      <span className="w-8 text-center text-sm font-medium">{value}</span>
      <button type="button" className="qty-btn" onClick={onIncrease} aria-label="Aumentar cantidad">
        <PlusIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function getSelectedVariant(product, selectedVariantId) {
  if (!product.variantes?.length) {
    return null
  }

  return product.variantes.find((variant) => variant.id === selectedVariantId)
    || product.variantes.find((variant) => variant.esVariantePredeterminada)
    || product.variantes[0]
}

function normalizeCartProduct(product, selectedVariantId) {
  const selectedVariant = getSelectedVariant(product, selectedVariantId)
  const source = selectedVariant || product

  return {
    id: source.id,
    nombre: selectedVariant ? `${product.nombre} ${selectedVariant.nombreVariante}` : product.nombre,
    precio: source.precio,
    descripcion: selectedVariant?.descripcion || product.descripcion || '',
    productoBaseId: product.id
  }
}

function CartPanel({
  cart,
  totalItems,
  subtotal,
  deliveryCost,
  total,
  tipoEntrega,
  config,
  onTipoEntregaChange,
  onCheckout,
  onUpdateQty,
  title = 'Tu pedido'
}) {
  const showDelivery = Boolean(config?.delivery_habilitado)

  return (
    <div className="public-cart-panel">
      <div className="public-cart-panel__header">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary-500 text-primary-950 flex items-center justify-center">
            <ShoppingCartIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <p className="text-xs text-text-tertiary">
              {totalItems > 0 ? `${totalItems} item${totalItems === 1 ? '' : 's'}` : 'Sin productos cargados'}
            </p>
          </div>
        </div>
      </div>

      <div className="public-cart-panel__body">
        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingCartIcon}
            title="El carrito esta vacio"
            description="Agrega productos para continuar con tu pedido."
            className="py-10"
          />
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="public-cart-line">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{item.nombre}</p>
                  <p className="text-xs text-text-tertiary">
                    ${Number(item.precio || 0).toLocaleString('es-AR')} c/u
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <QuantityStepper
                    value={item.cantidad}
                    onDecrease={() => onUpdateQty(item.id, -1)}
                    onIncrease={() => onUpdateQty(item.id, 1)}
                  />
                  <div className="min-w-[72px] text-right font-semibold text-text-primary">
                    ${Math.round(Number(item.precio || 0) * item.cantidad).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="public-cart-panel__footer">
          <div className="grid gap-2 sm:grid-cols-2">
            {showDelivery && (
              <button
                type="button"
                className={`public-choice-card ${tipoEntrega === 'DELIVERY' ? 'is-active' : ''}`}
                onClick={() => onTipoEntregaChange('DELIVERY')}
              >
                <div>
                  <p className="font-medium">Delivery</p>
                  <p className="text-xs text-text-tertiary">
                    +${Number(config.costo_delivery || 0).toLocaleString('es-AR')}
                  </p>
                </div>
              </button>
            )}
            <button
              type="button"
              className={`public-choice-card ${tipoEntrega === 'RETIRO' ? 'is-active' : ''}`}
              onClick={() => onTipoEntregaChange('RETIRO')}
            >
              <div>
                <p className="font-medium">Retiro</p>
                <p className="text-xs text-text-tertiary">Sin costo extra</p>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>Subtotal</span>
              <span>${Number(subtotal || 0).toLocaleString('es-AR')}</span>
            </div>
            {deliveryCost > 0 && (
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Delivery</span>
                <span>${Number(deliveryCost || 0).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border-default pt-3 text-lg font-semibold text-text-primary">
              <span>Total</span>
              <span>${Number(total || 0).toLocaleString('es-AR')}</span>
            </div>
          </div>

          <Button type="button" className="w-full" onClick={onCheckout}>
            Continuar pedido
          </Button>
        </div>
      )}
    </div>
  )
}

export default function MenuPublico() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [config, setConfig] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('all')
  const [variantesSeleccionadas, setVariantesSeleccionadas] = useState({})
  const [carrito, setCarrito] = useState([])
  const [showCarrito, setShowCarrito] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteData, setClienteData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    email: '',
    observaciones: ''
  })
  const [tipoEntrega, setTipoEntrega] = useState('DELIVERY')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [montoAbonado, setMontoAbonado] = useState('')
  const [pedidoExitoso, setPedidoExitoso] = useState(null)
  const [pedidoPendienteMp, setPedidoPendienteMp] = useState(null)
  const [verificandoPago, setVerificandoPago] = useState(false)
  const [tiempoEspera, setTiempoEspera] = useState(0)
  const [pageError, setPageError] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviandoPedido, setEnviandoPedido] = useState(false)

  const publicMenuPath = '/menu'

  const loadMenu = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const [configData, menuData] = await Promise.all([
        fetchJson(`${PUBLIC_API_BASE}/config`, {}, 'Error al cargar la configuracion'),
        fetchJson(`${PUBLIC_API_BASE}/menu`, {}, 'Error al cargar el menu')
      ])

      const normalizedConfig = { ...configData.negocio, ...configData.config }
      setConfig(normalizedConfig)
      setCategorias(menuData)

      if (!normalizedConfig.delivery_habilitado) {
        setTipoEntrega('RETIRO')
      }

      if (normalizedConfig.mercadopago_enabled && !normalizedConfig.efectivo_enabled) {
        setMetodoPago('MERCADOPAGO')
      } else if (!normalizedConfig.mercadopago_enabled && normalizedConfig.efectivo_enabled) {
        setMetodoPago('EFECTIVO')
      }
    } catch (error) {
      console.error('Error cargando menu publico:', error)
      setLoadError(error.message || 'Error al cargar el menu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMenu().catch(() => {})
  }, [loadMenu])

  useEffect(() => {
    const pendingOrder = loadPendingMercadoPagoOrder()
    if (pendingOrder) {
      setPedidoPendienteMp({ id: pendingOrder.pedidoId })
    }
  }, [])

  useEffect(() => {
    if (showCheckout) {
      setCheckoutError(null)
    }
  }, [showCheckout])

  useEffect(() => {
    const pagoResult = parseEnumParam(searchParams.get('pago'), PAYMENT_RESULTS)
    const pedidoId = parsePositiveIntParam(searchParams.get('pedido'))

    if (!pagoResult || !pedidoId) {
      return undefined
    }

    let cancelled = false
    let intervalId = null

    if (pagoResult === 'error') {
      setPageError('El pago no pudo ser procesado. Intenta nuevamente.')
      navigate(publicMenuPath, { replace: true })
      return undefined
    }

    setVerificandoPago(true)
    setTiempoEspera(0)

    const verificarPago = async () => {
      try {
        const pedido = await fetchJson(
          `${PUBLIC_API_BASE}/pedido/${pedidoId}`,
          {},
          'Error al verificar el pago'
        )

        if (cancelled) {
          return false
        }

        if (pedido.estadoPago === 'APROBADO') {
          clearPendingMercadoPagoOrder()
          setVerificandoPago(false)
          setPedidoExitoso({ ...pedido, pagoAprobado: true })
          navigate(publicMenuPath, { replace: true })
          return true
        }
      } catch (error) {
        console.error('Error verificando pago:', error)
      }

      return false
    }

    const startPolling = async () => {
      const aprobado = await verificarPago()
      if (aprobado || cancelled) {
        return
      }

      let attempts = 0
      const maxAttempts = 20

      intervalId = window.setInterval(async () => {
        attempts += 1
        if (cancelled) {
          return
        }

        setTiempoEspera(attempts * 3)
        const paid = await verificarPago()

        if (paid || attempts >= maxAttempts) {
          window.clearInterval(intervalId)
          intervalId = null

          if (!paid && attempts >= maxAttempts) {
            setVerificandoPago(false)
            setPageError(`No pudimos confirmar tu pago. Si ya pagaste, usa el pedido #${pedidoId}.`)
            navigate(publicMenuPath, { replace: true })
          }
        }
      }, 3000)
    }

    startPolling().catch(() => {})

    return () => {
      cancelled = true
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [navigate, publicMenuPath, searchParams])

  useEffect(() => {
    if (!pedidoPendienteMp?.id) {
      return undefined
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 60

    const verifyPendingPayment = async () => {
      try {
        const pedido = await fetchJson(
          `${PUBLIC_API_BASE}/pedido/${pedidoPendienteMp.id}`,
          {},
          'Error al verificar el pago'
        )

        if (cancelled) {
          return false
        }

        setPedidoPendienteMp({ id: pedido.id, total: pedido.total })

        if (pedido.estadoPago === 'APROBADO') {
          clearPendingMercadoPagoOrder()
          setPedidoPendienteMp(null)
          setPedidoExitoso({ ...pedido, pagoAprobado: true })
          setCarrito([])
          return true
        }
      } catch (error) {
        console.error('Error verificando pago pendiente:', error)
      }

      return false
    }

    verifyPendingPayment().catch(() => {})

    const intervalId = window.setInterval(async () => {
      attempts += 1
      if (cancelled) {
        return
      }

      const approved = await verifyPendingPayment()
      if (approved || attempts >= maxAttempts) {
        window.clearInterval(intervalId)

        if (!approved && attempts >= maxAttempts) {
          clearPendingMercadoPagoOrder()
          setPedidoPendienteMp(null)
          setPageError('No pudimos confirmar el pago. Si ya pagaste, el local lo vera reflejado pronto.')
        }
      }
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [pedidoPendienteMp?.id])

  const seleccionarVariante = useCallback((productoId, varianteId) => {
    setVariantesSeleccionadas((current) => ({
      ...current,
      [productoId]: varianteId
    }))
  }, [])

  const agregarAlCarrito = useCallback((producto) => {
    const normalizedProduct = normalizeCartProduct(producto, variantesSeleccionadas[producto.id])

    setCarrito((current) => {
      const existingItem = current.find((item) => item.id === normalizedProduct.id)
      if (existingItem) {
        return current.map((item) => (
          item.id === normalizedProduct.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        ))
      }

      return [...current, { ...normalizedProduct, cantidad: 1 }]
    })
  }, [variantesSeleccionadas])

  const actualizarCantidad = useCallback((itemId, delta) => {
    setCarrito((current) => current
      .map((item) => (
        item.id === itemId
          ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
          : item
      ))
      .filter((item) => item.cantidad > 0))
  }, [])

  const handleClienteDataChange = useCallback((key, value) => {
    setClienteData((current) => ({ ...current, [key]: value }))
  }, [])

  const subtotal = useMemo(
    () => carrito.reduce((sum, item) => sum + Number(item.precio || 0) * item.cantidad, 0),
    [carrito]
  )

  const deliveryCost = tipoEntrega === 'DELIVERY' ? Number(config?.costo_delivery || 0) : 0
  const total = subtotal + deliveryCost
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)
  const vuelto = metodoPago === 'EFECTIVO' && montoAbonado
    ? Math.max(0, Number(montoAbonado) - total)
    : 0

  const productosFiltrados = useMemo(() => {
    if (categoriaActiva === 'all') {
      return categorias.flatMap((categoria) => categoria.productos || [])
    }
    return categorias.find((categoria) => categoria.id === categoriaActiva)?.productos || []
  }, [categoriaActiva, categorias])

  const validarFormulario = useCallback(() => {
    if (!clienteData.nombre.trim()) return 'Ingresa tu nombre'
    if (!clienteData.telefono.trim()) return 'Ingresa tu telefono'
    if (!clienteData.email.trim()) return 'Ingresa tu email'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteData.email)) return 'Email invalido'
    if (tipoEntrega === 'DELIVERY' && !clienteData.direccion.trim()) return 'Ingresa tu direccion'
    if (metodoPago === 'EFECTIVO' && !montoAbonado) return 'Indica con cuanto abonas'
    if (metodoPago === 'EFECTIVO' && Number(montoAbonado) < total) return 'El monto debe ser mayor o igual al total'
    return null
  }, [clienteData, metodoPago, montoAbonado, tipoEntrega, total])

  const handleWhatsAppFallback = useCallback(() => {
    const message = [
      'Hola! Quiero hacer un pedido:',
      '',
      ...carrito.map((item) => `${item.cantidad}x ${item.nombre}`),
      '',
      `Subtotal: $${subtotal.toLocaleString('es-AR')}`,
      ...(deliveryCost > 0 ? [`Delivery: $${deliveryCost.toLocaleString('es-AR')}`] : []),
      `Total: $${total.toLocaleString('es-AR')}`,
      '',
      `Nombre: ${clienteData.nombre || '-'}`,
      `Telefono: ${clienteData.telefono || '-'}`,
      `Email: ${clienteData.email || '-'}`,
      tipoEntrega === 'DELIVERY'
        ? `Direccion: ${clienteData.direccion || '-'}`
        : 'Retiro en local'
    ].join('\n')

    const url = buildWhatsAppUrl(config?.whatsapp_numero, message)
    if (!url || !openExternalUrl(url)) {
      setPageError('No pudimos abrir WhatsApp desde este dispositivo.')
    }
  }, [carrito, clienteData, config?.whatsapp_numero, deliveryCost, subtotal, tipoEntrega, total])

  const enviarPedido = useCallback(async () => {
    const validationError = validarFormulario()
    if (validationError) {
      setCheckoutError(validationError)
      return
    }

    setEnviandoPedido(true)
    setCheckoutError(null)

    try {
      const payload = {
        items: carrito.map((item) => ({
          productoId: item.id,
          cantidad: item.cantidad
        })),
        clienteNombre: clienteData.nombre,
        clienteTelefono: clienteData.telefono,
        clienteDireccion: clienteData.direccion,
        clienteEmail: clienteData.email,
        tipoEntrega,
        metodoPago,
        montoAbonado: metodoPago === 'EFECTIVO' ? Number(montoAbonado) : null,
        observaciones: clienteData.observaciones
      }

      const data = await fetchJson(
        `${PUBLIC_API_BASE}/pedido`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        'Error al crear pedido'
      )

      if (metodoPago === 'MERCADOPAGO' && data.initPoint) {
        savePendingMercadoPagoOrder({ pedidoId: data.pedido.id })

        const isMobile = /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)
        if (isMobile) {
          if (!navigateExternalUrl(data.initPoint)) {
            clearPendingMercadoPagoOrder()
            setCheckoutError('No pudimos abrir Mercado Pago. Intenta nuevamente.')
            return
          }
        } else {
          const opened = openExternalUrl(data.initPoint)
          if (!opened && !navigateExternalUrl(data.initPoint)) {
            clearPendingMercadoPagoOrder()
            setCheckoutError('No pudimos abrir Mercado Pago. Revisa el navegador e intenta nuevamente.')
            return
          }

          if (opened) {
            setPedidoPendienteMp({ id: data.pedido.id, total: data.pedido.total })
            setShowCheckout(false)
          }
        }

        return
      }

      clearPendingMercadoPagoOrder()
      setPedidoExitoso(data.pedido)
      setCarrito([])
      setShowCheckout(false)
    } catch (error) {
      console.error('Error creando pedido:', error)
      setCheckoutError(error.message || 'Error al procesar el pedido')
    } finally {
      setEnviandoPedido(false)
    }
  }, [carrito, clienteData, metodoPago, montoAbonado, tipoEntrega, validarFormulario])

  if (loading) {
    return <PublicLoadingState label="Cargando menu..." />
  }

  if (verificandoPago) {
    return <PublicVerifyingPaymentState tiempoEspera={tiempoEspera} />
  }

  if (loadError) {
    return (
      <PublicErrorState
        title="No pudimos cargar el menu"
        message={loadError}
        actionLabel="Reintentar"
        onAction={() => loadMenu().catch(() => {})}
      />
    )
  }

  if (config && !config.tienda_abierta) {
    return <PublicClosedState config={config} />
  }

  if (pedidoPendienteMp) {
    return (
      <PublicPendingPaymentState
        pedido={pedidoPendienteMp}
        total={pedidoPendienteMp.total}
        onCancel={() => {
          clearPendingMercadoPagoOrder()
          setPedidoPendienteMp(null)
        }}
      />
    )
  }

  if (pedidoExitoso) {
    return (
      <PublicSuccessState
        pedido={pedidoExitoso}
        onRestart={() => {
          setPedidoExitoso(null)
          navigate(publicMenuPath)
        }}
      />
    )
  }

  return (
    <div className="public-page">
      <PublicHero config={config} backendUrl={PUBLIC_BACKEND_URL} />

      <div className="public-page__content">
        {pageError && (
          <Alert variant="error" dismissible onDismiss={() => setPageError(null)} className="mb-6">
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

          <aside className="hidden lg:block lg:sticky lg:top-24">
            <CartPanel
              cart={carrito}
              totalItems={totalItems}
              subtotal={subtotal}
              deliveryCost={deliveryCost}
              total={total}
              tipoEntrega={tipoEntrega}
              config={config}
              onTipoEntregaChange={setTipoEntrega}
              onCheckout={() => setShowCheckout(true)}
              onUpdateQty={actualizarCantidad}
            />
          </aside>
        </div>
      </div>

      {totalItems > 0 && (
        <button
          type="button"
          onClick={() => setShowCarrito(true)}
          className="floating-cart-btn lg:hidden"
        >
          <ShoppingCartIcon className="w-5 h-5" />
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.18em]">Pedido</span>
            <span className="text-sm font-semibold">{totalItems} item{totalItems === 1 ? '' : 's'}</span>
          </div>
          <span className="ml-auto text-base font-semibold">
            ${total.toLocaleString('es-AR')}
          </span>
        </button>
      )}

      <Drawer open={showCarrito} onClose={() => setShowCarrito(false)} title="Tu pedido" placement="bottom">
        <CartPanel
          cart={carrito}
          totalItems={totalItems}
          subtotal={subtotal}
          deliveryCost={deliveryCost}
          total={total}
          tipoEntrega={tipoEntrega}
          config={config}
          onTipoEntregaChange={setTipoEntrega}
          onCheckout={() => {
            setShowCarrito(false)
            setShowCheckout(true)
          }}
          onUpdateQty={actualizarCantidad}
          title="Tu pedido"
        />
      </Drawer>

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
        onClose={() => setShowCheckout(false)}
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
