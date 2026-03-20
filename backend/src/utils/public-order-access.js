const jwt = require('jsonwebtoken');

const PUBLIC_ORDER_SCOPE = 'public-order';
const DEFAULT_PUBLIC_ORDER_SECRET = 'development-public-order-secret-change-me';
const DEFAULT_PUBLIC_ORDER_TOKEN_EXPIRES_IN = '30d';

const getPublicOrderSecret = () => process.env.JWT_SECRET || DEFAULT_PUBLIC_ORDER_SECRET;

const signPublicOrderToken = (pedidoId) => jwt.sign(
  {
    scope: PUBLIC_ORDER_SCOPE,
    pedidoId: Number(pedidoId)
  },
  getPublicOrderSecret(),
  {
    expiresIn: process.env.PUBLIC_ORDER_TOKEN_EXPIRES_IN || DEFAULT_PUBLIC_ORDER_TOKEN_EXPIRES_IN
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

module.exports = {
  signPublicOrderToken,
  matchesPublicOrderToken
};
