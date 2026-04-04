const mercadoPagoConfigService = require('../services/mercadopago-config.service');
const { getPrisma } = require('../utils/get-prisma');
const {
  clearBindingCookie,
  consumeOAuthState,
  createOAuthState,
  MERCADOPAGO_OAUTH_BINDING_COOKIE,
  setBindingCookie
} = require('../services/mercadopago-oauth-state.service');
const { logger } = require('../utils/logger');

const iniciarOAuth = async (req, res) => {
  const prisma = getPrisma(req);
  const oauthState = await createOAuthState(prisma, req.usuario);
  setBindingCookie(res, oauthState.browserBindingToken);
  const authUrl = mercadoPagoConfigService.buildOAuthAuthorizationUrl(oauthState.state);
  res.json({ authUrl });
};

const callbackOAuth = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const prisma = getPrisma(req);

    if (oauthError) {
      logger.error('Error en OAuth de MercadoPago:', oauthError);
      clearBindingCookie(res);
      return res.redirect(`${frontendUrl}/configuracion?mp=error&reason=${oauthError}`);
    }

    if (!code || !state) {
      clearBindingCookie(res);
      return res.redirect(`${frontendUrl}/configuracion?mp=error&reason=missing_params`);
    }

    const browserBindingToken = req.cookies?.[MERCADOPAGO_OAUTH_BINDING_COOKIE] || null;

    try {
      await consumeOAuthState(prisma, String(state), browserBindingToken);
    } catch {
      clearBindingCookie(res);
      return res.redirect(`${frontendUrl}/configuracion?mp=error&reason=invalid_state`);
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_APP_ID,
        client_secret: process.env.MP_APP_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${backendUrl}/api/mercadopago/oauth/callback`
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error) {
      logger.error('Error al obtener tokens de MP:', tokenData);
      return res.redirect(`${frontendUrl}/configuracion?mp=error&reason=token_exchange_failed`);
    }

    let userEmail = null;
    try {
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userResponse.json();
      userEmail = userData.email;
    } catch (error) {
      logger.warn('No se pudo obtener email del usuario MP:', error);
    }

    await mercadoPagoConfigService.guardarOAuthConfig(tokenData, userEmail);
    clearBindingCookie(res);
    return res.redirect(`${frontendUrl}/configuracion?mp=connected`);
  } catch (error) {
    logger.error('Error en callback de OAuth:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    clearBindingCookie(res);
    return res.redirect(`${frontendUrl}/configuracion?mp=error&reason=server_error`);
  }
};

const desconectarOAuth = async (_req, res) => {
  await mercadoPagoConfigService.desconectar();
  res.json({ message: 'MercadoPago desconectado correctamente' });
};

const obtenerEstado = async (_req, res) => {
  res.json(await mercadoPagoConfigService.obtenerEstado());
};

const configurarManual = async (req, res) => {
  const { accessToken, publicKey } = req.body;
  res.json(await mercadoPagoConfigService.configurarManual({ accessToken, publicKey }));
};

const listarTransacciones = async (req, res) => {
  const { page, limit, desde, hasta, status } = req.query;
  res.json(await mercadoPagoConfigService.listarTransacciones({ page, limit, desde, hasta, status }));
};

module.exports = {
  iniciarOAuth,
  callbackOAuth,
  desconectarOAuth,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
