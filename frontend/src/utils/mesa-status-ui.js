export const MESA_STATUS_ORDER = [
  'LIBRE',
  'OCUPADA',
  'RESERVADA',
  'ESPERANDO_CUENTA',
  'CERRADA'
]

const MESA_STATUS_UI = {
  LIBRE: {
    label: 'Libre',
    themeClass: 'mesa-status-theme--libre',
  },
  OCUPADA: {
    label: 'Ocupada',
    themeClass: 'mesa-status-theme--ocupada',
  },
  RESERVADA: {
    label: 'Reservada',
    themeClass: 'mesa-status-theme--reservada',
  },
  ESPERANDO_CUENTA: {
    label: 'Esperando cuenta',
    themeClass: 'mesa-status-theme--esperando',
  },
  CERRADA: {
    label: 'Cerrada',
    themeClass: 'mesa-status-theme--cerrada',
  }
}

const FALLBACK_STATUS_UI = {
  label: 'Sin estado',
  themeClass: 'mesa-status-theme--cerrada',
}

export const MESA_OPERATION_CARD_SIZE_CLASS = 'w-28 h-28 sm:w-32 sm:h-32'

export function getMesaStatusUi(estado) {
  return MESA_STATUS_UI[estado] || FALLBACK_STATUS_UI
}
