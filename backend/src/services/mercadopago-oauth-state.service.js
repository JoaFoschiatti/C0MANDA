const crypto = require('crypto');
const { parseDurationMs } = require('../utils/duration');
const { createHttpError } = require('../utils/http-error');

const MERCADOPAGO_OAUTH_BINDING_COOKIE = 'mp_oauth_binding';
const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const getStateTtlMs = () => parseDurationMs(process.env.MERCADOPAGO_OAUTH_STATE_TTL, DEFAULT_STATE_TTL_MS);

const buildBindingCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/mercadopago/oauth',
  maxAge: getStateTtlMs()
});

const setBindingCookie = (res, token) => {
  res.cookie(MERCADOPAGO_OAUTH_BINDING_COOKIE, token, buildBindingCookieOptions());
};

const clearBindingCookie = (res) => {
  res.clearCookie(MERCADOPAGO_OAUTH_BINDING_COOKIE, buildBindingCookieOptions());
};

const createOAuthState = async (prisma, usuario) => {
  if (!usuario?.id) {
    throw createHttpError.unauthorized('Usuario invalido para OAuth');
  }

  const stateId = crypto.randomBytes(32).toString('base64url');
  const browserBindingToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + getStateTtlMs());

  await prisma.mercadoPagoOAuthState.create({
    data: {
      id: stateId,
      usuarioId: usuario.id,
      sessionVersion: usuario.sessionVersion ?? 0,
      browserBindingHash: hashValue(browserBindingToken),
      expiresAt
    }
  });

  prisma.mercadoPagoOAuthState.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  }).catch(() => {});

  return {
    state: stateId,
    browserBindingToken,
    expiresAt
  };
};

const consumeOAuthState = async (prisma, state, browserBindingToken) => prisma.$transaction(async (tx) => {
  if (!state || !browserBindingToken) {
    throw createHttpError.unauthorized('Estado OAuth invalido');
  }

  const record = await tx.mercadoPagoOAuthState.findUnique({
    where: { id: state },
    include: {
      usuario: {
        select: {
          id: true,
          rol: true,
          activo: true,
          sessionVersion: true
        }
      }
    }
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw createHttpError.unauthorized('Estado OAuth invalido');
  }

  if (!record.usuario?.activo || record.usuario.rol !== 'ADMIN') {
    throw createHttpError.unauthorized('Estado OAuth invalido');
  }

  if ((record.usuario.sessionVersion ?? 0) !== (record.sessionVersion ?? 0)) {
    throw createHttpError.unauthorized('Estado OAuth invalido');
  }

  if (record.browserBindingHash !== hashValue(browserBindingToken)) {
    throw createHttpError.unauthorized('Estado OAuth invalido');
  }

  const updated = await tx.mercadoPagoOAuthState.updateMany({
    where: {
      id: record.id,
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  });

  if (updated.count !== 1) {
    throw createHttpError.unauthorized('Estado OAuth invalido');
  }

  return record;
});

module.exports = {
  MERCADOPAGO_OAUTH_BINDING_COOKIE,
  clearBindingCookie,
  consumeOAuthState,
  createOAuthState,
  setBindingCookie
};
