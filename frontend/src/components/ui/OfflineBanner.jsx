import { useNetworkStatusContext } from '../../context/NetworkStatusContext'

export default function OfflineBanner() {
  const { isOnline, apiAvailable, pendingCount, syncStatus } = useNetworkStatusContext()

  if (isOnline && syncStatus === 'syncing') {
    return (
      <div className="bg-blue-600 text-white text-center py-2 px-4 text-sm font-medium z-50 relative">
        <span className="inline-block animate-spin mr-2">&#8635;</span>
        Sincronizando operaciones pendientes...
        {pendingCount > 0 && ` (${pendingCount} restantes)`}
      </div>
    )
  }

  if (isOnline && !apiAvailable) {
    return (
      <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium z-50 relative">
        Backend no disponible &mdash; Reintentando conexion automaticamente
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium z-50 relative">
        Sin conexion &mdash; Los cambios se guardaran localmente
        {pendingCount > 0 && ` (${pendingCount} pendientes)`}
      </div>
    )
  }

  return null
}
