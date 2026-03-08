const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const buildPath = (pathname, params) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function getTaskLink(task, esAdmin) {
  const pedidoId = toPositiveInt(task?.entidad?.pedidoId)
  const mesaId = toPositiveInt(task?.entidad?.mesaId)
  const ingredienteId = toPositiveInt(task?.entidad?.ingredienteId)
  const loteId = toPositiveInt(task?.entidad?.loteId)

  switch (task?.tipo) {
    case 'MESA_ESPERANDO_CUENTA':
      return pedidoId
        ? buildPath('/pedidos', { pedidoId, openPago: 1 })
        : mesaId
          ? buildPath('/mesas', { mesaId })
          : null
    case 'QR_PRESENCIAL_PENDIENTE':
      return pedidoId ? buildPath('/pedidos', { pedidoId, openPago: 1 }) : null
    case 'LOTE_VENCIDO_PENDIENTE_DESCARTE':
      return esAdmin && ingredienteId
        ? buildPath('/ingredientes', {
            ingredienteId,
            loteId,
            action: 'descartar',
          })
        : null
    case 'INGREDIENTE_STOCK_BAJO':
    case 'LOTE_PROXIMO_A_VENCER':
      return esAdmin && ingredienteId ? buildPath('/ingredientes', { ingredienteId }) : null
    default:
      return null
  }
}
