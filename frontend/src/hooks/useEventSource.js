import { useEffect, useRef } from 'react'
import { createEventSource } from '../services/eventos'
import useBackendAvailability from './useBackendAvailability'
import useNetworkStatus from './useNetworkStatus'

const INITIAL_BACKOFF = 1000
const MAX_BACKOFF = 30000
const BACKOFF_MULTIPLIER = 2

export default function useEventSource({ enabled = true, events = {}, onOpen, onError, onConnectionChange } = {}) {
  const { apiAvailable } = useBackendAvailability()
  const { isOnline } = useNetworkStatus()
  const eventsRef = useRef(events)
  const onOpenRef = useRef(onOpen)
  const onErrorRef = useRef(onError)
  const onConnectionChangeRef = useRef(onConnectionChange)

  useEffect(() => { eventsRef.current = events }, [events])
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { onConnectionChangeRef.current = onConnectionChange }, [onConnectionChange])

  const eventNamesKey = Object.keys(events).sort().join('|')

  useEffect(() => {
    const shouldConnect = enabled && isOnline && apiAvailable

    if (!shouldConnect) {
      onConnectionChangeRef.current?.(false)
      return undefined
    }

    let sourceRef = null
    let reconnectTimer = null
    let reconnectAttempt = 0
    let disposed = false

    function connect() {
      if (disposed) return

      const source = createEventSource()
      if (!source) return
      sourceRef = source

      const listeners = {}
      Object.keys(eventsRef.current).forEach((eventName) => {
        const handler = (event) => {
          const currentHandler = eventsRef.current[eventName]
          if (currentHandler) currentHandler(event)
        }
        listeners[eventName] = handler
        source.addEventListener(eventName, handler)
      })

      source.onopen = () => {
        reconnectAttempt = 0
        onOpenRef.current?.()
        onConnectionChangeRef.current?.(true)
      }

      source.onerror = () => {
        onErrorRef.current?.()
        onConnectionChangeRef.current?.(false)

        // Clean up current source
        Object.entries(listeners).forEach(([eventName, handler]) => {
          source.removeEventListener(eventName, handler)
        })
        source.close()
        sourceRef = null

        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (disposed) return

      const delay = Math.min(INITIAL_BACKOFF * (BACKOFF_MULTIPLIER ** reconnectAttempt), MAX_BACKOFF)
      reconnectAttempt++

      reconnectTimer = setTimeout(() => {
        connect()
      }, delay)
    }

    connect()

    return () => {
      disposed = true
      clearTimeout(reconnectTimer)
      if (sourceRef) {
        sourceRef.close()
        sourceRef = null
      }
    }
  }, [apiAvailable, enabled, eventNamesKey, isOnline])
}
