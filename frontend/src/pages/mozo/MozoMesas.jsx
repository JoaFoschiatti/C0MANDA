import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { PlusIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'
import useMobileViewport from '../../hooks/useMobileViewport'
import { PageHeader, Spinner } from '../../components/ui'
import MesaOperationCard from '../../components/mesas/MesaOperationCard'
import MesaStatusLegend from '../../components/mesas/MesaStatusLegend'

function getMesaSecondaryText(mesa, reservaProxima, formatHora) {
  if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado) && mesa.pedidos?.[0]) {
    return `Pedido #${mesa.pedidos[0].id}`
  }

  if (reservaProxima && ['LIBRE', 'RESERVADA'].includes(mesa.estado)) {
    return `Reserva ${formatHora(reservaProxima.fechaHora)}`
  }

  return null
}

export default function MozoMesas() {
  const isMobileViewport = useMobileViewport()
  const [mesas, setMesas] = useState([])
  const [reservasProximas, setReservasProximas] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [reservasError, setReservasError] = useState(null)
  const navigate = useNavigate()
  const showFloatingNewOrderButton = isMobileViewport

  const cargarMesas = useCallback(async () => {
    try {
      const response = await api.get('/mesas?activa=true', { skipToast: true })
      setMesas(response.data)
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
      // Ir a crear nuevo pedido para esta mesa
      navigate(`/mozo/nuevo-pedido/${mesa.id}`)
    } else if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado)) {
      // Ver pedido actual de la mesa
      if (mesa.pedidos?.[0]) {
        navigate(`/pedidos?mesaId=${mesa.id}`)
      }
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

  // Agrupar mesas por zona
  const mesasPorZona = mesas.reduce((acc, mesa) => {
    const zona = mesa.zona || 'Sin zona'
    if (!acc[zona]) acc[zona] = []
    acc[zona].push(mesa)
    return acc
  }, {})

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

      {/* Leyenda */}
      <MesaStatusLegend className="mb-6" />

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
    </div>
  )
}
