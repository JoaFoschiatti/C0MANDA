const bcrypt = require('bcryptjs');
const { getPrisma } = require('../utils/get-prisma');
const { createHttpError } = require('../utils/http-error');
const { normalizeEmail } = require('../utils/email');
const {
  clearAuthCookie,
  issueAuthSession
} = require('../services/auth-session.service');
const { clearBindingCookie } = require('../services/mercadopago-oauth-state.service');
const {
  MFA_STAGE_SETUP_REQUIRED,
  MFA_STAGE_VERIFY_REQUIRED,
  TRUSTED_DEVICE_COOKIE,
  buildMfaSetupPayload,
  clearMfaPreAuthCookie,
  confirmMfaSetup,
  consumeRecoveryCode,
  createTrustedDevice,
  hasEnabledMfa,
  requireMfaPreAuth,
  requiresMfaForRole,
  setMfaPreAuthCookie,
  setTrustedDeviceCookie,
  validateTrustedDevice,
  verifyMfaCode
} = require('../services/mfa.service');

const LOGIN_USER_SELECT = {
  id: true,
  email: true,
  password: true,
  nombre: true,
  rol: true,
  activo: true,
  sessionVersion: true
};

const AUTHENTICATED_USER_SELECT = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  sessionVersion: true
};

const sanitizeUsuario = (usuario) => ({
  id: usuario.id,
  email: usuario.email,
  nombre: usuario.nombre,
  rol: usuario.rol
});

const getChallengeUser = async (prisma, challenge) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: challenge.id },
    select: AUTHENTICATED_USER_SELECT
  });

  if (!usuario || !usuario.activo) {
    throw createHttpError.unauthorized('Desafio MFA invalido o expirado');
  }

  if ((usuario.sessionVersion ?? 0) !== (challenge.sv ?? 0)) {
    throw createHttpError.unauthorized('Desafio MFA invalido o expirado');
  }

  return usuario;
};

const maybeRememberTrustedDevice = async (prisma, res, req, usuario, trustDevice) => {
  if (!trustDevice) {
    return;
  }

  const deviceToken = await createTrustedDevice(prisma, usuario, req.headers['user-agent']);
  setTrustedDeviceCookie(res, deviceToken);
};

const login = async (req, res) => {
  const prisma = getPrisma(req);
  const email = normalizeEmail(req.body.email);

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: LOGIN_USER_SELECT
  });

  if (!usuario || !usuario.activo) {
    throw createHttpError.unauthorized('Credenciales invalidas');
  }

  const passwordValido = await bcrypt.compare(req.body.password, usuario.password);
  if (!passwordValido) {
    throw createHttpError.unauthorized('Credenciales invalidas');
  }

  clearMfaPreAuthCookie(res);

  if (!requiresMfaForRole(usuario.rol)) {
    const body = await issueAuthSession(res, usuario);
    return res.status(200).json(body);
  }

  const mfaEnabled = await hasEnabledMfa(prisma, usuario.id);

  if (mfaEnabled) {
    const trustedDeviceToken = req.cookies?.[TRUSTED_DEVICE_COOKIE] || null;
    const trustedDeviceValido = trustedDeviceToken
      ? await validateTrustedDevice(prisma, usuario, trustedDeviceToken)
      : false;

    if (trustedDeviceValido) {
      const body = await issueAuthSession(res, usuario);
      return res.status(200).json(body);
    }
  }

  clearAuthCookie(res);
  setMfaPreAuthCookie(
    res,
    usuario,
    mfaEnabled ? MFA_STAGE_VERIFY_REQUIRED : MFA_STAGE_SETUP_REQUIRED
  );

  return res.status(202).json({
    next: mfaEnabled ? 'MFA_VERIFY_REQUIRED' : 'MFA_SETUP_REQUIRED',
    usuario: sanitizeUsuario(usuario)
  });
};

