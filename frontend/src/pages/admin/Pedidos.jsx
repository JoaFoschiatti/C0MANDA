import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import {
  AdjustmentsHorizontalIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PrinterIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PlusIcon,
  LinkIcon,
  TableCellsIcon,
  TruckIcon
} from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Input, Modal, PageHeader, Spinner, Table } from '../../components/ui'
import useEventSource from '../../hooks/useEventSource'
import NuevoPedidoModal from '../../components/pedidos/NuevoPedidoModal'
import EmitirComprobanteModal from '../../components/facturacion/EmitirComprobanteModal'
import useAsync from '../../hooks/useAsync'
import useMobileViewport from '../../hooks/useMobileViewport'
import { formatArsPos, formatPosInputValue } from '../../utils/currency'
import { parseBooleanFlag, parsePositiveIntParam } from '../../utils/query-params'

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

export default function Pedidos() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobileViewport = useMobileViewport()
  const esSoloMozo = usuario?.rol === 'MOZO'
  const puedeAbrirNuevoPedido = ['ADMIN', 'CAJERO', 'MOZO'].includes(usuario?.rol)
  const puedeAsignarDelivery = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const puedeRegistrarPago = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const puedeFacturar = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const puedeCerrarPedido = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
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
  const [mesaContexto, setMesaContexto] = useState(null)
  const [mesaContextoError, setMesaContextoError] = useState(false)

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
    console.error('[SSE] Error en conexión:', err)
  }, [])

  const handleSseOpen = useCallback(() => {
    console.log('[SSE] Conexión establecida')
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

  const imprimirComanda = async (id) => {
    try {
      await api.post(`/impresion/comanda/${id}/reimprimir`, {})
      toast.success('Reimpresion encolada')
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

  const abrirNuevoPedido = useCallback(() => {
    if (esSoloMozo) {
      navigate(rutaNuevoPedidoMozo)
      return
    }

    setShowNuevoPedidoModal(true)
  }, [esSoloMozo, navigate, rutaNuevoPedidoMozo])

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
      <button
        onClick={() => imprimirComanda(pedido.id)}
        type="button"
        aria-label={`Reimprimir comanda del pedido #${pedido.id}`}
        title="Reimprimir comanda"
        className="text-text-secondary transition-colors hover:text-text-primary"
      >
        <PrinterIcon className="w-5 h-5" />
      </button>
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
                Nuevo pedido
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
          aria-label={mesaIdFiltrada ? `Nuevo pedido para ${mesaContextoTitulo}` : 'Nuevo pedido'}
          data-testid="pedidos-mobile-new-order"
        >
          <PlusIcon className="h-5 w-5" />
          <span>{mesaIdFiltrada ? `Nuevo pedido para ${mesaContextoTitulo}` : 'Nuevo pedido'}</span>
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
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-heading-3">Pedido #{pedidoSeleccionado.id}</h2>
              <span className={`badge ${estadoBadges[pedidoSeleccionado.estado]}`}>
                {pedidoSeleccionado.estado.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="text-sm text-text-secondary">
                <p><strong className="text-text-primary">Tipo:</strong> {pedidoSeleccionado.tipo}</p>
                <p><strong className="text-text-primary">Sucursal:</strong> {pedidoSeleccionado.sucursal?.nombre || '-'}</p>
                {pedidoSeleccionado.mesa && <p><strong className="text-text-primary">Mesa:</strong> {pedidoSeleccionado.mesa.numero}</p>}
                {pedidoSeleccionado.clienteNombre && <p><strong className="text-text-primary">Cliente:</strong> {pedidoSeleccionado.clienteNombre}</p>}
                <p><strong className="text-text-primary">Mozo:</strong> {pedidoSeleccionado.usuario?.nombre}</p>
              </div>

              <div>
                <h3 className="font-semibold text-text-primary mb-2">Items:</h3>
                <div className="space-y-2">
                  {pedidoSeleccionado.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-text-primary">
                        {item.cantidad}x {item.producto?.nombre}
                        {item.observaciones && <span className="text-text-tertiary ml-1">({item.observaciones})</span>}
                      </span>
                      <span className="text-text-primary">${parseFloat(item.subtotal).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border-default pt-3">
                <div className="flex justify-between font-bold text-lg text-text-primary">
                  <span>Total:</span>
                  <span>${parseFloat(pedidoSeleccionado.total).toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Cambiar estado */}
              {!['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
                <div className="border-t border-border-default pt-3">
                  <p className="text-sm font-medium text-text-primary mb-2">Cambiar estado:</p>
                  <div className="flex flex-wrap gap-2">
                    {!esSoloMozo && pedidoSeleccionado.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'EN_PREPARACION')}
                        className="btn btn-primary text-sm"
                      >
                        Iniciar preparacion
                      </button>
                    )}
                    {!esSoloMozo && pedidoSeleccionado.estado === 'EN_PREPARACION' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'LISTO')}
                        className="btn btn-success text-sm"
                      >
                        Marcar listo
                      </button>
                    )}
                    {pedidoSeleccionado.estado === 'LISTO' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'ENTREGADO')}
                        className="btn btn-primary text-sm"
                      >
                        Marcar entregado
                      </button>
                    )}
                  </div>
                </div>
              )}

              {pedidoSeleccionado.estado === 'COBRADO' && (
                <div className="border-t border-border-default pt-3 flex flex-wrap gap-2">
                  {puedeCerrarPedido && (
                    <button
                      onClick={() => cerrarPedido(pedidoSeleccionado)}
                      className="btn btn-primary text-sm"
                    >
                      Cerrar pedido
                    </button>
                  )}
                  {!pedidoSeleccionado.comprobanteFiscal && puedeFacturar && (
                    <button
                      onClick={() => abrirFacturacion(pedidoSeleccionado)}
                      className="btn btn-secondary text-sm"
                    >
                      Facturar
                    </button>
                  )}
                </div>
              )}

              {pedidoSeleccionado.estado === 'CERRADO' && !pedidoSeleccionado.comprobanteFiscal && puedeFacturar && (
                <div className="border-t border-border-default pt-3">
                  <button
                    onClick={() => abrirFacturacion(pedidoSeleccionado)}
                    className="btn btn-secondary text-sm"
                  >
                    Facturar
                  </button>
                </div>
              )}

              {pedidoSeleccionado.estado === 'CERRADO' && pedidoSeleccionado.mesaId && puedeLiberarMesa && (
                <div className="border-t border-border-default pt-3">
                  <button
                    onClick={() => liberarMesa(pedidoSeleccionado.mesaId)}
                    className="btn btn-success text-sm"
                  >
                    Liberar mesa
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setShowModal(false)} className="btn btn-secondary w-full mt-6">
              Cerrar
            </button>
          </div>
        </div>
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
        onSuccess={() => {
          setShowNuevoPedidoModal(false)
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
