import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  EyeIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import useEventSource from './useEventSource'
import useAsync from './useAsync'
import useMobileViewport from './useMobileViewport'
import { formatArsPos, formatPosInputValue } from '../utils/currency'
import { parseBooleanFlag, parsePositiveIntParam } from '../utils/query-params'

const estadoBadges = {
  PENDIENTE: 'badge-warning',
  EN_PREPARACION: 'badge-info',
  LISTO: 'badge-success',
  ENTREGADO: 'badge-info',
  COBRADO: 'badge-success',
  CERRADO: 'badge-info',
  CANCELADO: 'badge-error'
}

const sumPagosRegistrados = (pagos = []) => pagos
  .filter((pago) => !['RECHAZADO', 'CANCELADO'].includes(pago.estado))
  .reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0)

const calcularPendientePedido = (pedido) => Math.max(
  0,
  parseFloat(pedido?.total || 0) - sumPagosRegistrados(pedido?.pagos || [])
)

const CANAL_COBRO_POS = 'CAJA'
const FLOAT_EPSILON = 0.01

const buildPagoForm = (pedido, overrides = {}) => ({
  monto: formatPosInputValue(calcularPendientePedido(pedido)),
  metodo: 'EFECTIVO',
  referencia: '',
  canalCobro: CANAL_COBRO_POS,
  propinaMonto: '',
  propinaMetodo: 'EFECTIVO',
  montoAbonado: '',
  ...overrides
})

const TRANSFERENCIA_MP_CONFIG_INICIAL = {
  mercadopago_transfer_alias: '',
  mercadopago_transfer_titular: '',
  mercadopago_transfer_cvu: ''
}

const buildTransferenciaMpConfig = (config) => ({
  mercadopago_transfer_alias: config?.mercadopago_transfer_alias || config?.alias || '',
  mercadopago_transfer_titular: config?.mercadopago_transfer_titular || config?.titular || '',
  mercadopago_transfer_cvu: config?.mercadopago_transfer_cvu || config?.cvu || ''
})

const normalizePedidosResponse = (payload) => {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      total: payload.length
    }
  }

  const data = Array.isArray(payload?.data) ? payload.data : []
  const fallbackTotal = data.length
  const total = Number.isFinite(payload?.total) ? payload.total : fallbackTotal

  return { data, total }
}

const PEDIDOS_PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 350

const buildPedidosQuery = ({
  q = '',
  estado = '',
  tipo = '',
  fecha = '',
  limit = PEDIDOS_PAGE_SIZE,
  offset = 0,
  mesaId = null
} = {}) => {
  const params = new URLSearchParams()

  if (q) params.set('q', q)
  if (estado) params.set('estado', estado)
  if (estado === 'CERRADO' || estado === 'CANCELADO') params.set('incluirCerrados', 'true')
  if (tipo) params.set('tipo', tipo)
  if (fecha) params.set('fecha', fecha)
  if (mesaId) params.set('mesaId', String(mesaId))

  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return params.toString()
}

const matchesPedidoFilter = (pedido, { q = '', estado = '', tipo = '', fecha = '', mesaId = null } = {}) => {
  if (!pedido?.estado) {
    return false
  }

  if (mesaId) {
    const pedidoMesaId = Number(pedido.mesaId || pedido.mesa?.id)

    if (pedidoMesaId !== Number(mesaId)) {
      return false
    }
  }

  if (tipo && pedido.tipo !== tipo) {
    return false
  }

  if (fecha) {
    const pedidoDate = pedido.createdAt
      ? new Date(pedido.createdAt).toISOString().slice(0, 10)
      : null

    if (pedidoDate !== fecha) {
      return false
    }
  }

  if (q) {
    const searchTerm = q.trim().toLowerCase()
    const pedidoId = String(pedido.id || '')
    const mesaNumero = String(pedido.mesa?.numero || '')
    const clienteNombre = String(pedido.clienteNombre || '').toLowerCase()
    const matchesNumeric = /^\d+$/.test(searchTerm) && (pedidoId === searchTerm || mesaNumero === searchTerm)
    const matchesCliente = clienteNombre.includes(searchTerm)

    if (!matchesNumeric && !matchesCliente) {
      return false
    }
  }

  if (estado) {
    return pedido.estado === estado
  }

  return !['CERRADO', 'CANCELADO'].includes(pedido.estado)
}

export { estadoBadges, calcularPendientePedido, FLOAT_EPSILON }

