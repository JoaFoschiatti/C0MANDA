const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('./crypto.service');
const { createHttpError } = require('../utils/http-error');
const { encodeBase32, decodeBase32 } = require('../utils/base32');
const { parseDurationMs } = require('../utils/duration');

const MFA_PREAUTH_COOKIE = 'mfa_preauth';
const TRUSTED_DEVICE_COOKIE = 'trusted_device';
const MFA_PREAUTH_SCOPE = 'mfa-preauth';
const MFA_STAGE_SETUP_REQUIRED = 'setup_required';
const MFA_STAGE_VERIFY_REQUIRED = 'verify_required';
const MFA_PREAUTH_TTL_MS = 10 * 60 * 1000;
const TRUSTED_DEVICE_FALLBACK_MS = 30 * 24 * 60 * 60 * 1000;
const TOTP_STEP_MS = 30 * 1000;
const TOTP_WINDOW_STEPS = 1;
const MFA_REQUIRED_ROLES = new Set([]);
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_COUNT = 8;

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-secret';
  }

  throw new Error('JWT_SECRET no esta configurado');
};

const getMfaIssuer = () => process.env.MFA_ISSUER || 'Comanda';

const getTrustedDeviceMaxAgeMs = () => parseDurationMs(
  process.env.MFA_TRUSTED_DEVICE_DAYS
    ? `${process.env.MFA_TRUSTED_DEVICE_DAYS}d`
    : undefined,
  TRUSTED_DEVICE_FALLBACK_MS
);

const buildCookieOptions = (maxAge, overrides = {}) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge,
  ...overrides
});

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const normalizeCode = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();

const normalizeTotpCode = (value) => normalizeCode(value).replace(/\D/g, '');

const requiresMfaForRole = (role) => MFA_REQUIRED_ROLES.has(role);

const setMfaPreAuthCookie = (res, usuario, stage) => {
  const token = jwt.sign(
    {
      scope: MFA_PREAUTH_SCOPE,
      id: usuario.id,
      sv: usuario.sessionVersion ?? 0,
      stage
    },
    getJwtSecret(),
    { expiresIn: Math.floor(MFA_PREAUTH_TTL_MS / 1000) }
  );

  res.cookie(MFA_PREAUTH_COOKIE, token, buildCookieOptions(MFA_PREAUTH_TTL_MS));
};

const clearMfaPreAuthCookie = (res) => {
  res.clearCookie(MFA_PREAUTH_COOKIE, buildCookieOptions(MFA_PREAUTH_TTL_MS));
};

const readMfaPreAuthToken = (req) => req.cookies?.[MFA_PREAUTH_COOKIE] || null;

const verifyMfaPreAuthToken = (token) => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded?.scope !== MFA_PREAUTH_SCOPE) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};

const requireMfaPreAuth = (req, allowedStages = []) => {
  const token = readMfaPreAuthToken(req);
  const decoded = verifyMfaPreAuthToken(token);

  if (!decoded) {
    throw createHttpError.unauthorized('Desafio MFA invalido o expirado');
  }

  if (allowedStages.length > 0 && !allowedStages.includes(decoded.stage)) {
    throw createHttpError.unauthorized('Desafio MFA invalido o expirado');
  }

  return decoded;
};

const generateTotpSecret = (size = 20) => encodeBase32(crypto.randomBytes(size));

const formatManualEntryKey = (secret) => String(secret || '').match(/.{1,4}/g)?.join(' ') || '';

const buildOtpAuthUrl = ({ issuer, accountName, secret }) => {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};

const computeTotp = (secret, timestamp = Date.now()) => {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestamp / TOTP_STEP_MS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3]
  ) % 1000000;

  return String(code).padStart(6, '0');
};

const verifyTotp = (secret, code, timestamp = Date.now()) => {
  const normalized = normalizeTotpCode(code);
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  for (let step = -TOTP_WINDOW_STEPS; step <= TOTP_WINDOW_STEPS; step += 1) {
    if (computeTotp(secret, timestamp + (step * TOTP_STEP_MS)) === normalized) {
      return true;
    }
  }

  return false;
};

const randomAlphabetString = (length) => {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map((byte) => RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length]).join('');
};

