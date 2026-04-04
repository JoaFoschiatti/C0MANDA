const crypto = require('crypto');
const net = require('net');
const { createHttpError } = require('../utils/http-error');

const DEFAULT_SIGNATURE_TTL_SECONDS = 120;

const normalizeIp = (value) => {
  const ip = String(value || '').trim();
  if (!ip) {
    return '';
  }

  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

const getRequestSourceIp = (req) => normalizeIp(
  String(req.headers['x-forwarded-for'] || '').split(',')[0]
  || req.ip
  || req.socket?.remoteAddress
  || ''
);

const ipv4ToInt = (ip) => ip.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);

const isIpv4CidrMatch = (ip, cidr) => {
  const [base, maskRaw] = cidr.split('/');
  const mask = Number(maskRaw);

  if (!Number.isInteger(mask) || mask < 0 || mask > 32) {
    return false;
  }

  if (net.isIP(ip) !== 4 || net.isIP(base) !== 4) {
    return false;
  }

  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const maskBits = mask === 0 ? 0 : (0xffffffff << (32 - mask)) >>> 0;

  return (ipInt & maskBits) === (baseInt & maskBits);
};

const parseAllowedIps = () => (process.env.BRIDGE_ALLOWED_IPS || '')
  .split(',')
  .map((value) => normalizeIp(value))
  .filter(Boolean);

const assertIpAllowed = (req) => {
  const allowedIps = parseAllowedIps();
  if (allowedIps.length === 0) {
    throw createHttpError.serviceUnavailable('Bridge allowlist no configurada');
  }

  const sourceIp = getRequestSourceIp(req);
  const allowed = allowedIps.some((rule) => (
    rule.includes('/')
      ? isIpv4CidrMatch(sourceIp, rule)
      : sourceIp === normalizeIp(rule)
  ));

  if (!allowed) {
    throw createHttpError.forbidden('Origen de bridge no permitido');
  }

  return sourceIp;
};

const getBridgeSecret = () => {
  if (process.env.BRIDGE_TOKEN) {
    return process.env.BRIDGE_TOKEN;
  }

  throw createHttpError.serviceUnavailable('Secreto del bridge no configurado');
};

const getSignatureTtlSeconds = () => {
  const parsed = Number.parseInt(process.env.BRIDGE_SIGNATURE_TTL_SECONDS || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SIGNATURE_TTL_SECONDS;
};

const hashBody = (body) => crypto
  .createHash('sha256')
  .update(body == null ? '' : JSON.stringify(body))
  .digest('hex');

const buildSignaturePayload = ({ method, path, timestamp, nonce, body }) => [
  String(method || '').toUpperCase(),
  String(path || ''),
  String(timestamp || ''),
  String(nonce || ''),
  hashBody(body)
].join('\n');

const buildExpectedSignature = ({ method, path, timestamp, nonce, body }) => crypto
  .createHmac('sha256', getBridgeSecret())
  .update(buildSignaturePayload({
    method,
    path,
    timestamp,
    nonce,
    body
  }))
  .digest('hex');

const assertValidSignature = (req) => {
  const bridgeId = String(req.headers['x-bridge-id'] || '').trim();
  const timestamp = String(req.headers['x-bridge-ts'] || '').trim();
  const nonce = String(req.headers['x-bridge-nonce'] || '').trim();
  const signature = String(req.headers['x-bridge-signature'] || '').trim();

  if (!bridgeId || !timestamp || !nonce || !signature) {
    throw createHttpError.unauthorized('Firma de bridge invalida');
  }

  const ts = Number.parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > getSignatureTtlSeconds()) {
    throw createHttpError.unauthorized('Firma de bridge expirada');
  }

  const expected = buildExpectedSignature({
    method: req.method,
    path: req.originalUrl.split('?')[0],
    timestamp,
    nonce,
    body: req.body
  });

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) {
      throw createHttpError.unauthorized('Firma de bridge invalida');
    }
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError.unauthorized('Firma de bridge invalida');
  }

  if (req.body?.bridgeId && String(req.body.bridgeId) !== bridgeId) {
    throw createHttpError.unauthorized('Firma de bridge invalida');
  }

  return {
    bridgeId,
    nonce,
    timestamp
  };
};

const rememberNonce = async (prisma, bridgeId, nonce) => {
  await prisma.bridgeRequestNonce.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  }).catch(() => {});

  try {
    await prisma.bridgeRequestNonce.create({
      data: {
        bridgeId,
        nonce,
        expiresAt: new Date(Date.now() + (getSignatureTtlSeconds() * 1000))
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw createHttpError.unauthorized('Nonce de bridge repetido');
    }

    throw error;
  }
};

const validateBridgeRequest = async (prisma, req) => {
  assertIpAllowed(req);
  const signatureData = assertValidSignature(req);
  await rememberNonce(prisma, signatureData.bridgeId, signatureData.nonce);
  return signatureData;
};

module.exports = {
  buildExpectedSignature,
  buildSignaturePayload,
  getRequestSourceIp,
  validateBridgeRequest
};
