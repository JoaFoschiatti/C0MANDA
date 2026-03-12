import { useCallback, useState } from 'react'

import api from '../services/api'
import useAsync from './useAsync'
import useDebouncedValue from './useDebouncedValue'

const emptyPagination = { page: 1, pages: 1, total: 0 }
const LIMIT = 20

export default function useFacturacionPage() {
  const [comprobantes, setComprobantes] = useState([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    estado: '',
    tipoComprobante: '',
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [comprobanteDetalle, setComprobanteDetalle] = useState(null)
  const [showDetalleModal, setShowDetalleModal] = useState(false)

  const debouncedFiltros = useDebouncedValue(filtros, 300)

  const cargarComprobantes = useCallback(async () => {
    const params = {
      limit: LIMIT,
      offset: (pagination.page - 1) * LIMIT,
      ...(debouncedFiltros.desde ? { desde: debouncedFiltros.desde } : {}),
      ...(debouncedFiltros.hasta ? { hasta: debouncedFiltros.hasta } : {}),
      ...(debouncedFiltros.estado ? { estado: debouncedFiltros.estado } : {}),
      ...(debouncedFiltros.tipoComprobante ? { tipoComprobante: debouncedFiltros.tipoComprobante } : {}),
    }

    const response = await api.get('/facturacion/comprobantes', { params, skipToast: true })
    const data = response.data
    setComprobantes(Array.isArray(data.data) ? data.data : [])
    const total = data.total || 0
    setPagination((prev) => ({ ...prev, total, pages: Math.max(1, Math.ceil(total / LIMIT)) }))
    setErrorMessage(null)
    return data
  }, [debouncedFiltros, pagination.page])

  const { loading, execute: cargarComprobantesAsync } = useAsync(
    useCallback(async () => cargarComprobantes(), [cargarComprobantes]),
    {
      onError: (error) => {
        console.error('Error:', error)
        setErrorMessage(error.response?.data?.error?.message || 'Error al cargar comprobantes')
      },
    }
  )

  const updateFiltros = useCallback((next) => {
    setFiltros((current) => (typeof next === 'function' ? next(current) : next))
    setPagination((current) => (current.page === 1 ? current : { ...current, page: 1 }))
  }, [])

  const clearFiltros = useCallback(() => {
    updateFiltros({ desde: '', hasta: '', estado: '', tipoComprobante: '' })
  }, [updateFiltros])

  const goToNextPage = useCallback(() => {
    setPagination((current) => ({ ...current, page: current.page + 1 }))
  }, [])

  const goToPrevPage = useCallback(() => {
    setPagination((current) => ({ ...current, page: current.page - 1 }))
  }, [])

  const abrirDetalle = useCallback(async (comprobante) => {
    try {
      const response = await api.get(`/facturacion/comprobantes/${comprobante.id}`)
      setComprobanteDetalle(response.data)
      setShowDetalleModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }, [])

  const cerrarDetalle = useCallback(() => {
    setShowDetalleModal(false)
    setComprobanteDetalle(null)
  }, [])

  const formatMoney = useCallback(
    (amount) =>
      parseFloat(amount || 0).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
      }),
    []
  )

  const formatDate = useCallback(
    (dateString) =>
      new Date(dateString).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  )

  return {
    abrirDetalle,
    cargarComprobantesAsync,
    cerrarDetalle,
    clearFiltros,
    comprobanteDetalle,
    comprobantes,
    errorMessage,
    filtros,
    formatDate,
    formatMoney,
    goToNextPage,
    goToPrevPage,
    loading,
    pagination,
    setShowFiltros,
    showDetalleModal,
    showFiltros,
    toggleFiltros: () => setShowFiltros((current) => !current),
    updateFiltros,
  }
}
