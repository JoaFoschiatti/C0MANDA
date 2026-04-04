import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'
import { exportToCSV } from '../utils/export-csv'

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
  const [ventasPorHora, setVentasPorHora] = useState(null)
  const [compararActivo, setCompararActivo] = useState(false)
  const [tabActiva, setTabActiva] = useState('ventas')

  useEffect(() => {
    const hoy = new Date()
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(hace30Dias.toISOString().split('T')[0])
  }, [])

  const cargarReportes = useCallback(async () => {
    let ventasUrl = `/reportes/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`
    if (compararActivo) {
      const desde = new Date(`${fechaDesde}T00:00:00`)
      const hasta = new Date(`${fechaHasta}T00:00:00`)
      const duracion = hasta.getTime() - desde.getTime()
      const compHasta = new Date(desde.getTime() - 1)
      const compDesde = new Date(compHasta.getTime() - duracion)
      ventasUrl += `&fechaDesdeComp=${compDesde.toISOString().split('T')[0]}&fechaHastaComp=${compHasta.toISOString().split('T')[0]}`
    }

    const results = await Promise.allSettled([
      api.get(ventasUrl, { skipToast: true }),
      api.get(
        `/reportes/productos-mas-vendidos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limite=10&agruparPorBase=${agruparPorBase}`,
        { skipToast: true }
      ),
      api.get(`/reportes/ventas-por-mozo?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
      api.get(`/reportes/consumo-insumos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
      api.get(`/reportes/ventas-por-hora?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
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

    if (results[4]?.status === 'fulfilled') {
      setVentasPorHora(results[4].value.data)
    } else if (results[4]) {
      console.error('Error en horas pico:', results[4].reason)
    }

    const allFailed = results.every((result) => result.status === 'rejected')
    if (allFailed) {
      toast.error('Error al cargar reportes')
    }
  }, [agruparPorBase, compararActivo, fechaDesde, fechaHasta])

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

  const exportarCSV = useCallback((tipo) => {
    const fecha = `${fechaDesde}_${fechaHasta}`
    const fmtMoney = (v) => typeof v === 'number' ? v.toFixed(2) : parseFloat(v || 0).toFixed(2)

    if (tipo === 'ventas' && ventas?.pedidos?.length) {
      exportToCSV(ventas.pedidos, [
        { key: 'createdAt', label: 'Fecha', format: (v) => v ? new Date(v).toLocaleString('es-AR') : '' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'estado', label: 'Estado' },
        { key: 'mozo', label: 'Mozo', format: (v) => v || '' },
        { key: 'total', label: 'Total', format: fmtMoney },
        { key: 'metodoPago', label: 'Metodo Pago', format: (v) => v || '' },
      ], `ventas_${fecha}`)
    } else if (tipo === 'productos' && productosMasVendidos?.length) {
      exportToCSV(productosMasVendidos, [
        { key: 'producto', label: 'Producto' },
        { key: 'categoria', label: 'Categoria', format: (v) => v || '' },
        { key: 'cantidadVendida', label: 'Cantidad Vendida' },
        { key: 'totalVentas', label: 'Total Ventas', format: fmtMoney },
      ], `productos_${fecha}`)
    } else if (tipo === 'mozos' && ventasPorMozo?.length) {
      exportToCSV(ventasPorMozo, [
        { key: 'mozo', label: 'Mozo' },
        { key: 'pedidos', label: 'Pedidos' },
        { key: 'totalVentas', label: 'Total Ventas', format: fmtMoney },
      ], `ventas_por_mozo_${fecha}`)
    } else if (tipo === 'horasPico' && ventasPorHora?.horas?.length) {
      exportToCSV(ventasPorHora.horas, [
        { key: 'hora', label: 'Hora' },
        { key: 'cantidadPedidos', label: 'Cantidad Pedidos' },
        { key: 'totalVentas', label: 'Total Ventas', format: fmtMoney },
        { key: 'ticketPromedio', label: 'Ticket Promedio', format: fmtMoney },
      ], `horas_pico_${fecha}`)
    } else if (tipo === 'insumos' && consumoInsumos?.ingredientes?.length) {
      exportToCSV(consumoInsumos.ingredientes, [
        { key: 'nombre', label: 'Ingrediente' },
        { key: 'unidad', label: 'Unidad' },
        { key: 'consumo', label: 'Consumo', format: (v) => parseFloat(v || 0).toFixed(3) },
        { key: 'costo', label: 'Costo Estimado', format: fmtMoney },
      ], `consumo_insumos_${fecha}`)
    } else {
      toast.error('No hay datos para exportar')
    }
  }, [consumoInsumos, fechaDesde, fechaHasta, productosMasVendidos, ventas, ventasPorHora, ventasPorMozo])

  return {
    agruparPorBase,
    cargarReportesAsync,
    compararActivo,
    consumoInsumos,
    datosMetodosPago,
    datosTipoPedido,
    exportarCSV,
    fechaDesde,
    fechaHasta,
    loadingReportes: loading,
    productosMasVendidos,
    setAgruparPorBase,
    setCompararActivo,
    setFechaDesde,
    setFechaHasta,
    setTabActiva,
    tabActiva,
    ventas,
    ventasPorHora,
    ventasPorMozo,
  }
}
