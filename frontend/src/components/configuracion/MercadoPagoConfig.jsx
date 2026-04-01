import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import useAsync from '../../hooks/useAsync'
import {
  CreditCardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

export default function MercadoPagoConfig({ onStatusChange }) {
  const [status, setStatus] = useState(null)
  const [configInfo, setConfigInfo] = useState(null)
  const [manualToken, setManualToken] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState(null)

  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const checkStatus = useCallback(async () => {
    const response = await api.get('/mercadopago/status', { skipToast: true })
    const data = response.data
    setConfigInfo(data.config)
    setStatus(data.connected ? 'connected' : 'disconnected')
    onStatusChangeRef.current?.(data.connected)
    return data
  }, [])

  const { loading: statusLoading, execute: checkStatusAsync } = useAsync(
    useCallback(async () => checkStatus(), [checkStatus]),
    {
      onError: () => setStatus('error')
    }
  )

  const handleSaveManual = async () => {
    if (!manualToken.trim()) {
      setError('Ingresa el Access Token')
      return
    }

    try {
      setSavingManual(true)
      setError(null)

      const response = await api.post(
        '/mercadopago/config/manual',
        { accessToken: manualToken },
        { skipToast: true }
      )

      setStatus('connected')
      setConfigInfo({ email: response.data.email, isActive: true })
      setManualToken('')
      onStatusChangeRef.current?.(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSavingManual(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Deseas desconectar la cuenta de MercadoPago?')) {
      return
    }

    try {
      setDisconnecting(true)
      await api.delete('/mercadopago/oauth/disconnect', { skipToast: true })
      setStatus('disconnected')
      setConfigInfo(null)
      onStatusChangeRef.current?.(false)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (statusLoading && !status) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="w-6 h-6 animate-spin text-text-tertiary" />
          <span className="text-text-secondary">Cargando estado de MercadoPago...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border-subtle">
        <div className="p-2 bg-info-100 rounded-xl">
          <CreditCardIcon className="w-6 h-6 text-info-600" />
        </div>
        <div>
          <h3 className="font-bold text-text-primary">MercadoPago</h3>
          <p className="text-text-secondary text-sm">Una sola cuenta del local para pagos online y transferencias registradas en caja</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-error-50 text-error-700 p-3 rounded-xl flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            type="button"
            aria-label="Cerrar mensaje de error"
            className="ml-auto"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {status === 'connected' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-success-50 p-4 rounded-xl">
            <CheckCircleIcon className="w-8 h-8 text-success-500" />
            <div>
              <p className="font-semibold text-success-800">Cuenta conectada</p>
              {configInfo?.email && (
                <p className="text-sm text-success-600">{configInfo.email}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-text-secondary">
            Esta cuenta se usa para checkout web y para registrar cobros de Mercado Pago en caja.
          </p>

          <button
            onClick={handleDisconnect}
            type="button"
            disabled={disconnecting}
            className="text-error-600 hover:text-error-700 text-sm font-medium flex items-center gap-1"
          >
            {disconnecting ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <XMarkIcon className="w-4 h-4" />
            )}
            Desconectar cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-warning-50 p-4 rounded-xl">
            <ExclamationTriangleIcon className="w-8 h-8 text-warning-500" />
            <div>
              <p className="font-semibold text-warning-800">No hay cuenta conectada</p>
              <p className="text-sm text-warning-600">Configura el Access Token de la cuenta del restaurante</p>
            </div>
          </div>

          <div className="p-4 bg-surface-hover rounded-xl space-y-3">
            <p className="text-sm text-text-secondary">
              Usa el Access Token productivo de la cuenta oficial del local.
            </p>

            <div>
              <label className="label" htmlFor="mp-access-token">
                Access Token
              </label>
              <input
                id="mp-access-token"
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="APP_USR-xxxx..."
                className="input"
              />
            </div>

            <button
              onClick={handleSaveManual}
              type="button"
              disabled={savingManual || !manualToken.trim()}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              {savingManual ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              Guardar configuracion
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-4">
          <ExclamationTriangleIcon className="w-12 h-12 text-error-400 mx-auto mb-2" />
          <p className="text-error-600">Error al cargar estado</p>
          <button
            onClick={checkStatusAsync}
            type="button"
            className="mt-2 text-primary-600 hover:underline text-sm"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
