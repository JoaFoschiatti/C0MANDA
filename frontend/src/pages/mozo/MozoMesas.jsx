import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import useAsync from '../../hooks/useAsync'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'
import useMobileViewport from '../../hooks/useMobileViewport'
import { PageHeader, Spinner } from '../../components/ui'
import MesaOperationCard from '../../components/mesas/MesaOperationCard'
import MesaStatusLegend from '../../components/mesas/MesaStatusLegend'
import MesaSummaryStrip from '../../components/mesas/MesaSummaryStrip'
import MesaActionSheet from '../../components/mesas/MesaActionSheet'
import { MESA_STATUS_PRIORITY } from '../../utils/mesa-status-ui'

function formatElapsed(date) {
  if (!date) return null
  const ms = Date.now() - new Date(date).getTime()
  if (ms < 0) return null
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`
}

function getMesaSecondaryText(mesa, reservaProxima, formatHora) {
  if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado) && mesa.pedidos?.[0]) {
    const elapsed = formatElapsed(mesa.pedidos[0].createdAt)
    const base = `#${mesa.pedidos[0].id}`
    return elapsed ? `${base} · ${elapsed}` : base
  }

  if (reservaProxima && ['LIBRE', 'RESERVADA'].includes(mesa.estado)) {
    return `Reserva ${formatHora(reservaProxima.fechaHora)}`
  }

  return null
}

function formatLastUpdate(date) {
  if (!date) return null
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 10) return 'Actualizado ahora'
  if (secs < 60) return `Actualizado hace ${secs}s`
  const mins = Math.floor(secs / 60)
  return `Actualizado hace ${mins}min`
}

function sortByPriority(mesas) {
  return [...mesas].sort(
    (a, b) => (MESA_STATUS_PRIORITY[a.estado] ?? 99) - (MESA_STATUS_PRIORITY[b.estado] ?? 99)
  )
}

