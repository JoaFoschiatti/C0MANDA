export const SUCURSAL_IDS = {
  SALON: 1,
  DELIVERY: 2,
}

export const SUCURSALES = [
  { id: SUCURSAL_IDS.SALON, codigo: 'SALON', nombre: 'Salon' },
  { id: SUCURSAL_IDS.DELIVERY, codigo: 'DELIVERY', nombre: 'Delivery' },
]

export function getSucursalById(id) {
  const parsedId = Number.parseInt(id, 10)
  return SUCURSALES.find((sucursal) => sucursal.id === parsedId) || SUCURSALES[0]
}
