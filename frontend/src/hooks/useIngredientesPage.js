import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'
import { SUCURSAL_IDS, SUCURSALES, getSucursalById } from '../constants/sucursales'
import { parseEnumParam, parsePositiveIntParam } from '../utils/query-params'

const initialIngredienteForm = {
  nombre: '',
  unidad: '',
  stockActual: '',
  stockMinimo: '',
  costo: '',
}

const initialMovimientoForm = {
  tipo: 'ENTRADA',
  cantidad: '',
  motivo: '',
  codigoLote: '',
  fechaVencimiento: '',
  costoUnitario: '',
}

const initialDescarteForm = {
  loteId: '',
  cantidad: '',
  motivo: '',
}

export default function useIngredientesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ingredientes, setIngredientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showMovModal, setShowMovModal] = useState(false)
  const [showDescarteModal, setShowDescarteModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [ingredienteSeleccionado, setIngredienteSeleccionado] = useState(null)
  const [form, setForm] = useState(initialIngredienteForm)
  const [movForm, setMovForm] = useState(initialMovimientoForm)
  const [descarteForm, setDescarteForm] = useState(initialDescarteForm)

  const deepLinkActionRef = useRef(null)
  const ingredienteEnfocadoId = parsePositiveIntParam(searchParams.get('ingredienteId'))
  const loteEnfocadoId = parsePositiveIntParam(searchParams.get('loteId'))
  const accionEnfocada = parseEnumParam(searchParams.get('action'), ['descartar'])
  const sucursalActiva = getSucursalById(searchParams.get('sucursalId') || SUCURSAL_IDS.SALON)

  const cambiarSucursalActiva = useCallback((sucursalId) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('sucursalId', String(sucursalId))
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const cargarIngredientes = useCallback(async () => {
    const query = new URLSearchParams({ sucursalId: String(sucursalActiva.id) }).toString()
    const [ingredientesResponse, alertasResponse] = await Promise.all([
      Promise.resolve(api.get(`/ingredientes?${query}`)),
      Promise.resolve(api.get(`/ingredientes/alertas?${query}`)).catch(() => ({ data: [] })),
    ])

    const ingredientesData = Array.isArray(ingredientesResponse?.data)
      ? ingredientesResponse.data
      : []
    const alertasData = Array.isArray(alertasResponse?.data) ? alertasResponse.data : []
    const alertasPorId = new Map(alertasData.map((ingrediente) => [ingrediente.id, ingrediente]))

    const mergedIngredientes = ingredientesData.map((ingrediente) => {
      const alerta = alertasPorId.get(ingrediente.id)

      if (!alerta) {
        return {
          ...ingrediente,
          lotesAlerta: ingrediente.lotesAlerta || [],
          stockNoConsumible: ingrediente.stockNoConsumible || 0,
          tieneLotesVencidos: false,
          tieneLotesPorVencer: false,
        }
      }

      return {
        ...ingrediente,
        ...alerta,
      }
    })

    setIngredientes(mergedIngredientes)
    return mergedIngredientes
  }, [sucursalActiva.id])

  const { loading, execute: cargarIngredientesAsync } = useAsync(
    useCallback(async () => cargarIngredientes(), [cargarIngredientes]),
    {
      onError: (error) => {
        console.error('Error:', error)
      },
    }
  )

  const resetForm = useCallback(() => {
    setForm(initialIngredienteForm)
    setEditando(null)
  }, [])

  const resetMovimientoForm = useCallback(() => {
    setMovForm(initialMovimientoForm)
  }, [])

  const resetDescarteForm = useCallback(() => {
    setDescarteForm(initialDescarteForm)
  }, [])

  const abrirNuevoIngrediente = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const cerrarIngredienteModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const cerrarMovimientoModal = useCallback(() => {
    setShowMovModal(false)
    resetMovimientoForm()
  }, [resetMovimientoForm])

  const cerrarDescarteModal = useCallback(() => {
    setShowDescarteModal(false)
    resetDescarteForm()
  }, [resetDescarteForm])

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      const data = {
        ...form,
        stockActual: parseFloat(form.stockActual),
        stockMinimo: parseFloat(form.stockMinimo),
        costo: form.costo ? parseFloat(form.costo) : null,
        sucursalId: sucursalActiva.id,
      }
      if (editando) {
        await api.put(`/ingredientes/${editando.id}`, data)
        toast.success('Ingrediente actualizado')
      } else {
        await api.post('/ingredientes', data)
        toast.success('Ingrediente creado')
      }
      cerrarIngredienteModal()
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleMovimiento = async (event) => {
    event.preventDefault()
    try {
      await api.post(`/ingredientes/${ingredienteSeleccionado.id}/movimiento`, {
        tipo: movForm.tipo,
        cantidad: parseFloat(movForm.cantidad),
        motivo: movForm.motivo,
        codigoLote: movForm.tipo === 'ENTRADA' ? movForm.codigoLote || null : null,
        fechaVencimiento:
          movForm.tipo === 'ENTRADA' && movForm.fechaVencimiento
            ? movForm.fechaVencimiento
            : null,
        costoUnitario:
          movForm.tipo === 'ENTRADA' && movForm.costoUnitario
            ? parseFloat(movForm.costoUnitario)
            : null,
        sucursalId: sucursalActiva.id,
      })
      toast.success('Movimiento registrado')
      cerrarMovimientoModal()
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleEdit = useCallback((ingrediente) => {
    setEditando(ingrediente)
    setForm({
      nombre: ingrediente.nombre,
      unidad: ingrediente.unidad,
      stockActual: ingrediente.stockActual,
      stockMinimo: ingrediente.stockMinimo,
      costo: ingrediente.costo || '',
    })
    setShowModal(true)
  }, [])

  const abrirMovimiento = useCallback(
    (ingrediente) => {
      setIngredienteSeleccionado(ingrediente)
      resetMovimientoForm()
      setShowMovModal(true)
    },
    [resetMovimientoForm]
  )

  const getLotesVencidos = useCallback(
    (ingrediente) => (ingrediente?.lotes || []).filter((lote) => lote.estadoLote === 'VENCIDO'),
    []
  )

  useEffect(() => {
    if (!ingredienteEnfocadoId || ingredientes.length === 0) {
      return
    }

    const target = document.getElementById(`ingrediente-row-${ingredienteEnfocadoId}`)
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [ingredienteEnfocadoId, ingredientes])

  useEffect(() => {
    if (accionEnfocada !== 'descartar' || !ingredienteEnfocadoId || ingredientes.length === 0) {
      return
    }

    const actionKey = `${ingredienteEnfocadoId}:${loteEnfocadoId || ''}:${accionEnfocada}`
    if (deepLinkActionRef.current === actionKey) {
      return
    }

    const ingrediente = ingredientes.find((item) => item.id === ingredienteEnfocadoId)
    if (!ingrediente) {
      return
    }

    const lotesVencidos = getLotesVencidos(ingrediente)
    if (lotesVencidos.length === 0) {
      return
    }

    const loteObjetivo = lotesVencidos.find((lote) => lote.id === loteEnfocadoId) || lotesVencidos[0]
    deepLinkActionRef.current = actionKey

    setIngredienteSeleccionado(ingrediente)
    setDescarteForm({
      loteId: String(loteObjetivo.id),
      cantidad: String(parseFloat(loteObjetivo.stockActual).toFixed(2)),
      motivo: '',
    })
    setShowDescarteModal(true)
  }, [accionEnfocada, getLotesVencidos, ingredienteEnfocadoId, ingredientes, loteEnfocadoId])

  const abrirDescarte = useCallback(
    (ingrediente) => {
      const lotesVencidos = getLotesVencidos(ingrediente)
      if (lotesVencidos.length === 0) {
        return
      }

      setIngredienteSeleccionado(ingrediente)
      setDescarteForm({
        loteId: String(lotesVencidos[0].id),
        cantidad: String(parseFloat(lotesVencidos[0].stockActual).toFixed(2)),
        motivo: '',
      })
      setShowDescarteModal(true)
    },
    [getLotesVencidos]
  )

  const handleDescarte = async (event) => {
    event.preventDefault()

    try {
      await api.post(`/ingredientes/lotes/${descarteForm.loteId}/descartar`, {
        cantidad: descarteForm.cantidad ? parseFloat(descarteForm.cantidad) : null,
        motivo: descarteForm.motivo,
      })
      toast.success('Lote descartado')
      cerrarDescarteModal()
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const stockBajo = useCallback(
    (ingrediente) => parseFloat(ingrediente.stockActual) <= parseFloat(ingrediente.stockMinimo),
    []
  )

  const formatFecha = useCallback(
    (value) =>
      value
        ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
        : '',
    []
  )

  const getEstadoIngrediente = useCallback(
    (ingrediente) => {
      if (stockBajo(ingrediente)) {
        return { label: 'Stock Bajo', variant: 'error' }
      }
      if (ingrediente.tieneLotesVencidos) {
        return { label: 'Lotes vencidos', variant: 'warning' }
      }
      if (ingrediente.tieneLotesPorVencer) {
        return { label: 'Por vencer', variant: 'warning' }
      }
      return { label: 'OK', variant: 'success' }
    },
    [stockBajo]
  )

  const lotesVencidosSeleccionados = getLotesVencidos(ingredienteSeleccionado)
  const loteDescarteSeleccionado = lotesVencidosSeleccionados.find(
    (lote) => String(lote.id) === descarteForm.loteId
  )

  return {
    abrirDescarte,
    abrirMovimiento,
    abrirNuevoIngrediente,
    accionEnfocada,
    cambiarSucursalActiva,
    cargarIngredientesAsync,
    cerrarDescarteModal,
    cerrarIngredienteModal,
    cerrarMovimientoModal,
    descarteForm,
    editando,
    form,
    formatFecha,
    getEstadoIngrediente,
    handleDescarte,
    handleEdit,
    handleMovimiento,
    handleSubmit,
    ingredienteEnfocadoId,
    ingredienteSeleccionado,
    ingredientes,
    loading,
    loteDescarteSeleccionado,
    lotesVencidosSeleccionados,
    movForm,
    setDescarteForm,
    setForm,
    setMovForm,
    showDescarteModal,
    showModal,
    showMovModal,
    stockBajo,
    sucursalActiva,
    sucursales: SUCURSALES,
  }
}
