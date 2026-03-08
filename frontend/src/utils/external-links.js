const DEFAULT_ALLOWED_HOST_SUFFIXES = [
  'wa.me',
  'api.whatsapp.com',
  'web.whatsapp.com',
  'mercadopago.com',
  'mercadopago.com.ar',
  'mercadopago.cl',
  'mercadopago.com.br',
  'mercadopago.com.co',
  'mercadopago.com.mx',
  'mercadopago.com.pe',
  'mpago.la'
]

const isAllowedHostname = (hostname, allowedHostSuffixes = DEFAULT_ALLOWED_HOST_SUFFIXES) => (
  allowedHostSuffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))
)

export function isSafeExternalUrl(value, options = {}) {
  const { allowRelative = false, allowedHostSuffixes = DEFAULT_ALLOWED_HOST_SUFFIXES } = options

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const url = new URL(value, baseUrl)

    if (!['https:', 'http:'].includes(url.protocol)) {
      return false
    }

    if (allowRelative && url.origin === baseUrl) {
      return true
    }

    return isAllowedHostname(url.hostname, allowedHostSuffixes)
  } catch {
    return false
  }
}

export function openExternalUrl(value, options = {}) {
  if (!isSafeExternalUrl(value, options)) {
    return false
  }

  const target = options.target || '_blank'
  const features = target === '_blank' ? 'noopener,noreferrer' : undefined
  const popup = window.open(value, target, features)

  if (popup && target === '_blank') {
    popup.opener = null
  }

  return Boolean(popup)
}

export function navigateExternalUrl(value, options = {}) {
  if (!isSafeExternalUrl(value, options)) {
    return false
  }

  window.location.assign(value)
  return true
}

export function buildWhatsAppUrl(phone, message) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  if (!normalizedPhone) {
    return null
  }

  const url = new URL(`https://wa.me/${normalizedPhone}`)
  if (message) {
    url.searchParams.set('text', message)
  }
  return url.toString()
}
