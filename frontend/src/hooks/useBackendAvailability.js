import { useSyncExternalStore } from 'react'
import {
  getBackendStatusSnapshot,
  subscribeBackendStatus,
} from '../services/backendStatus'

export default function useBackendAvailability() {
  return useSyncExternalStore(
    subscribeBackendStatus,
    getBackendStatusSnapshot,
    getBackendStatusSnapshot
  )
}
