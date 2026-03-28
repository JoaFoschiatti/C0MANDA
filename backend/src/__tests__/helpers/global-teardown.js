const { PrismaClient } = require('@prisma/client');
const { loadTestEnv } = require('./load-test-env');

module.exports = async function globalTeardown() {
  loadTestEnv();

  const prisma = new PrismaClient();

  try {
    // Final cleanup in FK-respecting order
    await prisma.pedidoItemModificador.deleteMany();
    await prisma.productoModificador.deleteMany();
    await prisma.productoIngrediente.deleteMany();
    await prisma.transaccionMercadoPago.deleteMany();
    await prisma.comprobanteFiscal.deleteMany();
    await prisma.printJob.deleteMany();
    await prisma.movimientoStock.deleteMany();
    await prisma.pago.deleteMany();
    await prisma.pedidoAuditoria.deleteMany();
    await prisma.pedidoItem.deleteMany();
    await prisma.pedido.deleteMany();
    await prisma.reserva.deleteMany();
    await prisma.loteStock.deleteMany();
    await prisma.ingredienteStock.deleteMany();
    await prisma.cierreCaja.deleteMany();
    await prisma.fichaje.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.usuario.deleteMany({
      where: { email: { not: 'admin@comanda.local' } }
    });
    await prisma.producto.deleteMany();
    await prisma.categoria.deleteMany();
    await prisma.modificador.deleteMany();
    await prisma.ingrediente.deleteMany();
    await prisma.mesa.deleteMany();
    await prisma.configuracion.deleteMany();
    await prisma.mercadoPagoConfig.deleteMany();
    await prisma.clienteFiscal.deleteMany();
    await prisma.puntoVentaFiscal.deleteMany();
    await prisma.sucursal.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
};
