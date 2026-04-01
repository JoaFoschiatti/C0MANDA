import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import useBackendAvailability from '../hooks/useBackendAvailability'
import useNetworkStatus from '../hooks/useNetworkStatus'
import { getQueueCount } from '../utils/offline-queue'
import { processOfflineQueue } from '../services/api'
import { markBackendAvailable, markBackendUnavailable } from '../services/backendStatus'

const NetworkStatusContext = createContext(null)
const BACKEND_UNAVAILABLE_TOAST_ID = 'backend-unavailable'
const BACKEND_HEALTHCHECK_INTERVAL_MS = 5000
const API_URL = import.meta.env.VITE_API_URL || '/api'
const HEALTHCHECK_URL = /^https?:\/\//.test(API_URL)
  ? `${API_URL.replace(/\/api\/?$/, '')}/api/health`
  : import.meta.env.DEV
    ? 'http://127.0.0.1:3001/api/health'
    : '/api/health'

export function NetworkStatusProvider({ children }) {
  const { isOnline } = useNetworkStatus()
  const { apiAvailable } = useBackendAvailability()
  const [sseConnected, setSseConnected] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => getQueueCount())
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'syncing' | 'error'
  const wasOfflineRef = useRef(false)
  const previousApiAvailableRef = useRef(apiAvailable)

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueueCount())
  }, [])

  useEffect(() => {
    if (!isOnline) {
      setSseConnected(false)
    }
  }, [isOnline])

  useEffect(() => {
    if (previousApiAvailableRef.current === apiAvailable) {
      return
    }

    previousApiAvailableRef.current = apiAvailable

    if (apiAvailable) {
      toast.dismiss(BACKEND_UNAVAILABLE_TOAST_ID)
      return
    }

    setSseConnected(false)
  }, [apiAvailable])

  useEffect(() => {
    if (!isOnline || apiAvailable) {
      return undefined
    }

    let cancelled = false

    const checkBackendHealth = async () => {
      try {
        const response = await fetch(HEALTHCHECK_URL, {
          cache: 'no-store',
          credentials: 'include'
        })

        if (!cancelled && response.ok) {
          markBackendAvailable()
        } else if (!cancelled) {
          markBackendUnavailable()
        }
      } catch {
        if (!cancelled) {
          markBackendUnavailable()
        }
      }
    }

    checkBackendHealth()
    const intervalId = setInterval(checkBackendHealth, BACKEND_HEALTHCHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [apiAvailable, isOnline])

  // Track offline->online transitions and process queue only after the API is back.
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
      return
    }

    if (!apiAvailable || !wasOfflineRef.current) return
    wasOfflineRef.current = false

    const pending = getQueueCount()
    if (pending === 0) return

    setSyncStatus('syncing')
    processOfflineQueue()
      .then(({ processed, failed }) => {
        setSyncStatus('idle')
        refreshPendingCount()
        if (processed > 0) {
          toast.success(`${processed} operacion(es) sincronizada(s)`)
        }
        if (failed > 0) {
          toast.error(`${failed} operacion(es) fallaron al sincronizar`)
        }
      })
      .catch(() => {
        setSyncStatus('error')
        refreshPendingCount()
      })
  }, [apiAvailable, isOnline, refreshPendingCount])

  const value = {
    isOnline,
    apiAvailable,
    sseConnected,
    setSseConnected,
    pendingCount,
    refreshPendingCount,
    syncStatus,
  }

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  )
}

export function useNetworkStatusContext() {
  const ctx = useContext(NetworkStatusContext)
  if (!ctx) throw new Error('useNetworkStatusContext must be used within NetworkStatusProvider')
  return ctx
}
