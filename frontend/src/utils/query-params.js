export function parsePositiveIntParam(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseBooleanFlag(value, truthy = '1') {
  return value === truthy
}

export function parseEnumParam(value, allowedValues = []) {
  return allowedValues.includes(value) ? value : null
}
