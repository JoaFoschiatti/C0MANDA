const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { loadTestEnv } = require('./load-test-env');
loadTestEnv();
const { prisma } = require('../../db/prisma');
const { normalizeEmail } = require('../../utils/email');
const { ensureBaseSucursales } = require('../../services/sucursales.service');

const uniqueId = (prefix = 'test') => {
  const worker = process.env.JEST_WORKER_ID || '0';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${worker}-${Date.now()}-${rand}`;
};

const ensureTestEnv = () => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';
  if (!process.env.PUBLIC_ORDER_JWT_SECRET) process.env.PUBLIC_ORDER_JWT_SECRET = 'test-public-order-secret';
  if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = '1h';
};

const ensureNegocio = async () => {
  await prisma.negocio.upsert({
    where: { id: 1 },
    update: {
      nombre: 'Comanda Test',
      email: 'tests@comanda.local'
    },
    create: {
      id: 1,
      nombre: 'Comanda Test',
      email: 'tests@comanda.local'
    }
  });

  await ensureBaseSucursales(prisma);
};

const createUsuario = async (overrides = {}) => {
  ensureTestEnv();
  await ensureNegocio();

  const email = normalizeEmail(overrides.email || `${uniqueId('user')}@example.com`);
  const passwordPlano = overrides.passwordPlano || 'password';
  const passwordHash = await bcrypt.hash(passwordPlano, 4);

  return prisma.usuario.create({
    data: {
      email,
      password: passwordHash,
      nombre: overrides.nombre || 'Usuario Test',
      apellido: overrides.apellido || null,
      rol: overrides.rol || 'ADMIN',
      activo: overrides.activo ?? true,
      dni: overrides.dni || null,
      tarifaHora: overrides.tarifaHora || null
    }
  });
};

const signTokenForUser = (usuario, overrides = {}) => {
  ensureTestEnv();

  const payload = {
    id: usuario.id,
    sv: usuario.sessionVersion ?? 0,
    ...(overrides.payload || {})
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: overrides.expiresIn || process.env.JWT_EXPIRES_IN || '1h'
  });
};

const authHeader = (token) => `Bearer ${token}`;

const cleanupOperationalData = async () => {
  await ensureNegocio();

  await prisma.pedidoItemModificador.deleteMany();
  await prisma.productoModificador.deleteMany();
  await prisma.productoIngrediente.deleteMany();
  await prisma.transaccionMercadoPago.deleteMany();
  await prisma.comprobanteFiscal.deleteMany();
  await prisma.printJob.deleteMany();
  await prisma.bridgeRequestNonce.deleteMany();
  await prisma.idempotentRequest.deleteMany();
  await prisma.movimientoStock.deleteMany();
  await prisma.reembolso.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.pedidoAuditoria.deleteMany();
  await prisma.pedidoItem.deleteMany();
  await prisma.pedidoRonda.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.loteStock.deleteMany();
  await prisma.ingredienteStock.deleteMany();
  await prisma.cierreCaja.deleteMany();
  await prisma.fichaje.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.mercadoPagoOAuthState.deleteMany();
  await prisma.usuarioTrustedDevice.deleteMany();
  await prisma.usuarioMfaRecoveryCode.deleteMany();
  await prisma.usuarioMfa.deleteMany();
  await prisma.operationalEvent.deleteMany();
  await prisma.usuario.deleteMany({
    where: {
      email: {
        not: 'admin@comanda.local'
      }
    }
  });
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.modificador.deleteMany();
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "movimientos_stock" RESTART IDENTITY CASCADE');
  await prisma.movimientoStock.deleteMany();
  await prisma.ingrediente.deleteMany();
  await prisma.mesa.deleteMany();
  await prisma.configuracion.deleteMany();
  await prisma.mercadoPagoConfig.deleteMany();
  await prisma.clienteFiscal.deleteMany();
  await prisma.puntoVentaFiscal.deleteMany();

  await ensureBaseSucursales(prisma);
};

module.exports = {
  prisma,
  uniqueId,
  ensureTestEnv,
  ensureNegocio,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData
};
