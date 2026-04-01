const POS_CURRENCY_EPSILON = 0.000001

const roundToCents = (value) => {
  const parsed = Number.parseFloat(value)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.round(parsed * 100) / 100
}

const isWholePesoAmount = (value) => {
  const rounded = roundToCents(value)
  return Math.abs(rounded - Math.trunc(rounded)) < POS_CURRENCY_EPSILON
}

export const formatArsPos = (value) => {
  const rounded = roundToCents(value)
  const minimumFractionDigits = isWholePesoAmount(rounded) ? 0 : 2

  return `$ ${rounded.toLocaleString('es-AR', {
    minimumFractionDigits,
    maximumFractionDigits: 2
  })}`
}

export const formatPosInputValue = (value) => {
  if (value === '' || value === null || value === undefined) {
    return ''
  }

  const rounded = roundToCents(value)

  if (!Number.isFinite(rounded)) {
    return ''
  }

  return isWholePesoAmount(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(2)
}