const generateRecoveryCodes = (count = RECOVERY_CODE_COUNT) => Array.from({ length: count }, () => {
  const raw = randomAlphabetString(8);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
});

const getOrCreateUsuarioMfa = async (prisma, usuarioId) => {
  const existing = await prisma.usuarioMfa.findUnique({
    where: { usuarioId },
    include: {
      recoveryCodes: true,
      trustedDevices: true
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.usuarioMfa.create({
    data: { usuarioId },
    include: {
      recoveryCodes: true,
      trustedDevices: true
    }
  });
};

const buildMfaSetupPayload = async (prisma, usuario) => {
  const existing = await prisma.usuarioMfa.findUnique({
    where: { usuarioId: usuario.id }
  });

  const stillValidPending = existing?.pendingSecret && existing?.pendingSecretExpiry && existing.pendingSecretExpiry > new Date();
  const secret = stillValidPending
    ? decrypt(existing.pendingSecret)
    : generateTotpSecret();

  await prisma.usuarioMfa.upsert({
    where: { usuarioId: usuario.id },
    update: {
      pendingSecret: encrypt(secret),
      pendingSecretExpiry: new Date(Date.now() + MFA_PREAUTH_TTL_MS)
    },
    create: {
      usuarioId: usuario.id,
      pendingSecret: encrypt(secret),
      pendingSecretExpiry: new Date(Date.now() + MFA_PREAUTH_TTL_MS)
    }
  });

  const issuer = getMfaIssuer();
  const accountName = usuario.email;

  return {
    issuer,
    accountName,
    secret,
    manualEntryKey: formatManualEntryKey(secret),
    otpauthUrl: buildOtpAuthUrl({ issuer, accountName, secret })
  };
};

const ensurePendingSetupSecret = async (prisma, usuarioId) => {
  const mfa = await prisma.usuarioMfa.findUnique({
    where: { usuarioId }
  });

  if (!mfa?.pendingSecret || !mfa.pendingSecretExpiry || mfa.pendingSecretExpiry <= new Date()) {
    throw createHttpError.unauthorized('El enrolamiento MFA expiro. Vuelve a iniciar sesion.');
  }

  return {
    mfa,
    secret: decrypt(mfa.pendingSecret)
  };
};

const confirmMfaSetup = async (prisma, usuario, code) => {
  const { mfa, secret } = await ensurePendingSetupSecret(prisma, usuario.id);

  if (!verifyTotp(secret, code)) {
    throw createHttpError.unauthorized('Codigo de verificacion invalido');
  }

  const recoveryCodes = generateRecoveryCodes();

  await prisma.$transaction(async (tx) => {
    await tx.usuarioMfa.update({
      where: { id: mfa.id },
      data: {
        secretEncrypted: encrypt(secret),
        pendingSecret: null,
        pendingSecretExpiry: null,
        enabledAt: new Date()
      }
    });

    await tx.usuarioMfaRecoveryCode.deleteMany({
      where: { usuarioMfaId: mfa.id }
    });

    await tx.usuarioMfaRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        usuarioMfaId: mfa.id,
        codeHash: hashValue(recoveryCode)
      }))
    });
  });

  return recoveryCodes;
};

const getEnabledSecretForUser = async (prisma, usuarioId) => {
  const mfa = await prisma.usuarioMfa.findUnique({
    where: { usuarioId }
  });

  if (!mfa?.secretEncrypted || !mfa.enabledAt) {
    return null;
  }

  return {
    record: mfa,
    secret: decrypt(mfa.secretEncrypted)
  };
};

const verifyMfaCode = async (prisma, usuario, code) => {
  const mfa = await getEnabledSecretForUser(prisma, usuario.id);
  if (!mfa) {
    throw createHttpError.unauthorized('La cuenta no tiene MFA configurado');
  }

  if (!verifyTotp(mfa.secret, code)) {
    throw createHttpError.unauthorized('Codigo de verificacion invalido');
  }

  return mfa.record;
};

