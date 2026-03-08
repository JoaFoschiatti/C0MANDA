const bcrypt = require('bcryptjs');
const {
  FIXTURES,
  createPrisma,
  writeTestData,
  cleanupE2EData,
  resetArtifacts
} = require('./support');

async function globalSetup() {
  const prisma = createPrisma();

  try {
    console.log('\n[E2E Setup] Preparando instalacion unica de pruebas...');

    await cleanupE2EData(prisma);
    resetArtifacts();

    await prisma.negocio.upsert({
      where: { id: 1 },
      update: {
        nombre: FIXTURES.negocioNombre,
        email: FIXTURES.negocioEmail
      },
      create: {
        id: 1,
        nombre: FIXTURES.negocioNombre,
        email: FIXTURES.negocioEmail
      }
    });

    const usuariosBase = [
      {
        key: 'admin',
        email: FIXTURES.adminEmail,
        password: FIXTURES.adminPassword,
        nombre: FIXTURES.adminNombre,
        rol: 'ADMIN'
      },
      {
        key: 'mozo',
        email: FIXTURES.mozoEmail,
        password: FIXTURES.mozoPassword,
        nombre: FIXTURES.mozoNombre,
        rol: 'MOZO'
      },
      {
        key: 'cocinero',
        email: FIXTURES.cocineroEmail,
        password: FIXTURES.cocineroPassword,
        nombre: FIXTURES.cocineroNombre,
        rol: 'COCINERO'
      },
      {
        key: 'cajero',
        email: FIXTURES.cajeroEmail,
        password: FIXTURES.cajeroPassword,
        nombre: FIXTURES.cajeroNombre,
        rol: 'CAJERO'
      },
      {
        key: 'delivery',
        email: FIXTURES.deliveryEmail,
        password: FIXTURES.deliveryPassword,
        nombre: FIXTURES.deliveryNombre,
        rol: 'DELIVERY'
      }
    ];

    const usuariosCreados = {};

    for (const usuarioBase of usuariosBase) {
      const passwordHash = await bcrypt.hash(usuarioBase.password, 10);
      const usuario = await prisma.usuario.create({
        data: {
          email: usuarioBase.email,
          password: passwordHash,
          nombre: usuarioBase.nombre,
          rol: usuarioBase.rol,
          activo: true
        }
      });

      usuariosCreados[usuarioBase.key] = {
        id: usuario.id,
        email: usuarioBase.email,
        password: usuarioBase.password,
        nombre: usuarioBase.nombre,
        rol: usuarioBase.rol
      };
    }

    const categoria = await prisma.categoria.create({
      data: {
        nombre: FIXTURES.baseCategoryName,
        descripcion: 'Categoria base para E2E',
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: FIXTURES.baseProductName,
        descripcion: 'Producto base para pruebas E2E',
        precio: 2500,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const mesa = await prisma.mesa.create({
      data: {
        numero: FIXTURES.baseMesaNumber,
        zona: 'Salon E2E',
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    writeTestData({
      userId: usuariosCreados.admin.id,
      userEmail: FIXTURES.adminEmail,
      userPassword: FIXTURES.adminPassword,
      userName: FIXTURES.adminNombre,
      roles: usuariosCreados,
      baseCategoryId: categoria.id,
      baseCategoryName: FIXTURES.baseCategoryName,
      createdCategoryName: FIXTURES.createdCategoryName,
      productId: producto.id,
      productName: FIXTURES.baseProductName,
      baseMesaId: mesa.id,
      baseMesaNumber: FIXTURES.baseMesaNumber,
      baseMesaQrToken: mesa.qrToken,
      extraMesaNumber: FIXTURES.extraMesaNumber,
      reservationClientName: FIXTURES.reservationClientName,
      orderClientName: FIXTURES.orderClientName,
      cierreObservaciones: FIXTURES.cierreObservaciones
    });

    console.log('[E2E Setup] Datos listos.\n');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = globalSetup;
