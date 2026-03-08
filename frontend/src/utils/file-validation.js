const DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export function validateImageFile(file, options = {}) {
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_IMAGE_SIZE_BYTES

  if (!file) {
    return { ok: false, error: 'No se selecciono ningun archivo.' }
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      error: 'Formato no permitido. Usa PNG, JPG o WebP.',
    }
  }

  if (file.size > maxSizeBytes) {
    return {
      ok: false,
      error: `La imagen supera el limite de ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`,
    }
  }

  return { ok: true }
}

export { DEFAULT_MAX_IMAGE_SIZE_BYTES }
