import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { navigateExternalUrl, openExternalUrl, buildWhatsAppUrl } from '../utils/external-links'
import { fetchJson, PUBLIC_API_URL } from '../utils/public-fetch'
import {
  clearPendingMercadoPagoOrder,
  loadPendingMercadoPagoOrder,
  savePendingMercadoPagoOrder
} from '../utils/public-storage'
import { parseEnumParam, parsePositiveIntParam } from '../utils/query-params'

const PUBLIC_API_BASE = `${PUBLIC_API_URL}/publico`
const PAYMENT_RESULTS = ['exito', 'error', 'pendiente']
const PENDING_PAYMENT_STATUS = {
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  RETRY_MERCADOPAGO: 'RETRY_MERCADOPAGO',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION'
}

function generateClientRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `menu-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

export default function useMenuPublico() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pedidoIdDesdeQuery = parsePositiveIntParam(searchParams.get('pedido'))
  const pagoResultadoDesdeQuery = parseEnumParam(searchParams.get('pago'), PAYMENT_RESULTS)

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
  const [pedidoPendienteMp, setPedidoPendienteMp] = useState(() => {
    const pendingOrder = loadPendingMercadoPagoOrder()

    return pendingOrder
      ? {
          id: pendingOrder.pedidoId,
          total: pendingOrder.total ?? null,
          status: pendingOrder.status || PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
        }
      : null
  })
  const [verificandoPago, setVerificandoPago] = useState(false)
  const [tiempoEspera, setTiempoEspera] = useState(0)
  const [pageError, setPageError] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviandoPedido, setEnviandoPedido] = useState(false)
  const [procesandoPagoPendiente, setProcesandoPagoPendiente] = useState(false)
  const verificandoPagoDesdeQueryRef = useRef(false)
  const reconciledPendingOrderRef = useRef(null)
  const clientRequestIdRef = useRef(null)
  const skipNextPendingReconciliationRef = useRef(false)

  const publicMenuPath = '/menu'
  const paymentMethodsAvailable = Boolean(config?.mercadopago_enabled || config?.efectivo_enabled)

  const resetClientRequestId = useCallback(() => {
    clientRequestIdRef.current = null
  }, [])

  const getClientRequestId = useCallback(() => {
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = generateClientRequestId()
    }

    return clientRequestIdRef.current
  }, [])

  const persistPendingOrder = useCallback((pendingOrder) => {
    if (!pendingOrder?.id) {
      clearPendingMercadoPagoOrder()
      setPedidoPendienteMp(null)
      reconciledPendingOrderRef.current = null
      return
    }

    savePendingMercadoPagoOrder({
      pedidoId: pendingOrder.id,
      total: pendingOrder.total,
      status: pendingOrder.status || PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
    })

    setPedidoPendienteMp({
      id: pendingOrder.id,
      total: pendingOrder.total ?? null,
      status: pendingOrder.status || PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
    })
  }, [])

  const clearPendingOrder = useCallback(() => {
    clearPendingMercadoPagoOrder()
    setPedidoPendienteMp(null)
    reconciledPendingOrderRef.current = null
    resetClientRequestId()
  }, [resetClientRequestId])

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

  const verifyPendingOrderStatus = useCallback(async ({
    pedidoId,
    pendingStatus = PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION,
    terminalMessage = 'El pedido ya no tiene un pago pendiente para reanudar.'
  }) => {
    if (!pedidoId) {
      clearPendingOrder()
      setPageError('No pudimos recuperar el pedido pendiente en este navegador.')
      return { approved: false, pedido: null }
    }

    const pedido = await fetchJson(
      `${PUBLIC_API_BASE}/pedido/${pedidoId}`,
      {},
      'Error al verificar el pago'
    )

    if (pedido.estadoPago === 'APROBADO') {
      setVerificandoPago(false)
      clearPendingOrder()
      setPedidoExitoso({ ...pedido, pagoAprobado: true })
      setCarrito([])
      setShowCheckout(false)
      return { approved: true, pedido }
    }

    if (['CANCELADO', 'CERRADO'].includes(pedido.estado)) {
      setVerificandoPago(false)
      clearPendingOrder()
      setPageError(terminalMessage)
      return { approved: false, pedido }
    }

    persistPendingOrder({
      id: pedido.id,
      total: pedido.total,
      status: pendingStatus
    })

    return { approved: false, pedido }
  }, [clearPendingOrder, persistPendingOrder])

  const retryPendingMercadoPagoPayment = useCallback(async () => {
    if (!pedidoPendienteMp?.id) {
      clearPendingOrder()
      setPageError('No pudimos recuperar el pedido pendiente en este navegador.')
      return
    }

    setProcesandoPagoPendiente(true)
    setPageError(null)

    try {
      const data = await fetchJson(
        `${PUBLIC_API_BASE}/pedido/${pedidoPendienteMp.id}/pagar`,
        {
          method: 'POST'
        },
        'No pudimos preparar el reintento de pago'
      )

      persistPendingOrder({
        id: pedidoPendienteMp.id,
        total: pedidoPendienteMp.total,
        status: PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
      })

      if (!navigateExternalUrl(data.initPoint)) {
        persistPendingOrder({
          id: pedidoPendienteMp.id,
          total: pedidoPendienteMp.total,
          status: PENDING_PAYMENT_STATUS.RETRY_MERCADOPAGO
        })
      }
    } catch (error) {
      console.error('Error reintentando pago en Mercado Pago:', error)
      persistPendingOrder({
        id: pedidoPendienteMp.id,
        total: pedidoPendienteMp.total,
        status: PENDING_PAYMENT_STATUS.PAYMENT_ERROR
      })
      setPageError(error.message || 'No pudimos reintentar el pago en este momento.')
    } finally {
      setProcesandoPagoPendiente(false)
    }
  }, [clearPendingOrder, pedidoPendienteMp, persistPendingOrder])

  const verifyPendingOrderManually = useCallback(async () => {
    if (!pedidoPendienteMp?.id) {
      clearPendingOrder()
      return
    }

    setProcesandoPagoPendiente(true)
    setPageError(null)

    try {
      await verifyPendingOrderStatus({
        pedidoId: pedidoPendienteMp.id,
        pendingStatus: PENDING_PAYMENT_STATUS.PENDING_CONFIRMATION
      })
    } catch (error) {
      console.error('Error verificando pago pendiente:', error)
      setPageError(error.message || 'No pudimos verificar el pago en este momento.')
    } finally {
      setProcesandoPagoPendiente(false)
    }
  }, [clearPendingOrder, pedidoPendienteMp, verifyPendingOrderStatus])

  useEffect(() => {
    loadMenu().catch(() => {})
  }, [loadMenu])

  useEffect(() => {
    if (!pedidoIdDesdeQuery) {
      return
    }

    if (pagoResultadoDesdeQuery === 'error') {
      return
    }

    persistPendingOrder({
      id: pedidoIdDesdeQuery,
      total: pedidoPendienteMp?.id === pedidoIdDesdeQuery ? pedidoPendienteMp.total : null,
      status: PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
    })
  }, [
    pagoResultadoDesdeQuery,
    pedidoIdDesdeQuery,
    pedidoPendienteMp?.id,
    pedidoPendienteMp?.total,
    persistPendingOrder
  ])

  useEffect(() => {
    if (showCheckout) {
      setCheckoutError(null)
    }
  }, [showCheckout])

  useEffect(() => {
    if (!pagoResultadoDesdeQuery || !pedidoIdDesdeQuery) {
      verificandoPagoDesdeQueryRef.current = false
      return undefined
    }

    if (verificandoPagoDesdeQueryRef.current) {
      return undefined
    }

    verificandoPagoDesdeQueryRef.current = true

    let cancelled = false
    let intervalId = null

    if (pagoResultadoDesdeQuery === 'error') {
      skipNextPendingReconciliationRef.current = true
      reconciledPendingOrderRef.current = String(pedidoIdDesdeQuery)
      persistPendingOrder({
        id: pedidoIdDesdeQuery,
        total: pedidoPendienteMp?.total ?? null,
        status: PENDING_PAYMENT_STATUS.PAYMENT_ERROR
      })
      setPageError('El pago no fue aprobado. Puedes reintentarlo con el mismo pedido.')
      navigate(publicMenuPath, { replace: true })
      return undefined
    }

    setVerificandoPago(true)
    setTiempoEspera(0)

    const verificarPago = async () => {
      try {
        if (cancelled) {
          return false
        }

        const { approved } = await verifyPendingOrderStatus({
          pedidoId: pedidoIdDesdeQuery,
          pendingStatus: PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
        })
        return approved
      } catch (error) {
        console.error('Error verificando pago:', error)
      }

      return false
    }

    const startPolling = async () => {
      const aprobado = await verificarPago()
      if (aprobado || cancelled) {
        if (aprobado) {
          setVerificandoPago(false)
          navigate(publicMenuPath, { replace: true })
        }
        return
      }

      let attempts = 0
      const maxAttempts = 40

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

          if (paid) {
            setVerificandoPago(false)
            navigate(publicMenuPath, { replace: true })
          }

          if (!paid && attempts >= maxAttempts) {
            setVerificandoPago(false)
            skipNextPendingReconciliationRef.current = true
            reconciledPendingOrderRef.current = String(pedidoIdDesdeQuery)
            persistPendingOrder({
              id: pedidoIdDesdeQuery,
              total: pedidoPendienteMp?.total ?? null,
              status: PENDING_PAYMENT_STATUS.PENDING_CONFIRMATION
            })
            setPageError('No pudimos confirmar el pago todavia. Puedes verificarlo de nuevo o reintentar Mercado Pago.')
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
  }, [
    clearPendingOrder,
    navigate,
    pedidoIdDesdeQuery,
    pedidoPendienteMp?.total,
    pagoResultadoDesdeQuery,
    persistPendingOrder,
    publicMenuPath,
    verifyPendingOrderStatus
  ])

  useEffect(() => {
    if (!pedidoPendienteMp?.id || (pedidoIdDesdeQuery && pagoResultadoDesdeQuery)) {
      if (!pedidoPendienteMp?.id) {
        reconciledPendingOrderRef.current = null
      }
      return undefined
    }

    const reconciliationKey = String(pedidoPendienteMp.id)

    if (skipNextPendingReconciliationRef.current) {
      skipNextPendingReconciliationRef.current = false
      return undefined
    }

    if ([
      PENDING_PAYMENT_STATUS.RETRY_MERCADOPAGO,
      PENDING_PAYMENT_STATUS.PAYMENT_ERROR,
      PENDING_PAYMENT_STATUS.PENDING_CONFIRMATION
    ].includes(pedidoPendienteMp.status)) {
      return undefined
    }

    if (reconciledPendingOrderRef.current === reconciliationKey) {
      return undefined
    }

    reconciledPendingOrderRef.current = reconciliationKey

    verifyPendingOrderStatus({
      pedidoId: pedidoPendienteMp.id,
      pendingStatus: pedidoPendienteMp.status || PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION,
      terminalMessage: 'El pedido ya no tiene un pago pendiente para reanudar.'
    }).catch((error) => {
      console.error('Error reconciliando pedido pendiente:', error)
    })

    return undefined
  }, [
    clearPendingOrder,
    pagoResultadoDesdeQuery,
    pedidoIdDesdeQuery,
    pedidoPendienteMp?.id,
    pedidoPendienteMp?.status,
    verifyPendingOrderStatus
  ])

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
    if (!paymentMethodsAvailable) return 'No hay medios de pago habilitados en este momento'
    if (metodoPago === 'MERCADOPAGO' && !config?.mercadopago_enabled) return 'Mercado Pago no esta disponible en este momento'
    if (metodoPago === 'EFECTIVO' && !config?.efectivo_enabled) return 'El pago en efectivo no esta disponible en este momento'
    if (!clienteData.nombre.trim()) return 'Ingresa tu nombre'
    if (!clienteData.telefono.trim()) return 'Ingresa tu telefono'
    if (clienteData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteData.email)) return 'Email invalido'
    if (tipoEntrega === 'DELIVERY' && !clienteData.direccion.trim()) return 'Ingresa tu direccion'
    if (metodoPago === 'EFECTIVO' && !montoAbonado) return 'Indica con cuanto abonas'
    if (metodoPago === 'EFECTIVO' && Number(montoAbonado) < total) return 'El monto debe ser mayor o igual al total'
    return null
  }, [clienteData, config?.efectivo_enabled, config?.mercadopago_enabled, metodoPago, montoAbonado, paymentMethodsAvailable, tipoEntrega, total])

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
      const clientRequestId = getClientRequestId()
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
        clientRequestId,
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
        persistPendingOrder({
          id: data.pedido.id,
          total: data.pedido.total,
          status: PENDING_PAYMENT_STATUS.AWAITING_CONFIRMATION
        })

        if (!navigateExternalUrl(data.initPoint)) {
          persistPendingOrder({
            id: data.pedido.id,
            total: data.pedido.total,
            status: PENDING_PAYMENT_STATUS.RETRY_MERCADOPAGO
          })
          setCheckoutError('No pudimos abrir Mercado Pago. Reintenta el pago sobre el mismo pedido.')
          return
        }

        setShowCheckout(false)
        return
      }

      clearPendingOrder()
      setPedidoExitoso(data.pedido)
      setCarrito([])
      setShowCheckout(false)
      resetClientRequestId()
    } catch (error) {
      console.error('Error creando pedido:', error)
      setCheckoutError(error.message || 'Error al procesar el pedido')
    } finally {
      setEnviandoPedido(false)
    }
  }, [
    carrito,
    clearPendingOrder,
    clienteData,
    getClientRequestId,
    metodoPago,
    montoAbonado,
    persistPendingOrder,
    resetClientRequestId,
    tipoEntrega,
    validarFormulario
  ])

  const pendingPaymentCopy = useMemo(() => {
    switch (pedidoPendienteMp?.status) {
      case PENDING_PAYMENT_STATUS.RETRY_MERCADOPAGO:
        return {
          title: 'No pudimos abrir Mercado Pago',
          message: 'Tu pedido ya fue creado. Reintenta Mercado Pago para continuar con el mismo pedido.'
        }
      case PENDING_PAYMENT_STATUS.PAYMENT_ERROR:
        return {
          title: 'El pago no fue aprobado',
          message: 'Tu pedido sigue pendiente. Puedes verificar si el pago impacto o reintentar Mercado Pago.'
        }
      case PENDING_PAYMENT_STATUS.PENDING_CONFIRMATION:
        return {
          title: 'Aun no confirmamos el pago',
          message: 'Si ya pagaste, vuelve a verificar en unos segundos. Si no, puedes reintentar Mercado Pago sin crear otro pedido.'
        }
      default:
        return {
          title: 'Esperando confirmacion de pago',
          message: 'Completa el pago en Mercado Pago. Esta pantalla se actualiza automaticamente mientras el pedido sigue pendiente.'
        }
    }
  }, [pedidoPendienteMp?.status])

  const handleCancelPendingOrder = useCallback(() => {
    clearPendingOrder()
    setPageError(null)
  }, [clearPendingOrder])

  const handleRestartAfterSuccess = useCallback(() => {
    clearPendingOrder()
    setPedidoExitoso(null)
    navigate(publicMenuPath)
  }, [clearPendingOrder, navigate, publicMenuPath])

  const handleOpenCheckout = useCallback(() => {
    setShowCheckout(true)
  }, [])

  const handleCloseCheckout = useCallback(() => {
    setShowCheckout(false)
  }, [])

  const handleOpenCarrito = useCallback(() => {
    setShowCarrito(true)
  }, [])

  const handleCloseCarrito = useCallback(() => {
    setShowCarrito(false)
  }, [])

  const handleOpenCheckoutFromDrawer = useCallback(() => {
    setShowCarrito(false)
    setShowCheckout(true)
  }, [])

  const handleDismissPageError = useCallback(() => {
    setPageError(null)
  }, [])

  return {
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
  }
}
