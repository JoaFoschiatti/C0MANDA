import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'

const initialForm = {
  usuarioId: '',
  periodoDesde: '',
  periodoHasta: '',
  horasTotales: '',
  descuentos: 0,
  adicionales: 0,
  observaciones: '',
}

export default function useLiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(initialForm)

  const usuarioSeleccionado = useMemo(
    () => usuarios.find((u) => u.id === Number.parseInt(form.usuarioId, 10)),
    [usuarios, form.usuarioId]
  )

  const tarifaHora = usuarioSeleccionado ? parseFloat(usuarioSeleccionado.tarifaHora) : 0
  const horas = parseFloat(form.horasTotales) || 0
  const subtotal = horas * tarifaHora
  const totalPagar =
    subtotal - (parseFloat(form.descuentos) || 0) + (parseFloat(form.adicionales) || 0)

  const cargarDatos = useCallback(async () => {
    const [liqRes, usrRes] = await Promise.all([
      api.get('/liquidaciones'),
      api.get('/usuarios?activo=true'),
    ])

    const nextLiquidaciones = Array.isArray(liqRes.data) ? liqRes.data : []
    const nextUsuarios = Array.isArray(usrRes.data) ? usrRes.data : []
    setLiquidaciones(nextLiquidaciones)
    setUsuarios(nextUsuarios)
    return { liquidaciones: nextLiquidaciones, usuarios: nextUsuarios }
  }, [])

  const { loading, execute: cargarDatosAsync } = useAsync(
    useCallback(async () => cargarDatos(), [cargarDatos]),
    {
      onError: (error) => {
        console.error('Error:', error)
      },
    }
  )

  const resetForm = useCallback(() => {
    setForm(initialForm)
  }, [])

  const cerrarModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const abrirNuevaLiquidacion = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (!form.horasTotales || parseFloat(form.horasTotales) <= 0) {
        toast.error('Ingresa las horas trabajadas')
        return
      }

      try {
        await api.post('/liquidaciones', {
          usuarioId: Number.parseInt(form.usuarioId, 10),
          periodoDesde: form.periodoDesde,
          periodoHasta: form.periodoHasta,
          horasTotales: parseFloat(form.horasTotales),
          descuentos: parseFloat(form.descuentos) || 0,
          adicionales: parseFloat(form.adicionales) || 0,
          observaciones: form.observaciones,
        })
        toast.success('Liquidación creada')
        cerrarModal()
        cargarDatosAsync()
      } catch (error) {
        console.error('Error:', error)
      }
    },
    [cargarDatosAsync, cerrarModal, form]
  )

  const marcarPagada = useCallback(
    async (id) => {
      if (!globalThis.confirm?.('¿Marcar como pagada?')) {
        return
      }

      try {
        await api.patch(`/liquidaciones/${id}/pagar`)
        toast.success('Marcada como pagada')
        cargarDatosAsync()
      } catch (error) {
        console.error('Error:', error)
      }
    },
    [cargarDatosAsync]
  )

  return {
    abrirNuevaLiquidacion,
    cerrarModal,
    usuarioSeleccionado,
    usuarios,
    form,
    handleSubmit,
    horas,
    liquidaciones,
    loading,
    marcarPagada,
    setForm,
    showModal,
    subtotal,
    tarifaHora,
    totalPagar,
  }
}