export default function MozoMesas() {
  const isMobileViewport = useMobileViewport()
  const [mesas, setMesas] = useState([])
  const [reservasProximas, setReservasProximas] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [reservasError, setReservasError] = useState(null)
  const [actionSheetMesa, setActionSheetMesa] = useState(null)
  const [highlightedIds, setHighlightedIds] = useState(new Set())
  const [lastRefresh, setLastRefresh] = useState(null)
  const [, setTick] = useState(0)
  const navigate = useNavigate()
  const showFloatingNewOrderButton = isMobileViewport
  const prevMesasRef = useRef([])

  // Tick every 60s to keep elapsed times fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // Tick every 15s to keep "last update" timestamp fresh
  useEffect(() => {
    if (!lastRefresh) return
    const interval = setInterval(() => setTick((t) => t + 1), 15000)
    return () => clearInterval(interval)
  }, [lastRefresh])

  const cargarMesas = useCallback(async () => {
    try {
      const response = await api.get('/mesas?activa=true', { skipToast: true })
      const newMesas = response.data
      const prev = prevMesasRef.current

      // Detect state changes for highlights + toasts
      if (prev.length > 0) {
        const changedIds = new Set()
        for (const newM of newMesas) {
          const oldM = prev.find((m) => m.id === newM.id)
          if (oldM && oldM.estado !== newM.estado) {
            changedIds.add(newM.id)
            if (newM.estado === 'ESPERANDO_CUENTA') {
              toast(`Mesa ${newM.numero} esperando cuenta`, { icon: '🧾' })
            }
          }
        }

        if (changedIds.size > 0) {
          setHighlightedIds(changedIds)
          setTimeout(() => setHighlightedIds(new Set()), 3000)
        }
      }

      prevMesasRef.current = newMesas
      setMesas(newMesas)
      setLastRefresh(new Date())
      setLoadError(null)
    } catch (error) {
      console.error('Error:', error)
      setLoadError('No pudimos cargar las mesas.')
    }
  }, [])

  const cargarReservasProximas = useCallback(async () => {
    try {
      const response = await api.get('/reservas/proximas', { skipToast: true })
      setReservasProximas(response.data)
      setReservasError(null)
    } catch (error) {
      console.error('Error:', error)
      setReservasError('No pudimos cargar las reservas proximas.')
    }
  }, [])

  const refrescar = useCallback(async () => {
    await Promise.all([cargarMesas(), cargarReservasProximas()])
  }, [cargarMesas, cargarReservasProximas])

  const refrescarRequest = useCallback(async (_ctx) => (
    refrescar()
  ), [refrescar])

  const { loading, execute: refrescarAsync } = useAsync(refrescarRequest)

  usePolling(refrescarAsync, 30000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': refrescarAsync,
      'mesa.updated': refrescarAsync,
      'reserva.updated': refrescarAsync
    }
  })

  const getReservaProxima = (mesaId) => {
    return reservasProximas.find(r => r.mesaId === mesaId)
  }

  const formatHora = (fecha) => {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'LIBRE') {
      navigate(`/mozo/nuevo-pedido/${mesa.id}`)
    } else if (mesa.estado === 'RESERVADA') {
      const reserva = getReservaProxima(mesa.id)
      navigate(reserva ? `/reservas?reservaId=${reserva.id}` : '/reservas')
    } else if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado)) {
      setActionSheetMesa(mesa)
    }
  }

  const handleRetry = () => {
    setLoadError(null)
    refrescarAsync()
  }

  if (loading && mesas.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (loadError && mesas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ExclamationCircleIcon className="w-10 h-10 text-error-500 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No pudimos cargar las mesas</h2>
        <p className="text-sm text-text-secondary mb-4">{loadError}</p>
        <button type="button" onClick={handleRetry} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    )
  }

  // Group by zone and sort by priority within each zone
  const mesasPorZona = mesas.reduce((acc, mesa) => {
    const zona = mesa.zona || 'Sin zona'
    if (!acc[zona]) acc[zona] = []
    acc[zona].push(mesa)
    return acc
  }, {})

  for (const zona of Object.keys(mesasPorZona)) {
    mesasPorZona[zona] = sortByPriority(mesasPorZona[zona])
  }

  return (
    <div className={showFloatingNewOrderButton ? 'pb-24 md:pb-0' : undefined}>
      {loadError && mesas.length > 0 && (
        <div className="mb-4 bg-error-50 text-error-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{loadError}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm font-medium hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      {reservasError && (
        <div className="mb-4 bg-warning-50 text-warning-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{reservasError}</span>
          <button
            type="button"
            onClick={cargarReservasProximas}
            className="text-sm font-medium hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      <PageHeader
        title="Mesas"
        actions={
          !showFloatingNewOrderButton ? (
            <button
              onClick={() => navigate('/mozo/nuevo-pedido')}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Nuevo pedido
            </button>
          ) : null
        }
      />

      {/* Summary strip + last update */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <MesaSummaryStrip mesas={mesas} />
        {lastRefresh && (
          <span className="text-xs text-text-tertiary whitespace-nowrap shrink-0">
            {formatLastUpdate(lastRefresh)}
          </span>
        )}
      </div>

      {/* Legend on desktop only — strip handles mobile */}
      {!isMobileViewport && <MesaStatusLegend className="mb-6" />}

      {Object.entries(mesasPorZona).map(([zona, mesasZona]) => (
        <div key={zona} className="mb-8">
          <h2 className="text-heading-3 text-text-secondary mb-4">{zona}</h2>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
            {mesasZona.map((mesa) => {
              const reservaProxima = getReservaProxima(mesa.id)
              const secondaryText = getMesaSecondaryText(mesa, reservaProxima, formatHora)

              return (
                <MesaOperationCard
                  key={mesa.id}
                  mesa={mesa}
                  secondaryText={secondaryText}
                  reservaTooltip={reservaProxima
                    ? `Reserva a las ${formatHora(reservaProxima.fechaHora)} - ${reservaProxima.clienteNombre}`
                    : null}
                  onClick={() => handleMesaClick(mesa)}
                  mobileFill={isMobileViewport}
                  highlighted={highlightedIds.has(mesa.id)}
                  attentionPulse={mesa.estado === 'ESPERANDO_CUENTA'}
                />
              )
            })}
          </div>
        </div>
      ))}

      {showFloatingNewOrderButton && (
        <button
          type="button"
          className="page-mobile-cta page-mobile-cta--compact"
          onClick={() => navigate('/mozo/nuevo-pedido')}
          aria-label="Nuevo pedido"
          data-testid="mozo-mesas-mobile-new-order"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Nuevo pedido</span>
        </button>
      )}

      <MesaActionSheet
        mesa={actionSheetMesa}
        open={Boolean(actionSheetMesa)}
        onClose={() => setActionSheetMesa(null)}
        onRefresh={refrescarAsync}
      />
    </div>
  )
}
