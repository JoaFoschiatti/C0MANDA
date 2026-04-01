const listeners = new Set()

const createSnapshot = (apiAvailable) => ({
  apiAvailable,
  changedAt: Date.now()
})

let snapshot = createSnapshot(true)

const emitChange = () => {
  listeners.forEach((listener) => listener())
}

const setSnapshot = (apiAvailable) => {
  if (snapshot.apiAvailable === apiAvailable) {
    return
  }

  snapshot = createSnapshot(apiAvailable)
  emitChange()
}

export function subscribeBackendStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBackendStatusSnapshot() {
  return snapshot
}

export function markBackendAvailable() {
  setSnapshot(true)
}

export function markBackendUnavailable() {
  setSnapshot(false)
}

export function isBackendConnectivityError(error) {
  if (!error || error.__offline || error.__queued) {
    return false
  }

  if (error.code === 'ERR_CANCELED') {
    return false
  }

  return !error.response
}

export function resetBackendStatusForTests() {
  snapshot = createSnapshot(true)
  emitChange()
}
