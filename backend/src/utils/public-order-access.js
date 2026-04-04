const jwt = require('jsonwebtoken');
const { parseDurationMs } = require('./duration');

const PUBLIC_ORDER_SCOPE = 'public-order';
const DEFAULT_PUBLIC_ORDER_TOKEN_EXPIRES_IN = '2h';
const DEFAULT_PUBLIC_ORDER_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const PUBLIC_ORDER_COOKIE_NAME = 'public_order_access';

const getPublicOrderSecret = () => {
  if (process.env.PUBLIC_ORDER_JWT_SECRET) {
    return process.env.PUBLIC_ORDER_JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-public-order-secret';
  }

  throw new Error('PUBLIC_ORDER_JWT_SECRET no esta configurado');
};

const getPublicOrderTokenExpiresIn = () => process.env.PUBLIC_ORDER_TOKEN_EXPIRES_IN || DEFAULT_PUBLIC_ORDER_TOKEN_EXPIRES_IN;

const buildPublicOrderCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/publico',
  maxAge: parseDurationMs(getPublicOrderTokenExpiresIn(), DEFAULT_PUBLIC_ORDER_TOKEN_MAX_AGE_MS)
});

const signPublicOrderToken = (pedidoId) => jwt.sign(
  {
    scope: PUBLIC_ORDER_SCOPE,
    pedidoId: Number(pedidoId)
  },
  getPublicOrderSecret(),
  {
    expiresIn: getPublicOrderTokenExpiresIn()
  }
);

const matchesPublicOrderToken = (token, pedidoId) => {
  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, getPublicOrderSecret());
    return decoded?.scope === PUBLIC_ORDER_SCOPE && Number(decoded?.pedidoId) === Number(pedidoId);
  } catch {
    return false;
  }
};

const setPublicOrderCookie = (res, pedidoId) => {
  res.cookie(
    PUBLIC_ORDER_COOKIE_NAME,
    signPublicOrderToken(pedidoId),
    buildPublicOrderCookieOptions()
  );
};

const clearPublicOrderCookie = (res) => {
  res.clearCookie(PUBLIC_ORDER_COOKIE_NAME, buildPublicOrderCookieOptions());
};

const readPublicOrderTokenFromRequest = (req) => req.cookies?.[PUBLIC_ORDER_COOKIE_NAME] || null;

module.exports = {
  PUBLIC_ORDER_COOKIE_NAME,
  buildPublicOrderCookieOptions,
  clearPublicOrderCookie,
  readPublicOrderTokenFromRequest,
  signPublicOrderToken,
  matchesPublicOrderToken,
  setPublicOrderCookie
};