const logout = async (_req, res) => {
  clearAuthCookie(res);
  clearMfaPreAuthCookie(res);
  clearBindingCookie(res);

  return res.json({ message: 'Sesion cerrada correctamente' });
};

const registrar = async (req, res) => {
  const prisma = getPrisma(req);
  const email = normalizeEmail(req.body.email);

  const existingUser = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existingUser) {
    throw createHttpError.badRequest('El email ya esta registrado');
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      email,
      password: passwordHash,
      nombre: req.body.nombre,
      rol: req.body.rol || 'MOZO'
    },
    select: AUTHENTICATED_USER_SELECT
  });

  return res.status(201).json({ usuario: sanitizeUsuario(usuario) });
};

const perfil = async (req, res) => {
  return res.json({ usuario: sanitizeUsuario(req.usuario) });
};

const cambiarPassword = async (req, res) => {
  const prisma = getPrisma(req);
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: LOGIN_USER_SELECT
  });

  if (!usuario || !usuario.activo) {
    throw createHttpError.unauthorized('Usuario no valido o inactivo');
  }

  const passwordValido = await bcrypt.compare(req.body.passwordActual, usuario.password);
  if (!passwordValido) {
    throw createHttpError.badRequest('La password actual es incorrecta');
  }

  const newPasswordHash = await bcrypt.hash(req.body.passwordNuevo, 10);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      password: newPasswordHash,
      sessionVersion: { increment: 1 }
    }
  });

  clearAuthCookie(res);
  clearMfaPreAuthCookie(res);
  clearBindingCookie(res);

  return res.json({
    message: 'Password actualizada correctamente. Inicia sesion nuevamente.'
  });
};

const getMfaSetup = async (req, res) => {
  const prisma = getPrisma(req);
  const challenge = requireMfaPreAuth(req, [MFA_STAGE_SETUP_REQUIRED]);
  const usuario = await getChallengeUser(prisma, challenge);
  const setup = await buildMfaSetupPayload(prisma, usuario);

  return res.json(setup);
};

const confirmMfaSetupHandler = async (req, res) => {
  const prisma = getPrisma(req);
  const challenge = requireMfaPreAuth(req, [MFA_STAGE_SETUP_REQUIRED]);
  const usuario = await getChallengeUser(prisma, challenge);
  const recoveryCodes = await confirmMfaSetup(prisma, usuario, req.body.code);

  clearMfaPreAuthCookie(res);
  await maybeRememberTrustedDevice(prisma, res, req, usuario, req.body.trustDevice);

  const session = await issueAuthSession(res, usuario);
  return res.json({
    ...session,
    recoveryCodes
  });
};

const verifyMfa = async (req, res) => {
  const prisma = getPrisma(req);
  const challenge = requireMfaPreAuth(req, [MFA_STAGE_VERIFY_REQUIRED]);
  const usuario = await getChallengeUser(prisma, challenge);

  await verifyMfaCode(prisma, usuario, req.body.code);

  clearMfaPreAuthCookie(res);
  await maybeRememberTrustedDevice(prisma, res, req, usuario, req.body.trustDevice);

  const session = await issueAuthSession(res, usuario);
  return res.json(session);
};

const recoverWithMfa = async (req, res) => {
  const prisma = getPrisma(req);
  const challenge = requireMfaPreAuth(req, [MFA_STAGE_VERIFY_REQUIRED]);
  const usuario = await getChallengeUser(prisma, challenge);

  await consumeRecoveryCode(prisma, usuario, req.body.recoveryCode);

  clearMfaPreAuthCookie(res);
  await maybeRememberTrustedDevice(prisma, res, req, usuario, req.body.trustDevice);

  const session = await issueAuthSession(res, usuario);
  return res.json(session);
};

module.exports = {
  login,
  logout,
  registrar,
  perfil,
  cambiarPassword,
  getMfaSetup,
  confirmMfaSetup: confirmMfaSetupHandler,
  verifyMfa,
  recoverWithMfa
};
