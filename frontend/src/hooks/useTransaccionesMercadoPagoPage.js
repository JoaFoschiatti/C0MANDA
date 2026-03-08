import { useCallback, useState } from 'react'

import api from '../services/api'
import useAsync from './useAsync'
import useDebouncedValue from './useDebouncedValue'

const emptyTotals = { bruto: 0, comisiones: 0, neto: 0, cantidadAprobadas: 0 }
const emptyPagination = { page: 1, pages: 1, total: 0 }

export default function useTransaccionesMercadoPagoPage() {
  const [transacciones, setTransacciones] = useState([])
  const [totales, setTotales] = useState(emptyTotals)
  const [pagination, setPagination] = useState(emptyPagination)
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    status: '',
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const debouncedFiltros = useDebouncedValue(filtros, 300)

  const cargarTransacciones = useCallback(async () => {
    const response = await api.get('/mercadopago/transacciones', {
      params: {
        page: pagination.page,
        limit: 20,
        ...(debouncedFiltros.desde ? { desde: debouncedFiltros.desde } : {}),
        ...(debouncedFiltros.hasta ? { hasta: debouncedFiltros.hasta } : {}),
        ...(debouncedFiltros.status ? { status: debouncedFiltros.status } : {}),
      },
      skipToast: true,
    })

    const data = response.data
    setTransacciones(Array.isArray(data.transacciones) ? data.transacciones : [])
    setTotales(data.totales || emptyTotals)
    setPagination(data.pagination || emptyPagination)
    setErrorMessage(null)
    return data
  }, [debouncedFiltros, pagination.page])

  const { loading, execute: cargarTransaccionesAsync } = useAsync(
    useCallback(async () => cargarTransacciones(), [cargarTransacciones]),
    {
      onError: (error) => {
        console.error('Error:', error)
        setErrorMessage(error.response?.data?.error?.message || 'Error al cargar transacciones')
      },
    }
  )

  const updateFiltros = useCallback((next) => {
    setFiltros((current) => (typeof next === 'function' ? next(current) : next))
    setPagination((current) => (current.page === 1 ? current : { ...current, page: 1 }))
  }, [])

  const clearFiltros = useCallback(() => {
    updateFiltros({ desde: '', hasta: '', status: '' })
  }, [updateFiltros])

  const goToNextPage = useCallback(() => {
    setPagination((current) => ({ ...current, page: current.page + 1 }))
  }, [])

  const goToPrevPage = useCallback(() => {
    setPagination((current) => ({ ...current, page: current.page - 1 }))
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
    cargarTransaccionesAsync,
    clearFiltros,
    errorMessage,
    filtros,
    formatDate,
    formatMoney,
    goToNextPage,
    goToPrevPage,
    loading,
    pagination,
    setShowFiltros,
    showFiltros,
    toggleFiltros: () => setShowFiltros((current) => !current),
    totales,
    transacciones,
    updateFiltros,
  }
}
