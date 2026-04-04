const DEFAULT_UNIT_TO_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

const parseDurationMs = (value, fallbackMs) => {
  if (value === undefined || value === null || value === '') {
    return fallbackMs;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallbackMs;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10) * 1000;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = DEFAULT_UNIT_TO_MS[unit];

  if (!Number.isFinite(amount) || !multiplier) {
    return fallbackMs;
  }

  return amount * multiplier;
};

module.exports = {
  parseDurationMs
};
