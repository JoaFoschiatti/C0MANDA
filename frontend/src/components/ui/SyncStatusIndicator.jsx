import { useNetworkStatusContext } from '../../context/NetworkStatusContext'

export default function SyncStatusIndicator() {
  const { isOnline, sseConnected, pendingCount, syncStatus } = useNetworkStatusContext()

  let color, title
  if (!isOnline) {
    color = 'bg-red-500'
    title = 'Sin conexion'
  } else if (syncStatus === 'syncing' || !sseConnected) {
    color = 'bg-yellow-400'
    title = syncStatus === 'syncing' ? 'Sincronizando...' : 'Reconectando...'
  } else {
    color = 'bg-green-500'
    title = 'Conectado'
  }

  return (
    <div className="flex items-center gap-1.5" title={title}>
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {pendingCount > 0 && (
        <span className="text-xs text-muted">{pendingCount}</span>
      )}
    </div>
  )
}
