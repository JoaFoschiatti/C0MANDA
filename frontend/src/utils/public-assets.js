export function resolvePublicAssetUrl(value, backendUrl = '') {
  const rawValue = typeof value === 'string' ? value.trim() : ''

  if (!rawValue) {
    return null
  }

  if (/^(https?:)?\/\//i.test(rawValue) || rawValue.startsWith('data:')) {
    return rawValue
  }

  const normalizedBackendUrl = String(backendUrl || '').replace(/\/$/, '')
  const normalizedPath = rawValue.startsWith('/') ? rawValue : `/${rawValue}`

  return normalizedBackendUrl ? `${normalizedBackendUrl}${normalizedPath}` : normalizedPath
}
