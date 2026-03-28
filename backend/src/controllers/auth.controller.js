const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, getNegocio } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');
const { normalizeEmail } = require('../utils/email');

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

const extractTokenFromRequest = (req) => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

const registrar = async (req, res) => {
  const { password, nombre, rol } = req.body;
  const email = normalizeEmail(req.body.email);

  const existente = await prisma.usuario.findUnique({
    where: { email }
  });

  if (existente) {
    throw createHttpError.badRequest('El email ya esta registrado');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      email,
      password: passwordHash,
      nombre,
      rol: rol || 'MOZO'
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      activo: true
    }
  });

  res.status(201).json(usuario);
};

const login = async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  const usuario = await prisma.usuario.findUnique({
    where: { email }
  });

  if (!usuario || !usuario.activo) {
    throw createHttpError.unauthorized('Credenciales invalidas');
  }

  const passwordValido = await bcrypt.compare(password, usuario.password);
  if (!passwordValido) {
    throw createHttpError.unauthorized('Credenciales invalidas');
  }

  const tokenPayload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    sv: usuario.sessionVersion ?? 0
  };

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

  const negocio = await getNegocio();

  res.json({
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    },
    negocio: buildNegocioPayload(negocio)
  });
};

const perfil = async (req, res) => {
  const negocio = await getNegocio();
  const { sessionVersion: _sessionVersion, ...usuario } = req.usuario;

  res.json({
    ...usuario,
    negocio: buildNegocioPayload(negocio)
  });
};

const cambiarPassword = async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body;

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) {
    throw createHttpError.unauthorized('Usuario no valido o inactivo');
  }

  const passwordValido = await bcrypt.compare(passwordActual, usuario.password);
  if (!passwordValido) {
    throw createHttpError.badRequest('Contrasena actual incorrecta');
  }

  const passwordHash = await bcrypt.hash(passwordNuevo, 10);

  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: {
      password: passwordHash,
      sessionVersion: { increment: 1 }
    }
  });

  res.json({ message: 'Contrasena actualizada correctamente' });
};

const logout = async (req, res) => {
  const token = extractTokenFromRequest(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await prisma.usuario.update({
        where: { id: decoded.id },
        data: {
          sessionVersion: { increment: 1 }
        }
      });
    } catch {
      // Si el token es invalido o ya expiro, igual limpiamos la cookie y devolvemos exito.
    }
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.json({ message: 'Sesion cerrada correctamente' });
};

module.exports = {
  registrar,
  login,
  logout,
  perfil,
  cambiarPassword
};
