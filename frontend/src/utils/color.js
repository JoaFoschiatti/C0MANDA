export function normalizeHexColor(value, fallback = '#3B82F6') {
  const normalized = String(value || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback
}
