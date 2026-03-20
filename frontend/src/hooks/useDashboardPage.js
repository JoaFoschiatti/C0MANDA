import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

import api from '../services/api'
import useAsync from './useAsync'
import useEventSource from './useEventSource'

const baseStat = (name, value, icon, extra = {}) => ({ name, value, icon, ...extra })

const allowedLinksByRole = {
  ADMIN: new Set(['/pedidos', '/mesas', '/mozo/nuevo-pedido', '/mozo/mesas', '/cocina', '/tareas', '/reportes', '/ingredientes']),
  CAJERO: new Set(['/pedidos', '/mesas', '/cocina', '/tareas']),
  MOZO: new Set(['/pedidos', '/mozo/nuevo-pedido', '/mozo/mesas']),
  COCINERO: new Set(['/cocina'])
}

const canUseLink = (rol, path) => allowedLinksByRole[rol]?.has(path) || false

const getMesaLink = (rol) => {
  if (rol === 'MOZO') {
    return '/mozo/mesas'
  }

  if (rol === 'ADMIN' || rol === 'CAJERO') {
    return '/mesas'
  }

  return null
}

export default function useDashboardPage({ puedeVerTareas, rol } = {}) {
  const [data, setData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const rolActual = rol || null

  const cargarDashboard = useCallback(async () => {
    const response = await api.get('/reportes/dashboard', { skipToast: true })
    setData(response.data)
    setErrorMessage(null)
    return response.data
  }, [])

  const { loading, execute: cargarDashboardAsync } = useAsync(
    useCallback(async () => cargarDashboard(), [cargarDashboard]),
    {
      immediate: false,
      onError: (error) => {
        console.error('Error al cargar dashboard:', error)
        setErrorMessage(error.response?.data?.error?.message || 'Error al cargar dashboard')
      },
    }
  )

  useEffect(() => {
    cargarDashboardAsync().catch(() => {})
  }, [cargarDashboardAsync])

  const reload = useCallback(() => cargarDashboardAsync().catch(() => {}), [cargarDashboardAsync])

  const handleProductoAgotado = useCallback(
    (event) => {
      try {
        const payload = JSON.parse(event.data)
        toast.error(`Producto agotado: ${payload.nombre}`, { duration: 5000 })
        reload()
      } catch (error) {
        console.error('Error parsing producto.agotado event:', error)
      }
    },
    [reload]
  )

  const handleProductoDisponible = useCallback(
    (event) => {
      try {
        const payload = JSON.parse(event.data)
        toast.success(`Producto disponible: ${payload.nombre}`, { duration: 4000 })
        reload()
      } catch (error) {
        console.error('Error parsing producto.disponible event:', error)
      }
    },
    [reload]
  )

  const handleLotesVencidos = useCallback(
    (event) => {
      try {
        const payload = JSON.parse(event.data)
        toast.error(`Hay ${payload.totalLotes} lotes vencidos pendientes de descarte`, {
          duration: 6000,
        })
        reload()
      } catch (error) {
        console.error('Error parsing stock.lotes_vencidos event:', error)
      }
    },
    [reload]
  )

  useEventSource({
    events: {
      'producto.agotado': handleProductoAgotado,
      'producto.disponible': handleProductoDisponible,
      'stock.lotes_vencidos': handleLotesVencidos,
    },
  })

  const stats = useMemo(() => {
    const mesaLink = getMesaLink(rolActual)
    const items = [
      baseStat('Ventas de Hoy', `$${data?.ventasHoy?.toLocaleString('es-AR') || 0}`, CurrencyDollarIcon),
      baseStat('Pedidos Hoy', data?.pedidosHoy || 0, ShoppingCartIcon),
      baseStat('Pedidos Pendientes', data?.pedidosPendientes || 0, ClockIcon, {
        highlight: data?.pedidosPendientes > 0,
        link: canUseLink(rolActual, '/pedidos') ? '/pedidos' : undefined,
      }),
      baseStat('Mesas Ocupadas', `${data?.mesasOcupadas || 0} / ${data?.mesasTotal || 0}`, TableCellsIcon, {
        link: mesaLink,
      }),
      baseStat('Alertas de Stock', data?.alertasStock || 0, ExclamationTriangleIcon, {
        highlight: data?.alertasStock > 0,
        isWarning: data?.alertasStock > 0,
        link: canUseLink(rolActual, '/ingredientes') ? '/ingredientes' : undefined,
      }),
      baseStat('Descartes Pendientes', data?.lotesVencidosPendientes || 0, ExclamationTriangleIcon, {
        highlight: data?.lotesVencidosPendientes > 0,
        isWarning: data?.lotesVencidosPendientes > 0,
        link: canUseLink(rolActual, '/ingredientes') ? '/ingredientes' : undefined,
      }),
      ...(puedeVerTareas
        ? [
            baseStat('Tareas Operativas', data?.tareasPendientes || 0, ListBulletIcon, {
              highlight: data?.tareasPendientes > 0,
              isWarning: data?.tareasAltaPrioridad > 0,
              link: canUseLink(rolActual, '/tareas') ? '/tareas' : undefined,
            }),
          ]
        : []),
      baseStat('Empleados Trabajando', data?.empleadosTrabajando || 0, UsersIcon),
    ]

    return items.filter((item) => !item.link || canUseLink(rolActual, item.link))
  }, [data, puedeVerTareas, rolActual])

  const quickLinks = useMemo(
    () => {
      const items = []

      if (canUseLink(rolActual, '/pedidos')) {
        items.push({ to: '/pedidos', label: 'Pedidos', icon: ClockIcon })
      }

      if (canUseLink(rolActual, '/mozo/nuevo-pedido')) {
        items.push({ to: '/mozo/nuevo-pedido', label: 'Nuevo Pedido', icon: ShoppingCartIcon })
      }

      const mesaLink = getMesaLink(rolActual)
      if (mesaLink) {
        items.push({ to: mesaLink, label: 'Ver Mesas', icon: TableCellsIcon })
      }

      if (canUseLink(rolActual, '/cocina')) {
        items.push({ to: '/cocina', label: 'Cocina', icon: ClockIcon })
      }

      if (puedeVerTareas && canUseLink(rolActual, '/tareas')) {
        items.push({ to: '/tareas', label: 'Tareas', icon: ListBulletIcon })
      }

      if (canUseLink(rolActual, '/reportes')) {
        items.push({ to: '/reportes', label: 'Reportes', icon: CurrencyDollarIcon })
      }

      return items
    },
    [puedeVerTareas, rolActual]
  )

  return {
    data,
    errorMessage,
    loading,
    quickLinks,
    reload,
    stats,
  }
}
