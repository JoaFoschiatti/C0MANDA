const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { prisma } = require('../db/prisma');
const { decrypt, encrypt } = require('./crypto.service');
const { logger } = require('../utils/logger');
const { sanitizeForLogs } = require('../utils/log-redaction');

const refreshOAuthToken = async (config) => {
  if (!config?.refreshToken) {
    return null;
  }

  if (!process.env.MP_APP_ID || !process.env.MP_APP_SECRET) {
    logger.warn('MercadoPago OAuth no configurado para refresco de token');
    return null;
  }

  let refreshToken;
  try {
    refreshToken = decrypt(config.refreshToken);
  } catch (error) {
    logger.error('Error al desencriptar refresh token de MP:', sanitizeForLogs(error));
    return null;
  }

  const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_APP_ID,
      client_secret: process.env.MP_APP_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || tokenData.error) {
    logger.warn('Error al refrescar token de MP:', sanitizeForLogs(tokenData));
    return null;
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  await prisma.mercadoPagoConfig.update({
    where: { id: 1 },
    data: {
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : config.refreshToken,
      expiresAt,
      isActive: true,
      updatedAt: new Date()
    }
  });

  return tokenData.access_token;
};

async function getMercadoPagoConfigRecord() {
  return prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 }
  });
}

async function getMercadoPagoClient() {
  const config = await getMercadoPagoConfigRecord();

  if (!config || !config.isActive) {
    return null;
  }

  if (config.isOAuth && config.expiresAt && new Date() > config.expiresAt) {
    const refreshedToken = await refreshOAuthToken(config);
    if (!refreshedToken) {
      logger.warn('Token de MercadoPago expirado');
      return null;
    }
    return new MercadoPagoConfig({ accessToken: refreshedToken });
  }

  try {
    const accessToken = decrypt(config.accessToken);
    return new MercadoPagoConfig({ accessToken });
  } catch (error) {
    logger.error('Error al desencriptar token de MP:', sanitizeForLogs(error));
    return null;
  }
}

async function isMercadoPagoConfigured() {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 },
    select: { isActive: true, expiresAt: true, isOAuth: true }
  });

  if (!config || !config.isActive) {
    return false;
  }

  if (config.isOAuth && config.expiresAt && new Date() > config.expiresAt) {
    return false;
  }

  return true;
}

async function getMercadoPagoConfigInfo() {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 },
    select: {
      email: true,
      userId: true,
      isOAuth: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!config) {
    return null;
  }

  return {
    ...config,
    isExpired: Boolean(config.isOAuth && config.expiresAt && new Date() > config.expiresAt)
  };
}

async function createPreference(preferenceData) {
  const client = await getMercadoPagoClient();
  if (!client) {
    throw new Error('MercadoPago no esta configurado para este negocio');
  }

  const preference = new Preference(client);
  return preference.create({ body: preferenceData });
}

async function getPayment(paymentId) {
  const client = await getMercadoPagoClient();
  if (!client) {
    throw new Error('MercadoPago no esta configurado para este negocio');
  }

  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

async function searchPaymentByReference(externalReference) {
  const client = await getMercadoPagoClient();
  if (!client) {
    return null;
  }

  try {
    const payment = new Payment(client);
    const result = await payment.search({
      options: {
        criteria: 'desc',
        sort: 'date_created',
        external_reference: externalReference
      }
    });

    return result.results?.find((item) => item.status === 'approved') || null;
  } catch (error) {
    logger.error(`Error buscando pago por referencia ${externalReference}:`, sanitizeForLogs(error));
    return null;
  }
}

async function saveTransaction(paymentInfo, pagoId = null) {
  return prisma.transaccionMercadoPago.upsert({
    where: { mpPaymentId: paymentInfo.id.toString() },
    update: {
      status: paymentInfo.status,
      statusDetail: paymentInfo.status_detail,
      pagoId
    },
    create: {
      pagoId,
      mpPaymentId: paymentInfo.id.toString(),
      mpPreferenceId: paymentInfo.preference_id || null,
      status: paymentInfo.status,
      statusDetail: paymentInfo.status_detail,
      amount: paymentInfo.transaction_amount,
      currency: paymentInfo.currency_id || 'ARS',
      payerEmail: paymentInfo.payer?.email || null,
      paymentMethod: paymentInfo.payment_method_id || null,
      paymentTypeId: paymentInfo.payment_type_id || null,
      installments: paymentInfo.installments || null,
      fee: paymentInfo.fee_details?.reduce((sum, detail) => sum + detail.amount, 0) || null,
      netAmount: paymentInfo.transaction_details?.net_received_amount || null,
      externalReference: paymentInfo.external_reference || null,
      rawData: paymentInfo
    }
  });
}

async function getTransactionHistory(options = {}) {
  const {
    page = 1,
    limit = 20,
    desde = null,
    hasta = null,
    status = null
  } = options;

  const where = {};

  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) where.createdAt.lte = new Date(hasta);
  }

  if (status) {
    where.status = status;
  }

  const [transacciones, total] = await Promise.all([
    prisma.transaccionMercadoPago.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit, 10),
      include: {
        pago: {
          include: {
            pedido: {
              select: {
                id: true,
                clienteNombre: true,
                total: true,
                createdAt: true
              }
            }
          }
        }
      }
    }),
    prisma.transaccionMercadoPago.count({ where })
  ]);

  const totales = await prisma.transaccionMercadoPago.aggregate({
    where: { ...where, status: 'approved' },
    _sum: {
      amount: true,
      fee: true,
      netAmount: true
    },
    _count: true
  });

  return {
    transacciones,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit)
    },
    totales: {
      bruto: totales._sum.amount || 0,
      comisiones: totales._sum.fee || 0,
      neto: totales._sum.netAmount || 0,
      cantidadAprobadas: totales._count || 0
    }
  };
}

module.exports = {
  getMercadoPagoClient,
  isMercadoPagoConfigured,
  getMercadoPagoConfigInfo,
  createPreference,
  getPayment,
  searchPaymentByReference,
  saveTransaction,
  getTransactionHistory
};
