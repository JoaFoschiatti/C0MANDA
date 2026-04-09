const {
  getClientIpFromRequest,
  normalizeIp,
  resolveClientIp
} = require('../utils/client-ip');
const { getRequestSourceIp } = require('../services/bridge-auth.service');

describe('Client IP parsing', () => {
  it('normalizes ipv4-mapped ipv6 addresses', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });

  it('ignores x-forwarded-for when trust proxy is disabled', () => {
    const req = {
      ip: '10.0.0.5',
      headers: { 'x-forwarded-for': '198.51.100.10, 10.0.0.5' },
      socket: { remoteAddress: '10.0.0.5' },
      app: { get: () => false }
    };

    expect(getClientIpFromRequest(req)).toBe('10.0.0.5');
    expect(getRequestSourceIp(req)).toBe('10.0.0.5');
  });

  it('uses forwarded client ip only when trust proxy is enabled', () => {
    const req = {
      ip: '',
      headers: { 'x-forwarded-for': '198.51.100.10, 10.0.0.5' },
      socket: { remoteAddress: '10.0.0.5' },
      app: { get: () => 1 }
    };

    expect(getClientIpFromRequest(req)).toBe('198.51.100.10');
    expect(getRequestSourceIp(req)).toBe('198.51.100.10');
  });

  it('falls back to remote address when forwarded headers are not trusted', () => {
    const ip = resolveClientIp({
      ip: '',
      forwardedFor: '198.51.100.10',
      remoteAddress: '::ffff:127.0.0.1',
      trustProxy: false
    });

    expect(ip).toBe('127.0.0.1');
  });
});
