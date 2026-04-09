const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { ensureBaseSucursales } = require('../../services/sucursales.service');
const { loadTestEnv } = require('./load-test-env');

module.exports = async function globalSetup() {
  loadTestEnv();

  const prisma = new PrismaClient();

  try {
    // Ensure singleton negocio exists
    await prisma.negocio.upsert({
      where: { id: 1 },
      update: { nombre: 'Comanda Test', email: 'tests@comanda.local' },
      create: { id: 1, nombre: 'Comanda Test', email: 'tests@comanda.local' }
    });

    const adminPasswordHash = await bcrypt.hash('admin123', 4);
    await prisma.usuario.upsert({
      where: { email: 'admin@comanda.local' },
      update: {
        password: adminPasswordHash,
        nombre: 'Admin Test',
        rol: 'ADMIN',
        activo: true
      },
      create: {
        email: 'admin@comanda.local',
        password: adminPasswordHash,
        nombre: 'Admin Test',
        rol: 'ADMIN',
        activo: true
      }
    });

    // Full cleanup in FK-respecting order
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
      where: { email: { not: 'admin@comanda.local' } }
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
  } finally {
    await prisma.$disconnect();
  }
};
