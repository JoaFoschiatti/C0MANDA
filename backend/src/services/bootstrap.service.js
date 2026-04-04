const bcrypt = require('bcryptjs');
const { normalizeEmail } = require('../utils/email');
const { roundStock } = require('../utils/decimal');
const { ensureBaseSucursales } = require('./sucursales.service');
const { SUCURSAL_IDS } = require('../constants/sucursales');

const splitStockBetweenBranches = (value) => {
  const total = roundStock(value);
  const salon = roundStock(total * 0.6);
  const delivery = roundStock(total - salon);

  return {
    salon,
    delivery
  };
};

const BASE_DEMO_USERS = [
  {
    email: 'mozo@comanda.local',
    password: 'mozo123',
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '30123456',
    telefono: '1155551234',
    rol: 'MOZO',
    tarifaHora: 1500
  },
  {
    email: 'mozo2@comanda.local',
    password: 'mozo123',
    nombre: 'Maria',
    apellido: 'Garcia',
    dni: '31234567',
    telefono: '1155552345',
    rol: 'MOZO',
    tarifaHora: 1500
  },
  {
    email: 'cocinero@comanda.local',
    password: 'cocinero123',
    nombre: 'Pedro',
    apellido: 'Lopez',
    dni: '32345678',
    telefono: '1155553456',
    rol: 'COCINERO',
    tarifaHora: 1800
  },
  {
    email: 'cajero@comanda.local',
    password: 'cajero123',
    nombre: 'Carla',
    apellido: 'Suarez',
    dni: '33456789',
    telefono: '1155554567',
    rol: 'CAJERO',
    tarifaHora: 1700
  },
  {
    email: 'delivery@comanda.local',
    password: 'delivery123',
    nombre: 'Diego',
    apellido: 'Delivery',
    rol: 'DELIVERY'
  }
];

const upsertConfig = async (prisma, clave, valor) => prisma.configuracion.upsert({
  where: { clave },
  update: { valor: String(valor) },
  create: { clave, valor: String(valor) }
});

const saveUsuarioByEmail = async (prisma, data) => {
  const existente = await prisma.usuario.findUnique({
    where: { email: data.email },
    select: { id: true }
  });

  if (existente) {
    return prisma.usuario.update({
      where: { id: existente.id },
      data
    });
  }

  return prisma.usuario.create({ data });
};

const seedBaseDemoUsers = async (prisma) => {
  for (const user of BASE_DEMO_USERS) {
    const { password, ...rest } = user;
    await saveUsuarioByEmail(prisma, {
      ...rest,
      email: normalizeEmail(user.email),
      password: await bcrypt.hash(password, 10)
    });
  }
};

const bootstrapCore = async (prisma, options = {}) => {
  const {
    negocioNombre = 'Comanda',
    negocioEmail = 'admin@comanda.local',
    negocioTelefono = '11-5555-0000',
    negocioDireccion = 'Av. Principal 123',
    adminEmail = 'admin@comanda.local',
    adminPassword,
    allowDefaultAdminPassword = false
  } = options;

  const resolvedPassword = adminPassword || (allowDefaultAdminPassword ? 'admin123' : null);
  if (!resolvedPassword) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD es obligatorio para bootstrappear la instalacion.');
  }

  const negocio = await prisma.negocio.upsert({
    where: { id: 1 },
    update: {
      nombre: negocioNombre,
      email: negocioEmail,
      telefono: negocioTelefono,
      direccion: negocioDireccion,
      colorPrimario: '#3B82F6',
      colorSecundario: '#1E40AF'
    },
    create: {
      id: 1,
      nombre: negocioNombre,
      email: negocioEmail,
      telefono: negocioTelefono,
      direccion: negocioDireccion,
      colorPrimario: '#3B82F6',
      colorSecundario: '#1E40AF'
    }
  });

  await ensureBaseSucursales(prisma);

  await saveUsuarioByEmail(prisma, {
    email: normalizeEmail(adminEmail),
    password: await bcrypt.hash(resolvedPassword, 10),
    nombre: 'Administrador',
    rol: 'ADMIN',
    activo: true
  });

  await Promise.all([
    upsertConfig(prisma, 'tienda_abierta', true),
    upsertConfig(prisma, 'horario_apertura', '11:00'),
    upsertConfig(prisma, 'horario_cierre', '23:00'),
    upsertConfig(prisma, 'costo_delivery', 0),
    upsertConfig(prisma, 'delivery_habilitado', true),
    upsertConfig(prisma, 'efectivo_enabled', true),
    upsertConfig(prisma, 'mercadopago_enabled', false),
    upsertConfig(prisma, 'nombre_negocio', negocioNombre),
    upsertConfig(prisma, 'tagline_negocio', 'Pedidos, caja y cocina en un solo lugar'),
    upsertConfig(prisma, 'facturacion_habilitada', false),
    upsertConfig(prisma, 'facturacion_ambiente', 'homologacion'),
    upsertConfig(prisma, 'facturacion_punto_venta', 1),
    upsertConfig(prisma, 'facturacion_cuit_emisor', ''),
    upsertConfig(prisma, 'facturacion_descripcion', ''),
    upsertConfig(prisma, 'facturacion_alicuota_iva', 21)
  ]);

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

  return negocio;
};

