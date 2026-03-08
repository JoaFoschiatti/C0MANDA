import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CubeIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'

import api from '../services/api'
import useAsync from './useAsync'
import useEventSource from './useEventSource'
import usePolling from './usePolling'

const RESUMEN_CARDS = [
  {
    key: 'total',
    label: 'Total pendientes',
    icon: ListBulletIcon,
    accent: 'bg-primary-50 text-primary-500',
  },
  {
    key: 'altaPrioridad',
    label: 'Alta prioridad',
    icon: ExclamationTriangleIcon,
    accent: 'bg-error-50 text-error-500',
  },
  {
    key: 'caja',
    label: 'Tareas de caja',
    icon: TableCellsIcon,
    accent: 'bg-info-50 text-info-500',
  },
  {
    key: 'stock',
    label: 'Tareas de stock',
    icon: CubeIcon,
    accent: 'bg-warning-50 text-warning-600',
  },
]

const getPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export default function useTareasPage() {
  const [data, setData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [processingTaskId, setProcessingTaskId] = useState(null)

  const cargarTareas = useCallback(async () => {
    const response = await api.get('/reportes/tareas-centro', { skipToast: true })
    setData(response.data)
    setErrorMessage(null)
    return response.data
  }, [])

  const { loading, execute: cargarTareasAsync } = useAsync(
    useCallback(async () => cargarTareas(), [cargarTareas]),
    {
      immediate: false,
      onError: (error) => {
        console.error('Error al cargar tareas:', error)
        setErrorMessage(error.response?.data?.error?.message || 'Error al cargar tareas operativas')
      },
    }
  )

  useEffect(() => {
    cargarTareasAsync().catch(() => {})
  }, [cargarTareasAsync])

  usePolling(cargarTareasAsync, 60000, { immediate: false })

  useEventSource({
    events: {
      'mesa.updated': () => cargarTareasAsync().catch(() => {}),
      'pedido.updated': () => cargarTareasAsync().catch(() => {}),
      'pago.updated': () => cargarTareasAsync().catch(() => {}),
      'producto.agotado': () => cargarTareasAsync().catch(() => {}),
      'producto.disponible': () => cargarTareasAsync().catch(() => {}),
      'stock.lotes_vencidos': () => cargarTareasAsync().catch(() => {}),
    },
  })

  const resumenCards = useMemo(
    () =>
      RESUMEN_CARDS.map((card) => ({
        ...card,
        value: data?.resumen?.[card.key] ?? 0,
      })),
    [data]
  )

  const reload = useCallback(() => cargarTareasAsync().catch(() => {}), [cargarTareasAsync])

  const handleCerrarPedido = useCallback(
    async (task) => {
      const pedidoId = getPositiveInt(task?.entidad?.pedidoId)
      if (!pedidoId) {
        return
      }

      setProcessingTaskId(task.id)

      try {
        await api.post(`/pedidos/${pedidoId}/cerrar`, {})
        toast.success(`Pedido #${pedidoId} cerrado`)
        await cargarTareasAsync()
      } catch (error) {
        console.error('Error cerrando pedido desde tareas:', error)
      } finally {
        setProcessingTaskId(null)
      }
    },
    [cargarTareasAsync]
  )

  const handleLiberarMesa = useCallback(
    async (task) => {
      const mesaId = getPositiveInt(task?.entidad?.mesaId)
      if (!mesaId) {
        return
      }

      setProcessingTaskId(task.id)

      try {
        await api.post(`/mesas/${mesaId}/liberar`, {})
        toast.success(`Mesa ${mesaId} liberada`)
        await cargarTareasAsync()
      } catch (error) {
        console.error('Error liberando mesa desde tareas:', error)
      } finally {
        setProcessingTaskId(null)
      }
    },
    [cargarTareasAsync]
  )

  return {
    data,
    errorMessage,
    handleCerrarPedido,
    handleLiberarMesa,
    loading,
    processingTaskId,
    reload,
    resumenCards,
  }
}
