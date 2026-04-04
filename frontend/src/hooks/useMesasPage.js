import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'

import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import useAsync from './useAsync'
import usePolling from './usePolling'
import useEventSource from './useEventSource'
import useKeyboardShortcuts from './useKeyboardShortcuts'
import { parsePositiveIntParam } from '../utils/query-params'

const GRUPO_COLORES = [
  'ring-blue-400',
  'ring-purple-400',
  'ring-pink-400',
  'ring-cyan-400',
  'ring-orange-400',
  'ring-teal-400',
]

const FORM_INICIAL = {
  numero: '',
  zona: 'Interior',
  capacidad: 4,
}

export function getMesaSecondaryText(mesa, reservaProxima, formatHora) {
  if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado) && mesa.pedidos?.[0]) {
    return `Pedido #${mesa.pedidos[0].id}`
  }

  if (reservaProxima && ['LIBRE', 'RESERVADA'].includes(mesa.estado)) {
    return `Reserva ${formatHora(reservaProxima.fechaHora)}`
  }

  return null
}

export default function useMesasPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esAdmin = usuario?.rol === 'ADMIN'
  const zonaRef = useRef(null)

  const [mesas, setMesas] = useState([])
  const [reservasProximas, setReservasProximas] = useState([])
  const [tab, setTab] = useState('operacion')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [mesaPendienteDesactivacion, setMesaPendienteDesactivacion] = useState(null)

  const [paredes, setParedes] = useState({ Interior: [], Exterior: [] })
  const [paredesChanged, setParedesChanged] = useState(false)
  const [zonaActiva, setZonaActiva] = useState('Interior')
  const [modoDibujo, setModoDibujo] = useState('mesas')
  const [activeMesa, setActiveMesa] = useState(null)
  const [posicionesModificadas, setPosicionesModificadas] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  const [seleccionGrupo, setSeleccionGrupo] = useState([])
  const mesaEnfocadaId = parsePositiveIntParam(searchParams.get('mesaId'))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const grupoColores = useMemo(() => {
    const colores = {}
    const gruposUnicos = [...new Set(mesas.filter((mesa) => mesa.grupoMesaId).map((mesa) => mesa.grupoMesaId))]
    gruposUnicos.forEach((grupoId, index) => {
      colores[grupoId] = GRUPO_COLORES[index % GRUPO_COLORES.length]
    })
    return colores
  }, [mesas])

  const resetForm = useCallback(() => {
    setForm(FORM_INICIAL)
    setEditando(null)
  }, [])

  const abrirModalNuevaMesa = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const cerrarModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const cargarMesas = useCallback(async () => {
    const response = await api.get('/mesas', { skipToast: true })
    setMesas(response.data)
    return response.data
  }, [])

  const cargarReservas = useCallback(async () => {
    try {
      const response = await api.get('/reservas/proximas', { skipToast: true })
      setReservasProximas(response.data)
    } catch {
      // Reservas es informativo; no bloquea la pantalla.
    }
  }, [])

  const cargarParedes = useCallback(async () => {
    try {
      const [interior, exterior] = await Promise.all([
        api.get('/plano/paredes?zona=Interior', { skipToast: true }),
        api.get('/plano/paredes?zona=Exterior', { skipToast: true })
      ])
      setParedes({ Interior: interior.data, Exterior: exterior.data })
    } catch {
      // La configuracion de paredes puede no existir todavia.
    }
  }, [])

  const refrescar = useCallback(async () => {
    await Promise.all([cargarMesas(), cargarReservas()])
  }, [cargarMesas, cargarReservas])

  const refrescarRequest = useCallback(async () => refrescar(), [refrescar])

  const { loading, execute: refrescarAsync } = useAsync(refrescarRequest, {
    onError: (error) => {
      console.error('Error cargando mesas:', error)
      toast.error('Error al cargar mesas')
    },
  })

  usePolling(refrescarAsync, 30000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': refrescarAsync,
      'mesa.updated': refrescarAsync,
      'reserva.updated': refrescarAsync,
    },
  })

  useEffect(() => {
    if (tab !== 'plano') {
      return
    }

    cargarParedes()
  }, [tab, cargarParedes])

  useEffect(() => {
    if (!mesaEnfocadaId || mesas.length === 0) {
      return
    }

    const target = document.getElementById(`mesa-card-${mesaEnfocadaId}`)
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [mesaEnfocadaId, mesas])

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      if (editando) {
        await api.put(`/mesas/${editando.id}`, form, { skipToast: true })
        toast.success('Mesa actualizada')
      } else {
        await api.post('/mesas', form, { skipToast: true })
        toast.success('Mesa creada')
      }

      cerrarModal()
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar mesa')
    }
  }

  const handleEdit = (mesa) => {
    setEditando(mesa)
    setForm({
      numero: mesa.numero,
      zona: mesa.zona || 'Interior',
      capacidad: mesa.capacidad,
    })
    setShowModal(true)
  }

  const handleDelete = (mesa) => {
    setMesaPendienteDesactivacion(mesa)
  }

  const cerrarConfirmacionDesactivar = () => {
    setMesaPendienteDesactivacion(null)
  }

  const confirmarDesactivarMesa = async () => {
    if (!mesaPendienteDesactivacion) {
      return
    }

    try {
      await api.delete(`/mesas/${mesaPendienteDesactivacion.id}`, { skipToast: true })
      toast.success('Mesa desactivada')
      cerrarConfirmacionDesactivar()
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al desactivar mesa')
    }
  }

  const handleDragStart = (event) => {
    const mesa = event.active.data.current?.mesa
    if (mesa) {
      setActiveMesa(mesa)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveMesa(null)

    if (!esAdmin) return

    const mesa = active.data.current?.mesa
    if (!mesa) return

    const zonaElement = zonaRef.current
    if (!zonaElement) return

    const zonaRect = zonaElement.getBoundingClientRect()
    const pointerX = event.activatorEvent?.clientX + (event.delta?.x || 0)
    const pointerY = event.activatorEvent?.clientY + (event.delta?.y || 0)

    // Calcular tamanio real del contenedor segun capacidad + rotacion
    const esRectangular = mesa.capacidad >= 6
    const baseW = esRectangular ? 100 : 56
    const baseH = esRectangular ? 48 : 56
    const rotacion = mesa.rotacion || 0
    const esRotado = rotacion === 90 || rotacion === 270
    const chipW = esRotado ? baseH : baseW
    const chipH = esRotado ? baseW : baseH

    // Convertir puntero a posicion top-left del chip
    let newX = pointerX - zonaRect.left - chipW / 2
    let newY = pointerY - zonaRect.top - chipH / 2

    // Clamp dentro de la zona con padding
    const padding = 10
    const minY = 50
    const maxX = zonaRect.width - chipW - padding
    const maxY = zonaRect.height - chipH - padding
    newX = Math.max(padding, Math.min(newX, maxX))
    newY = Math.max(minY, Math.min(newY, maxY))

    const targetZona = over?.data.current?.zona

    setMesas(prev => prev.map(m => {
      if (m.id !== mesa.id) return m

      if (targetZona === zonaActiva) {
        return { ...m, zona: zonaActiva, posX: Math.round(newX), posY: Math.round(newY) }
      }

      if (m.zona === zonaActiva && m.posX != null) {
        return { ...m, posX: Math.round(newX), posY: Math.round(newY) }
      }

      return m
    }))

    setPosicionesModificadas(true)
  }

  // ============ PLANO: ACCIONES DE MESA ============

  const handleRotar = (mesaId) => {
    setMesas(prev => prev.map(m => {
      if (m.id !== mesaId) return m
      return { ...m, rotacion: ((m.rotacion || 0) + 90) % 360 }
    }))
    setPosicionesModificadas(true)
  }

  const handleQuitar = (mesaId) => {
    setMesas(prev => prev.map(m => {
      if (m.id !== mesaId) return m
      return { ...m, zona: null, posX: null, posY: null, rotacion: 0 }
    }))
    setPosicionesModificadas(true)
  }

  // ============ PLANO: PAREDES ============

  const handleAgregarPared = (pared) => {
    setParedes(prev => ({
      ...prev,
      [zonaActiva]: [...(prev[zonaActiva] || []), pared]
    }))
    setParedesChanged(true)
    setPosicionesModificadas(true)
  }

  const handleEliminarPared = (paredId) => {
    setParedes(prev => ({
      ...prev,
      [zonaActiva]: (prev[zonaActiva] || []).filter(p => p.id !== paredId)
    }))
    setParedesChanged(true)
    setPosicionesModificadas(true)
  }

  const handleGuardarPosiciones = async () => {
    setSaving(true)
    try {
      const posiciones = mesas
        .filter((mesa) => mesa.posX != null && mesa.posY != null)
        .map(({ id, posX, posY, rotacion, zona }) => ({
          id,
          posX,
          posY,
          rotacion: rotacion || 0,
          zona: zona || 'Interior',
        }))

      if (posiciones.length === 0) {
        toast.error('No hay mesas con posicion asignada')
        setSaving(false)
        return
      }

      const promises = [
        api.patch('/mesas/posiciones', { posiciones }, { skipToast: true })
      ]

      if (paredesChanged) {
        for (const zona of ['Interior', 'Exterior']) {
          promises.push(
            api.put('/plano/paredes', {
              zona,
              paredes: paredes[zona] || []
            }, { skipToast: true })
          )
        }
      }

      await Promise.all(promises)
      toast.success('Posiciones guardadas')
      setPosicionesModificadas(false)
      setParedesChanged(false)
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar posiciones')
    } finally {
      setSaving(false)
    }
  }

  const toggleSeleccionGrupo = (mesaId) => {
    setSeleccionGrupo((prev) =>
      prev.includes(mesaId) ? prev.filter((id) => id !== mesaId) : [...prev, mesaId]
    )
  }

  const handleAgrupar = async () => {
    if (seleccionGrupo.length < 2) {
      toast.error('Selecciona al menos 2 mesas')
      return
    }

    try {
      await api.post('/mesas/grupos', { mesaIds: seleccionGrupo }, { skipToast: true })
      toast.success('Mesas agrupadas')
      setSeleccionGrupo([])
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al agrupar')
    }
  }

  const handleDesagrupar = async (grupoId) => {
    try {
      await api.delete(`/mesas/grupos/${grupoId}`, { skipToast: true })
      toast.success('Grupo eliminado')
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al desagrupar')
    }
  }

  const handlePedirCuenta = async (mesa) => {
    try {
      await api.post(`/mesas/${mesa.id}/precuenta`, {}, { skipToast: true })
      toast.success(`Precuenta solicitada para mesa ${mesa.numero}`)
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al solicitar precuenta')
    }
  }

  const handleLiberarMesa = async (mesa) => {
    try {
      await api.post(`/mesas/${mesa.id}/liberar`, {}, { skipToast: true })
      toast.success(`Mesa ${mesa.numero} liberada`)
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al liberar mesa')
    }
  }

  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'LIBRE') {
      if (esAdmin) navigate(`/mozo/nuevo-pedido/${mesa.id}`)
      return
    }

    if (mesa.estado === 'RESERVADA') {
      const reserva = getReservaProxima(mesa.id)
      navigate(reserva ? `/reservas?reservaId=${reserva.id}` : '/reservas')
      return
    }

    if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado) && mesa.pedidos?.[0]) {
      navigate(`/pedidos?mesaId=${mesa.id}`)
    }
  }

  const getReservaProxima = (mesaId) =>
    reservasProximas.find((reserva) => reserva.mesaId === mesaId)

  const formatHora = (fecha) =>
    new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // ============ ATAJOS DE TECLADO ============

  const shortcutsList = useMemo(() => [
    { key: 'N', description: 'Nueva mesa' },
    { key: '1', description: 'Tab Operacion' },
    { key: '2', description: 'Tab Plano' },
    { key: 'Esc', description: 'Cerrar modal / Cancelar' },
    { key: '?', description: 'Ayuda de atajos' },
  ], [])

  useKeyboardShortcuts(useMemo(() => ({
    'n': () => { if (esAdmin) abrirModalNuevaMesa() },
    '1': () => setTab('operacion'),
    '2': () => setTab('plano'),
    'Escape': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false)
      else if (mesaPendienteDesactivacion) cerrarConfirmacionDesactivar()
      else if (showModal) cerrarModal()
    },
    '?': () => setShowShortcutsHelp(prev => !prev),
  }), [esAdmin, showShortcutsHelp, mesaPendienteDesactivacion, showModal, abrirModalNuevaMesa, cerrarModal]))

  // ============ VALORES COMPUTADOS ============

  const mesasActivas = useMemo(() => mesas.filter((mesa) => mesa.activa !== false), [mesas])
  const mesasSinPosicionar = useMemo(() => mesasActivas.filter(m => !m.zona || m.posX == null || m.posY == null), [mesasActivas])
  const mesasZonaActiva = useMemo(() => mesasActivas.filter(m => m.zona === zonaActiva && m.posX != null && m.posY != null), [mesasActivas, zonaActiva])
  const { mesasOcupadas, mesasEsperandoCuenta, mesasPorZona } = useMemo(() => ({
    mesasOcupadas: mesasActivas.filter((mesa) => mesa.estado === 'OCUPADA').length,
    mesasEsperandoCuenta: mesasActivas.filter((mesa) => mesa.estado === 'ESPERANDO_CUENTA').length,
    mesasPorZona: mesasActivas.reduce((acc, mesa) => {
      const zona = mesa.zona || 'Sin zona'
      if (!acc[zona]) {
        acc[zona] = []
      }
      acc[zona].push(mesa)
      return acc
    }, {})
  }), [mesasActivas])

  return {
    // Auth / navigation
    esAdmin,
    zonaRef,

    // Data
    mesas,
    loading,
    mesasActivas,
    mesasSinPosicionar,
    mesasZonaActiva,
    mesasOcupadas,
    mesasEsperandoCuenta,
    mesasPorZona,
    reservasProximas,
    grupoColores,
    mesaEnfocadaId,

    // Tabs
    tab,
    setTab,

    // Modal CRUD
    showModal,
    editando,
    form,
    setForm,
    abrirModalNuevaMesa,
    cerrarModal,
    handleSubmit,
    handleEdit,
    handleDelete,

    // Confirmacion desactivacion
    mesaPendienteDesactivacion,
    cerrarConfirmacionDesactivar,
    confirmarDesactivarMesa,

    // Plano
    paredes,
    zonaActiva,
    setZonaActiva,
    modoDibujo,
    setModoDibujo,
    activeMesa,
    posicionesModificadas,
    saving,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleRotar,
    handleQuitar,
    handleAgregarPared,
    handleEliminarPared,
    handleGuardarPosiciones,

    // Grupos
    seleccionGrupo,
    setSeleccionGrupo,
    toggleSeleccionGrupo,
    handleAgrupar,
    handleDesagrupar,

    // Operaciones de mesa
    handlePedirCuenta,
    handleLiberarMesa,
    handleMesaClick,

    // Helpers
    getReservaProxima,
    formatHora,

    // Shortcuts
    shortcutsList,
    showShortcutsHelp,
    setShowShortcutsHelp,
  }
}
