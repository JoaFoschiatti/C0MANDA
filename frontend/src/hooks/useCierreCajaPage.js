import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'

export default function useCierreCajaPage() {
  const [cajaActual, setCajaActual] = useState(null)
  const [historico, setHistorico] = useState([])
  const [showAbrirModal, setShowAbrirModal] = useState(false)
  const [showCerrarModal, setShowCerrarModal] = useState(false)
  const [fondoInicial, setFondoInicial] = useState('')
  const [efectivoFisico, setEfectivoFisico] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [resumen, setResumen] = useState(null)

  const cargarEstado = useCallback(async () => {
    const response = await api.get('/cierres/actual')
    setCajaActual(response.data)
    return response.data
  }, [])

  const cargarHistorico = useCallback(async () => {
    const response = await api.get('/cierres?limit=10')
    setHistorico(response.data)
    return response.data
  }, [])

  const cargarDatos = useCallback(async () => {
    const [estado, historial] = await Promise.all([cargarEstado(), cargarHistorico()])
    return { estado, historial }
  }, [cargarEstado, cargarHistorico])

  const { loading, execute: cargarDatosAsync } = useAsync(
    useCallback(async () => cargarDatos(), [cargarDatos]),
    {
      immediate: false,
      onError: (error) => {
        console.error('Error:', error)
      },
    }
  )

  useEffect(() => {
    cargarDatosAsync().catch(() => {})
  }, [cargarDatosAsync])

  const cerrarAbrirModal = useCallback(() => {
    setShowAbrirModal(false)
    setFondoInicial('')
  }, [])

  const cerrarCerrarModal = useCallback(() => {
    setShowCerrarModal(false)
    setEfectivoFisico('')
    setObservaciones('')
    setResumen(null)
  }, [])

  const abrirCaja = useCallback(
    async (event) => {
      event.preventDefault()
      try {
        await api.post(
          '/cierres',
          { fondoInicial: parseFloat(fondoInicial) || 0 },
          { skipToast: true }
        )
        toast.success('Caja abierta correctamente')
        cerrarAbrirModal()
        cargarDatosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al abrir caja')
      }
    },
    [cargarDatosAsync, cerrarAbrirModal, fondoInicial]
  )

  const prepararCierre = useCallback(async () => {
    try {
      const response = await api.get('/cierres/resumen', { skipToast: true })
      setResumen(response.data)
      setShowCerrarModal(true)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al obtener resumen')
    }
  }, [])

  const cerrarCaja = useCallback(
    async (event) => {
      event.preventDefault()
      if (!cajaActual?.caja?.id) {
        return
      }

      try {
        await api.patch(
          `/cierres/${cajaActual.caja.id}/cerrar`,
          {
            efectivoFisico: parseFloat(efectivoFisico) || 0,
            observaciones,
          },
          { skipToast: true }
        )
        toast.success('Caja cerrada correctamente')
        cerrarCerrarModal()
        cargarDatosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al cerrar caja')
      }
    },
    [cajaActual?.caja?.id, cargarDatosAsync, cerrarCerrarModal, efectivoFisico, observaciones]
  )

  const formatCurrency = useCallback(
    (value) =>
      `$${parseFloat(value || 0).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
      })}`,
    []
  )

  const formatDateTime = useCallback(
    (date) =>
      new Date(date).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  )

  return {
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
  }
}