const consumeRecoveryCode = async (prisma, usuario, recoveryCode) => {
  const mfa = await prisma.usuarioMfa.findUnique({
    where: { usuarioId: usuario.id },
    include: {
      recoveryCodes: {
        where: { usedAt: null }
      }
    }
  });

  if (!mfa?.enabledAt) {
    throw createHttpError.unauthorized('La cuenta no tiene MFA configurado');
  }

  const codeHash = hashValue(normalizeCode(recoveryCode));
  const matchingCode = mfa.recoveryCodes.find((item) => item.codeHash === codeHash);

  if (!matchingCode) {
    throw createHttpError.unauthorized('Codigo de recuperacion invalido');
  }

  await prisma.usuarioMfaRecoveryCode.update({
    where: { id: matchingCode.id },
    data: { usedAt: new Date() }
  });

  return mfa;
};

const buildTrustedDeviceCookieValue = (selector, validator) => `${selector}.${validator}`;

const parseTrustedDeviceCookieValue = (value) => {
  const [selector, validator] = String(value || '').split('.');
  if (!selector || !validator) {
    return null;
  }

  return { selector, validator };
};

const createTrustedDevice = async (prisma, usuario, userAgent = null) => {
  const mfa = await prisma.usuarioMfa.findUnique({
    where: { usuarioId: usuario.id }
  });

  if (!mfa?.enabledAt) {
    return null;
  }

  const selector = crypto.randomBytes(12).toString('hex');
  const validator = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + getTrustedDeviceMaxAgeMs());

  await prisma.usuarioTrustedDevice.create({
    data: {
      usuarioMfaId: mfa.id,
      selector,
      validatorHash: hashValue(validator),
      userAgent: userAgent ? String(userAgent).slice(0, 200) : null,
      expiresAt
    }
  });

  return {
    value: buildTrustedDeviceCookieValue(selector, validator),
    expiresAt
  };
};

const setTrustedDeviceCookie = (res, deviceToken) => {
  if (!deviceToken?.value) {
    return;
  }

  res.cookie(
    TRUSTED_DEVICE_COOKIE,
    deviceToken.value,
    buildCookieOptions(getTrustedDeviceMaxAgeMs())
  );
};

const clearTrustedDeviceCookie = (res) => {
  res.clearCookie(TRUSTED_DEVICE_COOKIE, buildCookieOptions(getTrustedDeviceMaxAgeMs()));
};

const validateTrustedDevice = async (prisma, usuario, rawToken) => {
  const parsed = parseTrustedDeviceCookieValue(rawToken);
  if (!parsed) {
    return false;
  }

  const device = await prisma.usuarioTrustedDevice.findUnique({
    where: { selector: parsed.selector },
    include: {
      usuarioMfa: true
    }
  });

  if (!device || device.usuarioMfa.usuarioId !== usuario.id) {
    return false;
  }

  if (device.expiresAt <= new Date()) {
    await prisma.usuarioTrustedDevice.delete({
      where: { id: device.id }
    }).catch(() => {});
    return false;
  }

  if (device.validatorHash !== hashValue(parsed.validator)) {
    return false;
  }

  await prisma.usuarioTrustedDevice.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});

  return true;
};

const hasEnabledMfa = async (prisma, usuarioId) => {
  const mfa = await prisma.usuarioMfa.findUnique({
    where: { usuarioId },
    select: { enabledAt: true }
  });

  return Boolean(mfa?.enabledAt);
};

const resetUserMfa = async (prisma, usuarioId) => prisma.$transaction(async (tx) => {
  const mfa = await tx.usuarioMfa.findUnique({
    where: { usuarioId }
  });

  if (mfa) {
    await tx.usuarioMfa.delete({
      where: { id: mfa.id }
    });
  }

  await tx.usuario.update({
    where: { id: usuarioId },
    data: {
      sessionVersion: { increment: 1 }
    }
  });
});

module.exports = {
  MFA_STAGE_SETUP_REQUIRED,
  MFA_STAGE_VERIFY_REQUIRED,
  MFA_PREAUTH_COOKIE,
  TRUSTED_DEVICE_COOKIE,
  buildMfaSetupPayload,
  clearMfaPreAuthCookie,
  clearTrustedDeviceCookie,
  confirmMfaSetup,
  consumeRecoveryCode,
  createTrustedDevice,
  getEnabledSecretForUser,
  hasEnabledMfa,
  requireMfaPreAuth,
  requiresMfaForRole,
  resetUserMfa,
  setMfaPreAuthCookie,
  setTrustedDeviceCookie,
  validateTrustedDevice,
  verifyMfaCode
};
