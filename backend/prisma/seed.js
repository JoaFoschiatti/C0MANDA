require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertConfig(clave, valor) {
  return prisma.configuracion.upsert({
    where: { clave },
    update: { valor: String(valor) },
    create: { clave, valor: String(valor) }
  });
}

async function main() {
  const negocioNombre = process.env.SEED_NEGOCIO_NOMBRE || 'Comanda Demo';
  const negocioEmail = process.env.SEED_NEGOCIO_EMAIL || 'admin@comanda.local';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@comanda.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';

  await prisma.negocio.upsert({
    where: { id: 1 },
    update: {
      nombre: negocioNombre,
      email: negocioEmail,
      telefono: process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
      direccion: process.env.SEED_NEGOCIO_DIRECCION || 'Av. Principal 123',
      colorPrimario: '#3B82F6',
      colorSecundario: '#1E40AF'
    },
    create: {
      id: 1,
      nombre: negocioNombre,
      email: negocioEmail,
      telefono: process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
      direccion: process.env.SEED_NEGOCIO_DIRECCION || 'Av. Principal 123',
      colorPrimario: '#3B82F6',
      colorSecundario: '#1E40AF'
    }
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const usuarios = [
    { email: adminEmail, password: passwordHash, nombre: 'Administrador', rol: 'ADMIN' },
    { email: 'mozo@comanda.local', password: await bcrypt.hash('mozo123', 10), nombre: 'Juan Mozo', rol: 'MOZO' },
    { email: 'cocinero@comanda.local', password: await bcrypt.hash('cocinero123', 10), nombre: 'Pedro Cocinero', rol: 'COCINERO' },
    { email: 'cajero@comanda.local', password: await bcrypt.hash('cajero123', 10), nombre: 'Carla Caja', rol: 'CAJERO' },
    { email: 'delivery@comanda.local', password: await bcrypt.hash('delivery123', 10), nombre: 'Diego Delivery', rol: 'DELIVERY' }
  ];

  for (const usuario of usuarios) {
    await prisma.usuario.upsert({
      where: { email: usuario.email },
      update: usuario,
      create: usuario
    });
  }

  const empleados = [
    { nombre: 'Juan', apellido: 'Perez', dni: '30123456', telefono: '1155551234', rol: 'MOZO', tarifaHora: 1500 },
    { nombre: 'Maria', apellido: 'Garcia', dni: '31234567', telefono: '1155552345', rol: 'MOZO', tarifaHora: 1500 },
    { nombre: 'Pedro', apellido: 'Lopez', dni: '32345678', telefono: '1155553456', rol: 'COCINERO', tarifaHora: 1800 },
    { nombre: 'Carla', apellido: 'Suarez', dni: '33456789', telefono: '1155554567', rol: 'CAJERO', tarifaHora: 1700 }
  ];

  for (const empleado of empleados) {
    await prisma.empleado.upsert({
      where: { dni: empleado.dni },
      update: empleado,
      create: empleado
    });
  }

  const mesas = [
    { numero: 1, zona: 'Interior', capacidad: 4, posX: 40, posY: 40 },
    { numero: 2, zona: 'Interior', capacidad: 4, posX: 180, posY: 40 },
    { numero: 3, zona: 'Interior', capacidad: 6, posX: 320, posY: 40 },
    { numero: 4, zona: 'Terraza', capacidad: 2, posX: 40, posY: 180 },
    { numero: 5, zona: 'Terraza', capacidad: 4, posX: 180, posY: 180 },
    { numero: 6, zona: 'Barra', capacidad: 2, posX: 320, posY: 180 }
  ];

  for (const mesa of mesas) {
    await prisma.mesa.upsert({
      where: { numero: mesa.numero },
      update: mesa,
      create: mesa
    });
  }

  const categorias = [
    { nombre: 'Hamburguesas', descripcion: 'Hamburguesas de la casa', orden: 1 },
    { nombre: 'Papas', descripcion: 'Guarniciones y papas', orden: 2 },
    { nombre: 'Bebidas', descripcion: 'Bebidas frias', orden: 3 },
    { nombre: 'Postres', descripcion: 'Postres y cafe', orden: 4 }
  ];

  const categoriasMap = {};
  for (const categoria of categorias) {
    const created = await prisma.categoria.upsert({
      where: { nombre: categoria.nombre },
      update: categoria,
      create: categoria
    });
    categoriasMap[categoria.nombre] = created.id;
  }

  const ingredientes = [
    { nombre: 'Carne de hamburguesa', unidad: 'unidades', stockActual: 100, stockMinimo: 20, costo: 800 },
    { nombre: 'Pan de hamburguesa', unidad: 'unidades', stockActual: 150, stockMinimo: 30, costo: 200 },
    { nombre: 'Queso cheddar', unidad: 'fetas', stockActual: 200, stockMinimo: 50, costo: 100 },
    { nombre: 'Bacon', unidad: 'fetas', stockActual: 100, stockMinimo: 25, costo: 150 },
    { nombre: 'Lechuga', unidad: 'hojas', stockActual: 80, stockMinimo: 20, costo: 30 },
    { nombre: 'Tomate', unidad: 'rodajas', stockActual: 100, stockMinimo: 30, costo: 50 },
    { nombre: 'Papas congeladas', unidad: 'kg', stockActual: 30, stockMinimo: 10, costo: 500 },
    { nombre: 'Coca-Cola', unidad: 'unidades', stockActual: 48, stockMinimo: 12, costo: 400 }
  ];

  const ingredientesMap = {};
  for (const ingrediente of ingredientes) {
    const created = await prisma.ingrediente.upsert({
      where: { nombre: ingrediente.nombre },
      update: ingrediente,
      create: ingrediente
    });
    ingredientesMap[ingrediente.nombre] = created.id;
  }

  const productos = [
    {
      data: {
        nombre: 'Hamburguesa Clasica',
        descripcion: 'Carne, lechuga, tomate y mayonesa',
        precio: 4500,
        categoriaId: categoriasMap.Hamburguesas,
        destacado: true
      },
      ingredientes: [
        { ingredienteId: ingredientesMap['Carne de hamburguesa'], cantidad: 1 },
        { ingredienteId: ingredientesMap['Pan de hamburguesa'], cantidad: 1 },
        { ingredienteId: ingredientesMap.Lechuga, cantidad: 1 },
        { ingredienteId: ingredientesMap.Tomate, cantidad: 2 }
      ]
    },
    {
      data: {
        nombre: 'Hamburguesa con Queso',
        descripcion: 'Carne, cheddar, lechuga y tomate',
        precio: 5000,
        categoriaId: categoriasMap.Hamburguesas,
        destacado: true
      },
      ingredientes: [
        { ingredienteId: ingredientesMap['Carne de hamburguesa'], cantidad: 1 },
        { ingredienteId: ingredientesMap['Pan de hamburguesa'], cantidad: 1 },
        { ingredienteId: ingredientesMap['Queso cheddar'], cantidad: 2 }
      ]
    },
    {
      data: {
        nombre: 'Papas Fritas',
        descripcion: 'Porcion de papas crocantes',
        precio: 1800,
        categoriaId: categoriasMap.Papas
      },
      ingredientes: [
        { ingredienteId: ingredientesMap['Papas congeladas'], cantidad: 0.25 }
      ]
    },
    {
      data: {
        nombre: 'Coca-Cola 500ml',
        descripcion: 'Gaseosa linea Coca-Cola',
        precio: 1200,
        categoriaId: categoriasMap.Bebidas
      },
      ingredientes: [
        { ingredienteId: ingredientesMap['Coca-Cola'], cantidad: 1 }
      ]
    }
  ];

  for (const producto of productos) {
    const existente = await prisma.producto.findFirst({
      where: { nombre: producto.data.nombre }
    });

    const saved = existente
      ? await prisma.producto.update({
          where: { id: existente.id },
          data: producto.data
        })
      : await prisma.producto.create({ data: producto.data });

    await prisma.productoIngrediente.deleteMany({
      where: { productoId: saved.id }
    });

    if (producto.ingredientes.length > 0) {
      await prisma.productoIngrediente.createMany({
        data: producto.ingredientes.map((item) => ({
          productoId: saved.id,
          ingredienteId: item.ingredienteId,
          cantidad: item.cantidad
        }))
      });
    }
  }

  await upsertConfig('tienda_abierta', true);
  await upsertConfig('horario_apertura', '11:00');
  await upsertConfig('horario_cierre', '23:00');
  await upsertConfig('costo_delivery', 0);
  await upsertConfig('delivery_habilitado', true);
  await upsertConfig('efectivo_enabled', true);
  await upsertConfig('mercadopago_enabled', false);
  await upsertConfig('nombre_negocio', negocioNombre);
  await upsertConfig('tagline_negocio', 'Pedidos, caja y cocina en un solo lugar');
  await upsertConfig('facturacion_habilitada', false);
  await upsertConfig('facturacion_ambiente', 'homologacion');
  await upsertConfig('facturacion_punto_venta', 1);
  await upsertConfig('facturacion_cuit_emisor', '');
  await upsertConfig('facturacion_descripcion', '');
  await upsertConfig('facturacion_alicuota_iva', 21);

  await prisma.puntoVentaFiscal.upsert({
    where: { puntoVenta: 1 },
    update: {
      descripcion: 'Punto de venta principal',
      ambiente: 'homologacion',
      activo: true
    },
    create: {
      puntoVenta: 1,
      descripcion: 'Punto de venta principal',
      ambiente: 'homologacion',
      activo: true
    }
  });

  console.log('Seed completado.');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error('Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
