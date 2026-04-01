import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'

const COLORS_METODO = {
  EFECTIVO: '#22c55e',
  MERCADOPAGO: '#06b6d4',
}

const COLORS_TIPO = {
  MESA: '#3b82f6',
  DELIVERY: '#f97316',
  MOSTRADOR: '#6b7280',
}

export default function useReportesData() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ventas, setVentas] = useState(null)
  const [productosMasVendidos, setProductosMasVendidos] = useState([])
  const [ventasPorMozo, setVentasPorMozo] = useState([])
  const [consumoInsumos, setConsumoInsumos] = useState(null)
  const [agruparPorBase, setAgruparPorBase] = useState(false)
  const [tabActiva, setTabActiva] = useState('ventas')

  useEffect(() => {
    const hoy = new Date()
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(hace30Dias.toISOString().split('T')[0])
  }, [])

  const cargarReportes = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get(`/reportes/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
      api.get(
        `/reportes/productos-mas-vendidos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limite=10&agruparPorBase=${agruparPorBase}`,
        { skipToast: true }
      ),
      api.get(`/reportes/ventas-por-mozo?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
      api.get(`/reportes/consumo-insumos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
    ])

    if (results[0].status === 'fulfilled') {
      setVentas(results[0].value.data)
    } else {
      console.error('Error en ventas:', results[0].reason)
    }

    if (results[1].status === 'fulfilled') {
      setProductosMasVendidos(results[1].value.data || [])
    } else {
      console.error('Error en productos:', results[1].reason)
      setProductosMasVendidos([])
    }

    if (results[2].status === 'fulfilled') {
      setVentasPorMozo(results[2].value.data || [])
    } else {
      console.error('Error en mozos:', results[2].reason)
      setVentasPorMozo([])
    }

    if (results[3].status === 'fulfilled') {
      setConsumoInsumos(results[3].value.data)
    } else {
      console.error('Error en consumo:', results[3].reason)
      setConsumoInsumos({
        resumen: { totalIngredientes: 0, ingredientesBajoStock: 0, costoTotalEstimado: 0 },
        ingredientes: [],
      })
    }

    const allFailed = results.every((result) => result.status === 'rejected')
    if (allFailed) {
      toast.error('Error al cargar reportes')
    }
  }, [agruparPorBase, fechaDesde, fechaHasta])

  const handleLoadError = useCallback((error) => {
    console.error('Error general:', error)
    toast.error('Error al cargar reportes')
  }, [])

  const { loading, execute: cargarReportesAsync } = useAsync(
    useCallback(async () => cargarReportes(), [cargarReportes]),
    { immediate: false, onError: handleLoadError }
  )

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      cargarReportesAsync()
    }
  }, [fechaDesde, fechaHasta, cargarReportesAsync])

  const datosMetodosPago = ventas?.ventasPorMetodo
    ? Object.entries(ventas.ventasPorMetodo)
        .map(([metodo, monto]) => ({
          name: metodo,
          value: parseFloat(monto) || 0,
          color: COLORS_METODO[metodo] || '#6b7280',
        }))
        .filter((item) => item.value > 0)
    : []

  const datosTipoPedido = ventas?.ventasPorTipo
    ? Object.entries(ventas.ventasPorTipo)
        .map(([tipo, data]) => ({
          name: tipo,
          value: data.total || 0,
          cantidad: data.cantidad || 0,
          color: COLORS_TIPO[tipo] || '#6b7280',
        }))
        .filter((item) => item.value > 0)
    : []

  return {
    agruparPorBase,
    cargarReportesAsync,
    consumoInsumos,
    datosMetodosPago,
    datosTipoPedido,
    fechaDesde,
    fechaHasta,
    loadingReportes: loading,
    productosMasVendidos,
    setAgruparPorBase,
    setFechaDesde,
    setFechaHasta,
    setTabActiva,
    tabActiva,
    ventas,
    ventasPorMozo,
  }
}
