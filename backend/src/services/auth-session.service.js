const jwt = require('jsonwebtoken');
const { getNegocio } = require('../db/prisma');

const AUTH_COOKIE_NAME = 'token';

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-secret';
  }

  throw new Error('JWT_SECRET no esta configurado');
};

const buildNegocioPayload = (negocio) => {
  if (!negocio) {
    return null;
  }

  return {
    id: negocio.id,
    nombre: negocio.nombre,
    email: negocio.email,
    telefono: negocio.telefono,
    direccion: negocio.direccion,
    logo: negocio.logo,
    bannerUrl: negocio.bannerUrl,
    colorPrimario: negocio.colorPrimario,
    colorSecundario: negocio.colorSecundario
  };
};

const buildSessionPayload = (usuario) => ({
  id: usuario.id,
  email: usuario.email,
  rol: usuario.rol,
  sv: usuario.sessionVersion ?? 0
});

const buildAuthCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
});

const issueAuthCookie = (res, usuario) => {
  const token = jwt.sign(
    buildSessionPayload(usuario),
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
  return token;
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, buildAuthCookieOptions());
};

const buildAuthResponseBody = async (usuario) => {
  const negocio = await getNegocio();

  return {
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    },
    negocio: buildNegocioPayload(negocio)
  };
};

const issueAuthSession = async (res, usuario) => {
  issueAuthCookie(res, usuario);
  return buildAuthResponseBody(usuario);
};

module.exports = {
  AUTH_COOKIE_NAME,
  buildAuthResponseBody,
  buildAuthCookieOptions,
  buildNegocioPayload,
  buildSessionPayload,
  clearAuthCookie,
  getJwtSecret,
  issueAuthCookie,
  issueAuthSession
};
