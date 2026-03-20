import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import useNetworkStatus from '../hooks/useNetworkStatus'
import { getQueueCount } from '../utils/offline-queue'
import { processOfflineQueue } from '../services/api'
import toast from 'react-hot-toast'

const NetworkStatusContext = createContext(null)

export function NetworkStatusProvider({ children }) {
  const { isOnline } = useNetworkStatus()
  const [sseConnected, setSseConnected] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => getQueueCount())
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'syncing' | 'error'
  const wasOfflineRef = useRef(false)

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueueCount())
  }, [])

  // Track offline→online transitions and process queue
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
      return
    }

    if (!wasOfflineRef.current) return
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
  }, [isOnline, refreshPendingCount])

  const value = {
    isOnline,
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