export default function usePedidosPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobileViewport = useMobileViewport()
  const esSoloMozo = usuario?.rol === 'MOZO'
  const puedeAbrirNuevoPedido = ['ADMIN', 'CAJERO', 'MOZO'].includes(usuario?.rol)
  const puedeAsignarDelivery = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const puedeRegistrarPago = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const puedeFacturar = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const puedeCerrarPedido = ['ADMIN', 'CAJERO', 'MOZO'].includes(usuario?.rol)
  const puedeLiberarMesa = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const pedidoEnfocadoId = parsePositiveIntParam(searchParams.get('pedidoId'))
  const mesaIdFiltrada = parsePositiveIntParam(searchParams.get('mesaId'))
  const abrirPagoDesdeQuery = parseBooleanFlag(searchParams.get('openPago'))
  const rutaMesas = esSoloMozo ? '/mozo/mesas' : '/mesas'
  const rutaNuevoPedidoMozo = mesaIdFiltrada ? `/mozo/nuevo-pedido/${mesaIdFiltrada}` : '/mozo/nuevo-pedido'

  const [pedidos, setPedidos] = useState([])
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const pedidosRef = useRef([])
  const pedidoSeleccionadoRef = useRef(null)
  const loadedLimitRef = useRef(PEDIDOS_PAGE_SIZE)
  const loadingMoreRef = useRef(false)
  const pagoSubmitInFlightRef = useRef(false)
  const deliveryModalPedidoRef = useRef(null)
  const montoInputRef = useRef(null)
  const metodoPagoInputRef = useRef(null)
  const metodoPagoPrevRef = useRef('EFECTIVO')
  const montoAbonadoInputRef = useRef(null)
  const referenciaInputRef = useRef(null)
  const propinaMontoInputRef = useRef(null)
  const [pagoForm, setPagoForm] = useState({
    monto: '',
    metodo: 'EFECTIVO',
    referencia: '',
    canalCobro: CANAL_COBRO_POS,
    propinaMonto: '',
    propinaMetodo: 'EFECTIVO',
    montoAbonado: ''
  })
  const [transferenciaMpConfig, setTransferenciaMpConfig] = useState(TRANSFERENCIA_MP_CONFIG_INICIAL)
  const [registrandoPago, setRegistrandoPago] = useState(false)
  const [mostrarPropina, setMostrarPropina] = useState(false)
  const [propinaMetodoPersonalizado, setPropinaMetodoPersonalizado] = useState(false)
  const [showNuevoPedidoModal, setShowNuevoPedidoModal] = useState(false)
  const [showAsignarDeliveryModal, setShowAsignarDeliveryModal] = useState(false)
  const [pedidoDeliveryListoId, setPedidoDeliveryListoId] = useState(null)
  const [repartidores, setRepartidores] = useState([])
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState('')
  const [asignandoDelivery, setAsignandoDelivery] = useState(false)
  const [showFacturacionModal, setShowFacturacionModal] = useState(false)
  const [pedidoParaFacturar, setPedidoParaFacturar] = useState(null)
  const [showDescuentoModal, setShowDescuentoModal] = useState(false)
  const [descuentoForm, setDescuentoForm] = useState({ descuento: '', motivo: '' })
  const [aplicandoDescuento, setAplicandoDescuento] = useState(false)
  const [showCambiarMesaModal, setShowCambiarMesaModal] = useState(false)
  const [mesasLibres, setMesasLibres] = useState([])
  const [nuevaMesaId, setNuevaMesaId] = useState('')
  const [cambiandoMesa, setCambiandoMesa] = useState(false)
  const [mesaContexto, setMesaContexto] = useState(null)
  const [mesaContextoError, setMesaContextoError] = useState(false)

  const pedidoMesaAbierto = useMemo(() => {
    if (mesaContexto?.pedidos?.length) {
      return mesaContexto.pedidos.find((pedido) => !['CERRADO', 'CANCELADO'].includes(pedido.estado)) || null
    }

    if (!mesaIdFiltrada) {
      return null
    }

    return pedidos.find((pedido) => !['CERRADO', 'CANCELADO'].includes(pedido.estado)) || null
  }, [mesaContexto, mesaIdFiltrada, pedidos])
  const modoAgregarConsumoMesa = Boolean(mesaIdFiltrada && pedidoMesaAbierto?.id)

  const abrirFacturacion = (pedido) => {
    setPedidoParaFacturar(pedido)
    setShowFacturacionModal(true)
  }

  useEffect(() => {
    pedidosRef.current = pedidos
  }, [pedidos])

  useEffect(() => {
    pedidoSeleccionadoRef.current = pedidoSeleccionado
  }, [pedidoSeleccionado])

  const cargarPedidos = useCallback(async ({ limit = loadedLimitRef.current, offset = 0 } = {}) => {
    const response = await api.get(`/pedidos?${buildPedidosQuery({
      q: busquedaDebounced,
      estado: filtroEstado,
      tipo: filtroTipo,
      fecha: filtroFecha,
      limit,
      offset,
      mesaId: mesaIdFiltrada
    })}`)
    const result = normalizePedidosResponse(response.data)
    const { data, total } = result
    setPedidos(data)
    setTotalPedidos(total)
    return result
  }, [busquedaDebounced, filtroEstado, filtroFecha, filtroTipo, mesaIdFiltrada])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarPedidosRequest = useCallback(async (_ctx, options = {}) => (
    cargarPedidos(options)
  ), [cargarPedidos])

  const { loading, execute: cargarPedidosAsync } = useAsync(
    cargarPedidosRequest,
    { immediate: false, onError: handleLoadError }
  )

  const refetchPedidosWindow = useCallback((limit = loadedLimitRef.current) => (
    cargarPedidosAsync({ limit })
  ), [cargarPedidosAsync])

  const sincronizarPedidoVisible = useCallback((pedidoActualizado) => {
    if (!pedidoActualizado?.id) {
      return 'ignored'
    }

    const wasVisible = pedidosRef.current.some((pedido) => pedido.id === pedidoActualizado.id)
    if (!wasVisible) {
      return 'ignored'
    }

      if (!matchesPedidoFilter(pedidoActualizado, {
        q: busquedaDebounced,
        estado: filtroEstado,
        tipo: filtroTipo,
        fecha: filtroFecha,
        mesaId: mesaIdFiltrada
      })) {
      setPedidos((current) => current.filter((pedido) => pedido.id !== pedidoActualizado.id))
      return 'removed'
    }

    setPedidos((current) => current.map((pedido) => (
      pedido.id === pedidoActualizado.id
        ? { ...pedido, ...pedidoActualizado, impresion: pedidoActualizado.impresion ?? pedido.impresion }
        : pedido
    )))

    return 'updated'
  }, [busquedaDebounced, filtroEstado, filtroFecha, filtroTipo, mesaIdFiltrada])

  const obtenerPedidoPorId = useCallback(async (id) => {
    const response = await api.get(`/pedidos/${id}`)
    return response.data
  }, [])

  const cargarTransferenciaMpConfig = useCallback(async () => {
    const response = await api.get('/pagos/mercadopago/transferencia-config', { skipToast: true })
    const payload = response?.data && typeof response.data === 'object' && !Array.isArray(response.data)
      ? response.data
      : {}

    setTransferenciaMpConfig(buildTransferenciaMpConfig(payload))
  }, [])

  const clearFocusParams = useCallback(() => {
    if (!searchParams.get('pedidoId') && !searchParams.get('openPago') && !searchParams.get('mesaId')) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('pedidoId')
    nextParams.delete('openPago')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const limpiarFiltroMesa = useCallback(() => {
    if (!mesaIdFiltrada) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('mesaId')
    setSearchParams(nextParams, { replace: true })
  }, [mesaIdFiltrada, searchParams, setSearchParams])

  useEffect(() => {
    let isCancelled = false

    if (!mesaIdFiltrada) {
      setMesaContexto(null)
      setMesaContextoError(false)
      return undefined
    }

    setMesaContexto(null)
    setMesaContextoError(false)

    api.get(`/mesas/${mesaIdFiltrada}`, { skipToast: true })
      .then((response) => {
        if (isCancelled) {
          return
        }

        setMesaContexto(response.data || null)
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        console.error('Error cargando contexto de mesa:', error)
        setMesaContexto(null)
        setMesaContextoError(true)
      })

    return () => {
      isCancelled = true
    }
  }, [mesaIdFiltrada])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setBusquedaDebounced(filtroBusqueda.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [filtroBusqueda])

  useEffect(() => {
    loadedLimitRef.current = PEDIDOS_PAGE_SIZE
    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [busquedaDebounced, filtroEstado, filtroFecha, filtroTipo, mesaIdFiltrada])

  useEffect(() => {
    if (filtroTipo || filtroFecha) {
      setMostrarFiltrosAvanzados(true)
    }
  }, [filtroFecha, filtroTipo])

  // Cargar pedidos cuando cambia el filtro
  useEffect(() => {
    cargarPedidosAsync()
      .catch(() => {})
  }, [cargarPedidosAsync])

  const abrirAsignarDelivery = useCallback(async (pedidoId) => {
    if (deliveryModalPedidoRef.current === pedidoId) return
    deliveryModalPedidoRef.current = pedidoId
    setPedidoDeliveryListoId(pedidoId)
    try {
      const res = await api.get('/pedidos/delivery/repartidores')
      setRepartidores(res.data)
      setRepartidorSeleccionado(res.data.length === 1 ? String(res.data[0].id) : '')
    } catch {
      setRepartidores([])
    }
    setShowAsignarDeliveryModal(true)
  }, [])

  const handleSseUpdate = useCallback(async (eventName, event) => {
    let data = null
    try {
      data = JSON.parse(event.data)
    } catch (_error) {
      data = null
    }
    const pedidoId = data?.id || data?.pedidoId
    if (!pedidoId) return

    if (data?.tipo === 'DELIVERY' && data?.estado === 'LISTO' && puedeAsignarDelivery) {
      toast('Pedido delivery #' + data.id + ' listo para despachar', { icon: '🚀', duration: 8000 })
      abrirAsignarDelivery(data.id)
    }

    const isVisible = pedidosRef.current.some((pedido) => pedido.id === pedidoId)
    const isSelected = pedidoSeleccionadoRef.current?.id === pedidoId

    if (!isVisible) {
      if (isSelected) {
        const pedidoActualizado = await obtenerPedidoPorId(pedidoId)
        setPedidoSeleccionado(pedidoActualizado)
      }

      if (eventName !== 'impresion.updated') {
        await refetchPedidosWindow()
      }
      return
    }

    const pedidoActualizado = await obtenerPedidoPorId(pedidoId)

    if (isSelected) {
      setPedidoSeleccionado(pedidoActualizado)
    }

    const syncResult = sincronizarPedidoVisible(pedidoActualizado)
    if (syncResult === 'removed') {
      await refetchPedidosWindow()
    }
  }, [abrirAsignarDelivery, obtenerPedidoPorId, puedeAsignarDelivery, refetchPedidosWindow, sincronizarPedidoVisible])

  const handleSseError = useCallback((err) => {
    console.error('[SSE] Error en conexion:', err)
  }, [])

  const handleSseOpen = useCallback(() => {
    console.log('[SSE] Conexion establecida')
  }, [])

  useEventSource({
    events: {
      'pedido.updated': (event) => {
        handleSseUpdate('pedido.updated', event).catch(() => {})
      },
      'pago.updated': (event) => {
        handleSseUpdate('pago.updated', event).catch(() => {})
      },
      'impresion.updated': (event) => {
        handleSseUpdate('impresion.updated', event).catch(() => {})
      }
    },
    onError: handleSseError,
    onOpen: handleSseOpen
  })

  const focusField = useCallback((ref, selectValue = false) => {
    if (!ref?.current) {
      return
    }

    window.requestAnimationFrame(() => {
      ref.current?.focus()
      if (selectValue && typeof ref.current?.select === 'function') {
        ref.current.select()
      }
    })
  }, [])

  const resetPagoUiState = useCallback(() => {
    setMostrarPropina(false)
    setPropinaMetodoPersonalizado(false)
    metodoPagoPrevRef.current = 'EFECTIVO'
  }, [])

  const cerrarModalPago = useCallback(() => {
    pagoSubmitInFlightRef.current = false
    setShowPagoModal(false)
    setRegistrandoPago(false)
    setPagoForm(buildPagoForm(null))
    resetPagoUiState()
  }, [resetPagoUiState])

  const verDetalle = useCallback(async (id) => {
    try {
      const pedido = await obtenerPedidoPorId(id)
      setPedidoSeleccionado(pedido)
      setShowModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }, [obtenerPedidoPorId])

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado })
      toast.success(`Estado cambiado a ${nuevoEstado}`)
      cargarPedidosAsync()
        .catch(() => {})
      if (pedidoSeleccionado?.id === id) {
        verDetalle(id)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const abrirCambiarMesa = async () => {
    try {
      const res = await api.get('/mesas?activa=true')
      const libres = (res.data || []).filter((m) => m.estado === 'LIBRE')
      setMesasLibres(libres)
      setNuevaMesaId('')
      setShowCambiarMesaModal(true)
    } catch (err) {
      console.error('Error al cargar mesas:', err)
    }
  }

  const handleCambiarMesa = async () => {
    if (!nuevaMesaId) return
    setCambiandoMesa(true)
    try {
      await api.patch(`/pedidos/${pedidoSeleccionado.id}/cambiar-mesa`, { nuevoMesaId: Number(nuevaMesaId) })
      toast.success('Mesa cambiada')
      setShowCambiarMesaModal(false)
      verDetalle(pedidoSeleccionado.id)
      cargarPedidosAsync().catch(() => {})
    } catch (err) {
      console.error('Error al cambiar mesa:', err)
    } finally {
      setCambiandoMesa(false)
    }
  }

  const handleAplicarDescuento = async () => {
    const monto = parseFloat(descuentoForm.descuento)
    if (!Number.isFinite(monto) || monto < 0) return
    setAplicandoDescuento(true)
    try {
      await api.patch(`/pedidos/${pedidoSeleccionado.id}/descuento`, {
        descuento: monto,
        ...(descuentoForm.motivo ? { motivo: descuentoForm.motivo } : {})
      })
      toast.success(monto > 0 ? `Descuento de $${monto} aplicado` : 'Descuento removido')
      setShowDescuentoModal(false)
      setDescuentoForm({ descuento: '', motivo: '' })
      verDetalle(pedidoSeleccionado.id)
      cargarPedidosAsync().catch(() => {})
    } catch (error) {
      console.error('Error al aplicar descuento:', error)
    } finally {
      setAplicandoDescuento(false)
    }
  }

  const abrirPago = useCallback(async (pedido) => {
    try {
      const [pedidoActualizado] = await Promise.all([
        obtenerPedidoPorId(pedido.id),
        cargarTransferenciaMpConfig().catch((error) => {
          console.error('Error:', error)
        })
      ])

      setPedidoSeleccionado(pedidoActualizado)
      setPagoForm(buildPagoForm(pedidoActualizado))
      resetPagoUiState()
      setShowPagoModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }, [cargarTransferenciaMpConfig, obtenerPedidoPorId, resetPagoUiState])

  useEffect(() => {
    if (!pedidoEnfocadoId) {
      return
    }

    const openFromQuery = async () => {
      try {
        if (abrirPagoDesdeQuery) {
          await abrirPago({ id: pedidoEnfocadoId })
        } else {
          await verDetalle(pedidoEnfocadoId)
        }
      } finally {
        clearFocusParams()
      }
    }

    openFromQuery().catch(() => {})
  }, [abrirPago, abrirPagoDesdeQuery, clearFocusParams, pedidoEnfocadoId, verDetalle])

  useEffect(() => {
    if (!showPagoModal) {
      metodoPagoPrevRef.current = pagoForm.metodo
      return
    }

    focusField(montoInputRef, true)
  }, [focusField, showPagoModal, pedidoSeleccionado?.id])

  useEffect(() => {
    if (!showPagoModal) {
      return
    }

    if (metodoPagoPrevRef.current === pagoForm.metodo) {
      return
    }

    focusField(pagoForm.metodo === 'EFECTIVO' ? montoAbonadoInputRef : referenciaInputRef, pagoForm.metodo === 'MERCADOPAGO')
    metodoPagoPrevRef.current = pagoForm.metodo
  }, [focusField, pagoForm.metodo, showPagoModal])

  const handleMetodoPagoChange = useCallback((metodo) => {
    setPagoForm((current) => ({
      ...current,
      canalCobro: CANAL_COBRO_POS,
      metodo,
      referencia: metodo === 'MERCADOPAGO' ? current.referencia : '',
      montoAbonado: metodo === 'EFECTIVO' ? current.montoAbonado : '',
      propinaMetodo: mostrarPropina && !propinaMetodoPersonalizado
        ? metodo
        : current.propinaMetodo
    }))
  }, [mostrarPropina, propinaMetodoPersonalizado])

  const handleTogglePropina = useCallback(() => {
    setMostrarPropina((current) => {
      const next = !current

      setPagoForm((form) => ({
        ...form,
        propinaMonto: next ? form.propinaMonto : '',
        propinaMetodo: next ? form.metodo : form.metodo
      }))
      setPropinaMetodoPersonalizado(false)

      if (next) {
        focusField(propinaMontoInputRef)
      }

      return next
    })
  }, [focusField])

  const handlePropinaMontoChange = useCallback((value) => {
    setPagoForm((current) => ({
      ...current,
      propinaMonto: value,
      propinaMetodo: !propinaMetodoPersonalizado ? current.metodo : current.propinaMetodo
    }))
  }, [propinaMetodoPersonalizado])

  const handlePropinaMetodoChange = useCallback((value) => {
    setPropinaMetodoPersonalizado(true)
    setPagoForm((current) => ({ ...current, propinaMetodo: value }))
  }, [])

  const handleUsarMontoPendiente = useCallback(() => {
    setPagoForm((current) => ({
      ...current,
      monto: calcularPendientePedido(pedidoSeleccionado).toFixed(2)
    }))
    focusField(montoInputRef, true)
  }, [focusField, pedidoSeleccionado])

  const totalPedidoSeleccionado = parseFloat(pedidoSeleccionado?.total || 0)
  const totalPagadoSeleccionado = sumPagosRegistrados(pedidoSeleccionado?.pagos || [])
  const saldoPendienteActual = calcularPendientePedido(pedidoSeleccionado)
  const montoPendienteSugerido = formatPosInputValue(saldoPendienteActual)
  const montoPago = Number.parseFloat(pagoForm.monto || 0)
  const propinaMonto = Number.parseFloat(pagoForm.propinaMonto || 0)
  const montoAbonado = Number.parseFloat(pagoForm.montoAbonado || 0)
  const totalARegistrar = (Number.isFinite(montoPago) ? montoPago : 0) + (Number.isFinite(propinaMonto) ? propinaMonto : 0)
  const diferenciaEfectivo = Number.isFinite(montoAbonado) ? montoAbonado - totalARegistrar : null
  const montoFueEditado = Math.abs((Number.isFinite(montoPago) ? montoPago : 0) - saldoPendienteActual) > FLOAT_EPSILON
  const montoExcedePendiente = Number.isFinite(montoPago) && montoPago > saldoPendienteActual + FLOAT_EPSILON
  const montoInvalido = pagoForm.monto !== '' && (!Number.isFinite(montoPago) || montoPago <= 0)
  const efectivoInsuficiente = pagoForm.metodo === 'EFECTIVO' &&
    pagoForm.montoAbonado !== '' &&
    Number.isFinite(diferenciaEfectivo) &&
    diferenciaEfectivo < -FLOAT_EPSILON
  const mostrarTransferenciaMercadoPago = pagoForm.metodo === 'MERCADOPAGO' && pagoForm.canalCobro === CANAL_COBRO_POS
  const aliasTransferenciaConfigurado = transferenciaMpConfig.mercadopago_transfer_alias.trim().length > 0
  const mercadoPagoNoDisponible = pagoForm.metodo === 'MERCADOPAGO' && !aliasTransferenciaConfigurado
  const montoError = montoInvalido
    ? 'Ingresa un monto valido.'
    : montoExcedePendiente
      ? `El monto no puede superar el saldo pendiente (${formatArsPos(saldoPendienteActual)}).`
      : null
  const montoAbonadoHelper = pagoForm.metodo === 'EFECTIVO' && pagoForm.montoAbonado !== '' && Number.isFinite(diferenciaEfectivo)
    ? diferenciaEfectivo > FLOAT_EPSILON
      ? `Vuelto estimado: ${formatArsPos(diferenciaEfectivo)}`
      : diferenciaEfectivo < -FLOAT_EPSILON
        ? `Faltan: ${formatArsPos(Math.abs(diferenciaEfectivo))}`
        : 'Pago exacto.'
    : null
  const referenciaLabel = mostrarTransferenciaMercadoPago
    ? 'Referencia de transferencia (opcional)'
    : 'Referencia'
  const referenciaPlaceholder = mostrarTransferenciaMercadoPago
    ? 'Ej. numero o codigo de operacion'
    : 'Numero de referencia'
  const resumenCobro = totalPagadoSeleccionado > FLOAT_EPSILON
    ? [
        { label: 'Saldo pendiente', value: formatArsPos(saldoPendienteActual), emphasize: true },
        { label: 'Pagado', value: formatArsPos(totalPagadoSeleccionado) },
        { label: 'Total pedido', value: formatArsPos(totalPedidoSeleccionado) }
      ]
    : [
        { label: 'Saldo pendiente', value: formatArsPos(saldoPendienteActual), emphasize: true },
        { label: 'Total pedido', value: formatArsPos(totalPedidoSeleccionado) }
      ]
  const pagoFormId = pedidoSeleccionado ? `registrar-pago-${pedidoSeleccionado.id}` : 'registrar-pago'
  const submitDisabled = registrandoPago || !pagoForm.monto || Boolean(montoError) || efectivoInsuficiente || mercadoPagoNoDisponible

  const registrarPago = async (e) => {
    e.preventDefault()
    if (pagoSubmitInFlightRef.current) {
      return
    }

    if (montoError) {
      focusField(montoInputRef, true)
      return
    }

    if (mercadoPagoNoDisponible) {
      focusField(metodoPagoInputRef)
      return
    }

    if (efectivoInsuficiente) {
      focusField(montoAbonadoInputRef, true)
      return
    }

    pagoSubmitInFlightRef.current = true
    setRegistrandoPago(true)

    try {
      const response = await api.post('/pagos', {
        pedidoId: pedidoSeleccionado.id,
        monto: parseFloat(pagoForm.monto),
        metodo: pagoForm.metodo,
        referencia: pagoForm.referencia || null,
        canalCobro: CANAL_COBRO_POS,
        propinaMonto: pagoForm.propinaMonto ? parseFloat(pagoForm.propinaMonto) : 0,
        propinaMetodo: pagoForm.propinaMonto ? pagoForm.propinaMetodo : null,
        montoAbonado: pagoForm.metodo === 'EFECTIVO' && pagoForm.montoAbonado
          ? parseFloat(pagoForm.montoAbonado)
          : null
      })

      if (response.data?.pedido) {
        setPedidoSeleccionado(response.data.pedido)
      }

      toast.success('Pago registrado')
      cerrarModalPago()
      cargarPedidosAsync()
        .catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    } finally {
      pagoSubmitInFlightRef.current = false
      setRegistrandoPago(false)
    }
  }

  const cerrarPedido = async (pedido) => {
    try {
      await api.post(`/pedidos/${pedido.id}/cerrar`, {})
      toast.success(`Pedido #${pedido.id} cerrado`)
      cargarPedidosAsync().catch(() => {})
      if (pedidoSeleccionado?.id === pedido.id) {
        verDetalle(pedido.id)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const liberarMesa = async (mesaId) => {
    try {
      await api.post(`/mesas/${mesaId}/liberar`, {})
      toast.success('Mesa liberada')
      setShowModal(false)
      cargarPedidosAsync().catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const imprimirComanda = async (id, tipo) => {
    try {
      await api.post(`/impresion/comanda/${id}/reimprimir`, tipo ? { tipo } : {})
      const labels = { COCINA: 'Comanda cocina', CAJA: 'Ticket caja', CLIENTE: 'Ticket cliente' }
      toast.success(`${labels[tipo] || 'Reimpresion'} encolada`)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const confirmarAsignarDelivery = async () => {
    if (!repartidorSeleccionado || !pedidoDeliveryListoId) return
    setAsignandoDelivery(true)
    try {
      await api.patch(`/pedidos/${pedidoDeliveryListoId}/asignar-delivery`, {
        repartidorId: Number(repartidorSeleccionado)
      })
      toast.success('Repartidor asignado')
      setShowAsignarDeliveryModal(false)
      setPedidoDeliveryListoId(null)
      deliveryModalPedidoRef.current = null
      setRepartidorSeleccionado('')
      cargarPedidosAsync().catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setAsignandoDelivery(false)
    }
  }

  const handleLoadMore = useCallback(async () => {
    if (loadingMoreRef.current || pedidos.length >= totalPedidos) {
      return
    }

    const nextLimit = loadedLimitRef.current + PEDIDOS_PAGE_SIZE
    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const result = await refetchPedidosWindow(nextLimit)
      if (result) {
        loadedLimitRef.current = nextLimit
      }
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [pedidos.length, refetchPedidosWindow, totalPedidos])

  const handleBusquedaChange = useCallback((event) => {
    loadedLimitRef.current = PEDIDOS_PAGE_SIZE
    setFiltroBusqueda(event.target.value)
  }, [])

  const handleEstadoFilterChange = useCallback((event) => {
    loadedLimitRef.current = PEDIDOS_PAGE_SIZE
    setFiltroEstado(event.target.value)
  }, [])

  const handleTipoFilterChange = useCallback((event) => {
    loadedLimitRef.current = PEDIDOS_PAGE_SIZE
    setFiltroTipo(event.target.value)
  }, [])

  const handleFechaFilterChange = useCallback((event) => {
    loadedLimitRef.current = PEDIDOS_PAGE_SIZE
    setFiltroFecha(event.target.value)
  }, [])

  const toggleFiltrosAvanzados = useCallback(() => {
    setMostrarFiltrosAvanzados((current) => !current)
  }, [])

  const limpiarFiltros = useCallback(() => {
    loadedLimitRef.current = PEDIDOS_PAGE_SIZE
    setFiltroBusqueda('')
    setBusquedaDebounced('')
    setFiltroEstado('')
    setFiltroTipo('')
    setFiltroFecha('')
    setMostrarFiltrosAvanzados(false)
  }, [])

  const metricas = useMemo(() => {
    const pedidosList = Array.isArray(pedidos) ? pedidos : []
    const pedidosPendientes = pedidosList.filter((pedido) => !['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedido.estado)).length
    const pedidosPorCerrar = pedidosList.filter((pedido) => pedido.estado === 'COBRADO').length
    return [
      {
        label: 'Pedidos activos',
        value: pedidosPendientes,
        icon: EyeIcon,
        accent: 'bg-primary-50 text-primary-700',
        hint: 'Operacion en curso'
      },
      {
        label: 'Listos para cierre',
        value: pedidosPorCerrar,
        icon: CurrencyDollarIcon,
        accent: 'bg-success-50 text-success-700',
        hint: 'Cobros ya tomados'
      }
    ]
  }, [pedidos])
  const pedidosPorCerrar = metricas[1].value
  const placeholderBusqueda = mesaIdFiltrada
    ? 'Buscar por pedido o cliente'
    : 'Buscar por pedido, mesa o cliente'
  const hayFiltrosAvanzadosActivos = Boolean(filtroTipo || filtroFecha)
  const hayFiltrosActivos = Boolean(filtroBusqueda.trim() || filtroEstado || filtroTipo || filtroFecha)
  const mesaContextoTitulo = useMemo(() => {
    if (!mesaIdFiltrada) {
      return null
    }

    if (mesaContexto?.numero) {
      return `Mesa ${mesaContexto.numero}`
    }

    return 'Mesa seleccionada'
  }, [mesaContexto?.numero, mesaIdFiltrada])
  const descripcionPedidos = mesaIdFiltrada
    ? mesaContexto?.numero
      ? `Viendo pedidos de ${mesaContextoTitulo}.`
      : 'Mesa seleccionada.'
    : 'Gestion de estados, cobros manuales e impresion de caja.'
  const emptyStateTitle = hayFiltrosActivos
    ? mesaIdFiltrada
      ? mesaContexto?.numero
        ? `No hay coincidencias para ${mesaContextoTitulo}`
        : 'No hay coincidencias para esta mesa'
      : 'No se encontraron pedidos'
    : mesaIdFiltrada
      ? mesaContexto?.numero
        ? `No hay pedidos para ${mesaContextoTitulo}`
        : 'No hay pedidos para esta mesa'
      : 'No hay pedidos para mostrar'
  const emptyStateDescription = hayFiltrosActivos
    ? mesaIdFiltrada
      ? 'Prueba ajustando o limpiando los filtros para ver mas pedidos de esta mesa.'
      : 'Prueba ajustando o limpiando los filtros para ver mas pedidos.'
    : mesaIdFiltrada
      ? mesaContexto?.numero
        ? `Cuando ${mesaContextoTitulo} tenga pedidos, los vas a ver en esta bandeja.`
        : 'Cuando esta mesa tenga pedidos, los vas a ver en esta bandeja.'
      : 'Cuando ingresen pedidos, vas a poder gestionarlos desde esta bandeja.'
  const mostrarCtaNuevoPedidoEnHeader = puedeAbrirNuevoPedido && (!esSoloMozo || !isMobileViewport)
  const mostrarCtaNuevoPedidoFlotante = puedeAbrirNuevoPedido && esSoloMozo && isMobileViewport
  const ctaNuevoPedidoLabel = modoAgregarConsumoMesa ? 'Agregar consumo' : 'Nuevo pedido'
  const ctaNuevoPedidoMobileLabel = modoAgregarConsumoMesa
    ? `Agregar consumo a ${mesaContextoTitulo}`
    : mesaIdFiltrada
      ? `Nuevo pedido para ${mesaContextoTitulo}`
      : 'Nuevo pedido'

  const abrirNuevoPedido = useCallback(() => {
    if (modoAgregarConsumoMesa) {
      setShowNuevoPedidoModal(true)
      return
    }

    if (esSoloMozo) {
      navigate(rutaNuevoPedidoMozo)
      return
    }

    setShowNuevoPedidoModal(true)
  }, [esSoloMozo, modoAgregarConsumoMesa, navigate, rutaNuevoPedidoMozo])

  return {
    // Auth / navigation derived
    navigate,
    esSoloMozo,
    puedeAbrirNuevoPedido,
    puedeAsignarDelivery,
    puedeRegistrarPago,
    puedeFacturar,
    puedeCerrarPedido,
    puedeLiberarMesa,
    isMobileViewport,
    rutaMesas,

    // Pedidos list state
    pedidos,
    totalPedidos,
    loading,
    loadingMore,

    // Filter state
    filtroBusqueda,
    filtroEstado,
    filtroTipo,
    filtroFecha,
    mostrarFiltrosAvanzados,
    hayFiltrosActivos,
    hayFiltrosAvanzadosActivos,
    placeholderBusqueda,

    // Filter handlers
    handleBusquedaChange,
    handleEstadoFilterChange,
    handleTipoFilterChange,
    handleFechaFilterChange,
    toggleFiltrosAvanzados,
    limpiarFiltros,

    // Mesa context
    mesaIdFiltrada,
    mesaContexto,
    mesaContextoError,
    mesaContextoTitulo,
    limpiarFiltroMesa,
    modoAgregarConsumoMesa,
    pedidoMesaAbierto,

    // Detail modal
    showModal,
    setShowModal,
    pedidoSeleccionado,
    setPedidoSeleccionado,
    verDetalle,

    // Actions
    cambiarEstado,
    cerrarPedido,
    liberarMesa,
    imprimirComanda,
    abrirFacturacion,
    abrirPago,
    abrirCambiarMesa,
    abrirNuevoPedido,

    // Pago modal
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
    montoAbonado,
    totalARegistrar,
    diferenciaEfectivo,
    montoFueEditado,
    montoExcedePendiente,
    montoInvalido,
    efectivoInsuficiente,
    montoError,
    montoAbonadoHelper,
    montoPendienteSugerido,
    saldoPendienteActual,
    totalPedidoSeleccionado,
    totalPagadoSeleccionado,
    resumenCobro,
    referenciaLabel,
    referenciaPlaceholder,
    pagoFormId,
    submitDisabled,

    // Descuento modal
    showDescuentoModal,
    setShowDescuentoModal,
    descuentoForm,
    setDescuentoForm,
    aplicandoDescuento,
    handleAplicarDescuento,

    // Cambiar mesa modal
    showCambiarMesaModal,
    setShowCambiarMesaModal,
    mesasLibres,
    nuevaMesaId,
    setNuevaMesaId,
    cambiandoMesa,
    handleCambiarMesa,

    // Delivery modal
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

    // Nuevo pedido modal
    showNuevoPedidoModal,
    setShowNuevoPedidoModal,

    // Facturacion modal
    showFacturacionModal,
    setShowFacturacionModal,
    pedidoParaFacturar,
    setPedidoParaFacturar,

    // Load more
    handleLoadMore,

    // Rendering helpers
    metricas,
    pedidosPorCerrar,
    descripcionPedidos,
    emptyStateTitle,
    emptyStateDescription,
    mostrarCtaNuevoPedidoEnHeader,
    mostrarCtaNuevoPedidoFlotante,
    ctaNuevoPedidoLabel,
    ctaNuevoPedidoMobileLabel,
    // Refetch
    refetchPedidosWindow,
    obtenerPedidoPorId,
    cargarPedidosAsync
  }
}