const seedCatalogDemoData = async (prisma) => {
  await seedBaseDemoUsers(prisma);

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
      update: {
        ...mesa,
        sucursalId: SUCURSAL_IDS.SALON
      },
      create: {
        ...mesa,
        sucursalId: SUCURSAL_IDS.SALON
      }
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
    const stockPorSucursal = splitStockBetweenBranches(ingrediente.stockActual);
    const minimoPorSucursal = splitStockBetweenBranches(ingrediente.stockMinimo);

    const created = await prisma.ingrediente.upsert({
      where: { nombre: ingrediente.nombre },
      update: {
        ...ingrediente,
        stockActual: roundStock(stockPorSucursal.salon + stockPorSucursal.delivery),
        stockMinimo: roundStock(minimoPorSucursal.salon + minimoPorSucursal.delivery)
      },
      create: {
        ...ingrediente,
        stockActual: roundStock(stockPorSucursal.salon + stockPorSucursal.delivery),
        stockMinimo: roundStock(minimoPorSucursal.salon + minimoPorSucursal.delivery)
      }
    });

    const stocks = [
      {
        sucursalId: SUCURSAL_IDS.SALON,
        stockActual: stockPorSucursal.salon,
        stockMinimo: minimoPorSucursal.salon,
        codigoLote: `SEED-SALON-${created.id}`
      },
      {
        sucursalId: SUCURSAL_IDS.DELIVERY,
        stockActual: stockPorSucursal.delivery,
        stockMinimo: minimoPorSucursal.delivery,
        codigoLote: `SEED-DELIVERY-${created.id}`
      }
    ];

    for (const stock of stocks) {
      await prisma.ingredienteStock.upsert({
        where: {
          ingredienteId_sucursalId: {
            ingredienteId: created.id,
            sucursalId: stock.sucursalId
          }
        },
        update: {
          stockActual: stock.stockActual,
          stockMinimo: stock.stockMinimo,
          activo: true
        },
        create: {
          ingredienteId: created.id,
          sucursalId: stock.sucursalId,
          stockActual: stock.stockActual,
          stockMinimo: stock.stockMinimo,
          activo: true
        }
      });

      const lote = await prisma.loteStock.upsert({
        where: {
          ingredienteId_sucursalId_codigoLote: {
            ingredienteId: created.id,
            sucursalId: stock.sucursalId,
            codigoLote: stock.codigoLote
          }
        },
        update: {
          stockInicial: stock.stockActual,
          stockActual: stock.stockActual,
          costoUnitario: created.costo ?? null,
          activo: stock.stockActual > 0
        },
        create: {
          ingredienteId: created.id,
          sucursalId: stock.sucursalId,
          codigoLote: stock.codigoLote,
          stockInicial: stock.stockActual,
          stockActual: stock.stockActual,
          costoUnitario: created.costo ?? null,
          activo: stock.stockActual > 0
        }
      });

      const movimientoExistente = await prisma.movimientoStock.findFirst({
        where: {
          ingredienteId: created.id,
          sucursalId: stock.sucursalId,
          loteStockId: lote.id,
          tipo: 'ENTRADA',
          motivo: 'Stock inicial seed'
        }
      });

      if (!movimientoExistente && stock.stockActual > 0) {
        await prisma.movimientoStock.create({
          data: {
            ingredienteId: created.id,
            sucursalId: stock.sucursalId,
            loteStockId: lote.id,
            tipo: 'ENTRADA',
            cantidad: stock.stockActual,
            motivo: 'Stock inicial seed'
          }
        });
      }
    }

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
};

module.exports = {
  BASE_DEMO_USERS,
  bootstrapCore,
  seedDemoData: seedCatalogDemoData,
  seedBaseDemoUsers,
  seedCatalogDemoData,
  saveUsuarioByEmail,
  splitStockBetweenBranches,
  upsertConfig
};
