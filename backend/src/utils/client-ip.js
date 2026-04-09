const normalizeIp = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const withoutZone = raw.split('%')[0];
  return withoutZone.startsWith('::ffff:') ? withoutZone.slice(7) : withoutZone;
};

const firstForwardedIp = (value) => String(value || '')
  .split(',')[0]
  ?.trim() || '';

const isTrustProxyEnabled = (value) => {
  if (typeof value === 'function') {
    return true;
  }

  if (typeof value === 'number') {
    return value > 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'false' || normalized === '0' || normalized === 'off') {
      return false;
    }

    if (normalized === 'true' || normalized === 'on') {
      return true;
    }

    const numeric = Number.parseInt(normalized, 10);
    if (Number.isInteger(numeric)) {
      return numeric > 0;
    }

    return true;
  }

  return Boolean(value);
};

const resolveClientIp = ({
  ip = null,
  forwardedFor = null,
  remoteAddress = null,
  trustProxy = false
} = {}) => {
  const normalizedIp = normalizeIp(ip);
  if (normalizedIp) {
    return normalizedIp;
  }

  if (isTrustProxyEnabled(trustProxy)) {
    const forwardedIp = normalizeIp(firstForwardedIp(forwardedFor));
    if (forwardedIp) {
      return forwardedIp;
    }
  }

  const normalizedRemoteAddress = normalizeIp(remoteAddress);
  if (normalizedRemoteAddress) {
    return normalizedRemoteAddress;
  }

  return 'unknown';
};

const getClientIpFromRequest = (req = {}) => resolveClientIp({
  ip: req.ip,
  forwardedFor: req.headers?.['x-forwarded-for'],
  remoteAddress: req.socket?.remoteAddress,
  trustProxy: req.app?.get?.('trust proxy')
});

module.exports = {
  getClientIpFromRequest,
  isTrustProxyEnabled,
  normalizeIp,
  resolveClientIp
};
