const bcrypt = require('bcryptjs');
const { normalizeEmail } = require('../utils/email');
const { SUCURSAL_IDS } = require('../constants/sucursales');
const {
  saveUsuarioByEmail,
  seedBaseDemoUsers,
  upsertConfig
} = require('./bootstrap.service');

const VISUAL_SEED_RANDOM = 20260328;

const MONEY = (value) => Number.parseFloat(Number(value || 0).toFixed(2));
const STOCK = (value) => Number.parseFloat(Number(value || 0).toFixed(3));

const { addDays, addHours, addMinutes, startOfDay } = require('../utils/date-helpers');

const createSeededRandom = (seed = VISUAL_SEED_RANDOM) => {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const randomInt = (random, min, max) => (
  Math.floor(random() * (max - min + 1)) + min
);

const pickOne = (random, items) => items[randomInt(random, 0, items.length - 1)];

const pickManyUnique = (random, items, count) => {
  const source = [...items];
  const picked = [];

  while (source.length > 0 && picked.length < count) {
    const index = randomInt(random, 0, source.length - 1);
    picked.push(source.splice(index, 1)[0]);
  }

  return picked;
};

const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .toLowerCase();

const VISUAL_CREDENTIALS = [
  { rol: 'ADMIN', email: 'admin@comanda.local', password: 'admin123' },
  { rol: 'CAJERO', email: 'cajero@comanda.local', password: 'cajero123' },
  { rol: 'MOZO', email: 'mozo@comanda.local', password: 'mozo123' },
  { rol: 'COCINERO', email: 'cocinero@comanda.local', password: 'cocinero123' },
  { rol: 'DELIVERY', email: 'delivery@comanda.local', password: 'delivery123' }
];

const VISUAL_EXTRA_USERS = [
  {
    email: 'mozo3@comanda.local',
    password: 'mozo123',
    nombre: 'Sofia',
    apellido: 'Ruiz',
    telefono: '1155553457',
    rol: 'MOZO',
    tarifaHora: 1550,
    activo: true
  },
  {
    email: 'mozo4@comanda.local',
    password: 'mozo123',
    nombre: 'Lucas',
    apellido: 'Diaz',
    telefono: '1155553458',
    rol: 'MOZO',
    tarifaHora: 1550,
    activo: false
  },
  {
    email: 'cocinero2@comanda.local',
    password: 'cocinero123',
    nombre: 'Agustin',
    apellido: 'Rios',
    telefono: '1155554457',
    rol: 'COCINERO',
    tarifaHora: 1850,
    activo: true
  },
  {
    email: 'cajero2@comanda.local',
    password: 'cajero123',
    nombre: 'Julieta',
    apellido: 'Luna',
    telefono: '1155555457',
    rol: 'CAJERO',
    tarifaHora: 1750,
    activo: true
  },
  {
    email: 'delivery2@comanda.local',
    password: 'delivery123',
    nombre: 'Mateo',
    apellido: 'Rider',
    telefono: '1155556457',
    rol: 'DELIVERY',
    activo: true
  }
];

const buildRoleEmailSets = ({ includeExtraUsers = true } = {}) => ({
  tertiaryMozo: includeExtraUsers ? 'mozo3@comanda.local' : 'mozo2@comanda.local',
  secondaryCajero: includeExtraUsers ? 'cajero2@comanda.local' : 'cajero@comanda.local',
  secondaryDelivery: includeExtraUsers ? 'delivery2@comanda.local' : 'delivery@comanda.local',
  historicalMozos: includeExtraUsers
    ? ['mozo@comanda.local', 'mozo2@comanda.local', 'mozo3@comanda.local']
    : ['mozo@comanda.local', 'mozo2@comanda.local'],
  historicalCajeros: includeExtraUsers
    ? ['cajero@comanda.local', 'cajero2@comanda.local']
    : ['cajero@comanda.local'],
  historicalRepartidores: includeExtraUsers
    ? ['delivery@comanda.local', 'delivery2@comanda.local']
    : ['delivery@comanda.local']
});

const resetVisualSeedState = async (prisma) => {
  await prisma.$transaction(async (tx) => {
    await tx.operationalEvent.deleteMany();
    await tx.transaccionMercadoPago.deleteMany();
    await tx.comprobanteFiscal.deleteMany();
    await tx.clienteFiscal.deleteMany();
    await tx.pedidoAuditoria.deleteMany();
    await tx.printJob.deleteMany();
    await tx.pago.deleteMany();
    await tx.pedidoItemModificador.deleteMany();
    await tx.pedidoItem.deleteMany();
    await tx.reserva.deleteMany();
    await tx.pedido.deleteMany();
    await tx.cierreCaja.deleteMany();
    await tx.fichaje.deleteMany();
    await tx.movimientoStock.deleteMany();
    await tx.loteStock.deleteMany();
    await tx.ingredienteStock.deleteMany();
    await tx.productoModificador.deleteMany();
    await tx.productoIngrediente.deleteMany();
    await tx.producto.deleteMany();
    await tx.modificador.deleteMany();
    await tx.ingrediente.deleteMany();
    await tx.categoria.deleteMany();
    await tx.mesa.deleteMany();
    await tx.refreshToken.deleteMany();
    await tx.usuario.deleteMany();
  });
};

const ensureVisualConfigs = async (prisma, options = {}) => {
  const {
    negocioNombre = 'Comanda Visual QA',
    negocioTelefono = '11-5555-0099',
    negocioDireccion = 'Av. Demo 123, CABA',
    colorPrimario = '#D97706',
    colorSecundario = '#0F766E',
    taglineNegocio = 'Escenario de demo visual con datos reales de operacion',
    mercadopagoTransferAlias = 'comanda.demo.mp',
    mercadopagoTransferTitular = negocioNombre,
    mercadopagoTransferCvu = '0000003100000000000001',
    facturacionDescripcion = 'PV demo visual',
    puntoVentaDescripcion = 'Punto de venta demo visual'
  } = options;

  await prisma.negocio.update({
    where: { id: 1 },
    data: {
      nombre: negocioNombre,
      telefono: negocioTelefono,
      direccion: negocioDireccion,
      colorPrimario,
      colorSecundario
    }
  });

  await Promise.all([
    upsertConfig(prisma, 'nombre_negocio', negocioNombre),
    upsertConfig(prisma, 'tagline_negocio', taglineNegocio),
    upsertConfig(prisma, 'whatsapp_numero', '5491155550099'),
    upsertConfig(prisma, 'efectivo_enabled', true),
    upsertConfig(prisma, 'mercadopago_enabled', false),
    upsertConfig(prisma, 'mercadopago_transfer_alias', mercadopagoTransferAlias),
    upsertConfig(prisma, 'mercadopago_transfer_titular', mercadopagoTransferTitular),
    upsertConfig(prisma, 'mercadopago_transfer_cvu', mercadopagoTransferCvu),
    upsertConfig(prisma, 'delivery_habilitado', true),
    upsertConfig(prisma, 'facturacion_habilitada', true),
    upsertConfig(prisma, 'facturacion_descripcion', facturacionDescripcion),
    upsertConfig(prisma, 'facturacion_cuit_emisor', '30712345678')
  ]);

  await prisma.puntoVentaFiscal.upsert({
    where: { puntoVenta: 1 },
    update: {
      descripcion: puntoVentaDescripcion,
      ambiente: 'homologacion',
      cuitEmisor: '30712345678',
      activo: true
    },
    create: {
      puntoVenta: 1,
      descripcion: puntoVentaDescripcion,
      ambiente: 'homologacion',
      cuitEmisor: '30712345678',
      activo: true
    }
  });
};

const ensureVisualUsers = async (prisma, options = {}) => {
  const { includeExtraUsers = true } = options;

  await seedBaseDemoUsers(prisma);

  if (!includeExtraUsers) {
    return;
  }

  for (const user of VISUAL_EXTRA_USERS) {
    await saveUsuarioByEmail(prisma, {
      email: normalizeEmail(user.email),
      password: await bcrypt.hash(user.password, 10),
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono,
      rol: user.rol,
      tarifaHora: user.tarifaHora,
      activo: user.activo
    });
  }
};

const ensureVisualMesas = async (prisma) => {
  const mesas = [
    { numero: 1, zona: 'Interior', capacidad: 4, posX: 40, posY: 40, rotacion: 0, grupoMesaId: null },
    { numero: 2, zona: 'Interior', capacidad: 4, posX: 180, posY: 40, rotacion: 0, grupoMesaId: null },
    { numero: 3, zona: 'Interior', capacidad: 6, posX: 320, posY: 40, rotacion: 0, grupoMesaId: null },
    { numero: 4, zona: 'Terraza', capacidad: 2, posX: 40, posY: 180, rotacion: 0, grupoMesaId: null },
    { numero: 5, zona: 'Terraza', capacidad: 4, posX: 180, posY: 180, rotacion: 0, grupoMesaId: null },
    { numero: 6, zona: 'Barra', capacidad: 2, posX: 320, posY: 180, rotacion: 0, grupoMesaId: null },
    { numero: 7, zona: 'Interior', capacidad: 4, posX: 460, posY: 40, rotacion: 0, grupoMesaId: null },
    { numero: 8, zona: 'Interior', capacidad: 4, posX: 600, posY: 40, rotacion: 0, grupoMesaId: null },
    { numero: 9, zona: 'Patio', capacidad: 6, posX: 40, posY: 320, rotacion: 0, grupoMesaId: 90 },
    { numero: 10, zona: 'Patio', capacidad: 6, posX: 200, posY: 320, rotacion: 0, grupoMesaId: 90 },
    { numero: 11, zona: 'VIP', capacidad: 8, posX: 360, posY: 320, rotacion: 90, grupoMesaId: 110 },
    { numero: 12, zona: 'VIP', capacidad: 8, posX: 520, posY: 320, rotacion: 90, grupoMesaId: 110 }
  ];

  for (const mesa of mesas) {
    await prisma.mesa.upsert({
      where: { numero: mesa.numero },
      update: {
        ...mesa,
        activa: true,
        sucursalId: SUCURSAL_IDS.SALON,
        estado: 'LIBRE'
      },
      create: {
        ...mesa,
        activa: true,
        sucursalId: SUCURSAL_IDS.SALON,
        estado: 'LIBRE'
      }
    });
  }
};

const ensureVisualCategorias = async (prisma) => {
  const categorias = [
    { nombre: 'Hamburguesas', descripcion: 'Hamburguesas de la casa', orden: 1 },
    { nombre: 'Papas', descripcion: 'Guarniciones y papas', orden: 2 },
    { nombre: 'Bebidas', descripcion: 'Bebidas frias', orden: 3 },
    { nombre: 'Postres', descripcion: 'Postres y cafe', orden: 4 },
    { nombre: 'Pizzas', descripcion: 'Pizzas al horno y porciones', orden: 5 },
    { nombre: 'Tacos', descripcion: 'Tacos y wraps', orden: 6 },
    { nombre: 'Ensaladas', descripcion: 'Opciones frescas y bowls', orden: 7 },
    { nombre: 'Cafeteria', descripcion: 'Cafe, latte y cookies', orden: 8 }
  ];

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { nombre: categoria.nombre },
      update: categoria,
      create: categoria
    });
  }

  const saved = await prisma.categoria.findMany({
    select: { id: true, nombre: true }
  });

  return new Map(saved.map((item) => [item.nombre, item.id]));
};

const INGREDIENT_DEFINITIONS = [
  {
    nombre: 'Carne de hamburguesa',
    unidad: 'unidades',
    costo: 900,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 16,
        lotes: [
          { codigo: 'CARNE-SALON-A', stockActual: 42, fechaIngresoOffset: -6, fechaVencimientoOffset: 10, consumo: 8 },
          { codigo: 'CARNE-SALON-B', stockActual: 18, fechaIngresoOffset: -2, fechaVencimientoOffset: 24, consumo: 2 }
        ]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 10,
        lotes: [
          { codigo: 'CARNE-DELI-A', stockActual: 22, fechaIngresoOffset: -5, fechaVencimientoOffset: 9, consumo: 6 },
          { codigo: 'CARNE-DELI-B', stockActual: 10, fechaIngresoOffset: -1, fechaVencimientoOffset: 22 }
        ]
      }
    }
  },
  {
    nombre: 'Pan de hamburguesa',
    unidad: 'unidades',
    costo: 220,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 20,
        lotes: [{ codigo: 'PAN-SALON', stockActual: 70, fechaIngresoOffset: -3, fechaVencimientoOffset: 5, consumo: 12 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 12,
        lotes: [{ codigo: 'PAN-DELIVERY', stockActual: 36, fechaIngresoOffset: -2, fechaVencimientoOffset: 4, consumo: 5 }]
      }
    }
  },
  {
    nombre: 'Queso cheddar',
    unidad: 'fetas',
    costo: 120,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 30,
        lotes: [
          { codigo: 'CHEDDAR-SALON-A', stockActual: 60, fechaIngresoOffset: -4, fechaVencimientoOffset: 7, consumo: 15 },
          { codigo: 'CHEDDAR-SALON-B', stockActual: 24, fechaIngresoOffset: -1, fechaVencimientoOffset: 18 }
        ]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 20,
        lotes: [{ codigo: 'CHEDDAR-DELIVERY', stockActual: 32, fechaIngresoOffset: -2, fechaVencimientoOffset: 9, consumo: 4 }]
      }
    }
  },
  {
    nombre: 'Bacon',
    unidad: 'fetas',
    costo: 170,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 12,
        lotes: [{ codigo: 'BACON-SALON', stockActual: 20, fechaIngresoOffset: -4, fechaVencimientoOffset: 8, consumo: 6 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 6,
        lotes: [{ codigo: 'BACON-DELIVERY', stockActual: 3, fechaIngresoOffset: -3, fechaVencimientoOffset: 6, consumo: 2 }]
      }
    }
  },
  {
    nombre: 'Lechuga',
    unidad: 'hojas',
    costo: 35,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 12,
        lotes: [{ codigo: 'LECHUGA-SALON', stockActual: 38, fechaIngresoOffset: -2, fechaVencimientoOffset: 3, consumo: 10 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'LECHUGA-DELIVERY', stockActual: 18, fechaIngresoOffset: -1, fechaVencimientoOffset: 2, consumo: 3 }]
      }
    }
  },
  {
    nombre: 'Tomate',
    unidad: 'rodajas',
    costo: 50,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 18,
        lotes: [{ codigo: 'TOMATE-SALON', stockActual: 34, fechaIngresoOffset: -2, fechaVencimientoOffset: 4, consumo: 8 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 12,
        lotes: [{ codigo: 'TOMATE-DELIVERY', stockActual: 16, fechaIngresoOffset: -1, fechaVencimientoOffset: 3, consumo: 4 }]
      }
    }
  },
  {
    nombre: 'Papas congeladas',
    unidad: 'kg',
    costo: 520,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 6,
        lotes: [
          { codigo: 'PAPAS-SALON-A', stockActual: 14, fechaIngresoOffset: -8, fechaVencimientoOffset: 90, consumo: 4 },
          { codigo: 'PAPAS-SALON-B', stockActual: 8, fechaIngresoOffset: -2, fechaVencimientoOffset: 120 }
        ]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'PAPAS-DELIVERY', stockActual: 11, fechaIngresoOffset: -3, fechaVencimientoOffset: 95, consumo: 2 }]
      }
    }
  },
  {
    nombre: 'Coca-Cola',
    unidad: 'unidades',
    costo: 450,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 10,
        lotes: [{ codigo: 'COCA-SALON', stockActual: 28, fechaIngresoOffset: -6, fechaVencimientoOffset: 50, consumo: 6 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'COCA-DELIVERY', stockActual: 20, fechaIngresoOffset: -5, fechaVencimientoOffset: 45, consumo: 4 }]
      }
    }
  },
  {
    nombre: 'Masa de pizza',
    unidad: 'bollos',
    costo: 650,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'MASA-SALON', stockActual: 18, fechaIngresoOffset: -2, fechaVencimientoOffset: 6, consumo: 4 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 5,
        lotes: [{ codigo: 'MASA-DELIVERY', stockActual: 9, fechaIngresoOffset: -2, fechaVencimientoOffset: 5, consumo: 2 }]
      }
    }
  },
  {
    nombre: 'Salsa de tomate',
    unidad: 'litros',
    costo: 300,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 2,
        lotes: [{ codigo: 'SALSA-SALON', stockActual: 5.5, fechaIngresoOffset: -5, fechaVencimientoOffset: 12, consumo: 1.2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 1.2,
        lotes: [{ codigo: 'SALSA-DELIVERY', stockActual: 3.1, fechaIngresoOffset: -4, fechaVencimientoOffset: 10, consumo: 0.6 }]
      }
    }
  },
  {
    nombre: 'Mozzarella',
    unidad: 'kg',
    costo: 1900,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 2.5,
        lotes: [
          { codigo: 'MOZZA-SALON-A', stockActual: 6, fechaIngresoOffset: -4, fechaVencimientoOffset: 5, consumo: 1.5 },
          { codigo: 'MOZZA-SALON-B', stockActual: 2.2, fechaIngresoOffset: -1, fechaVencimientoOffset: 14 }
        ]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 1.4,
        lotes: [{ codigo: 'MOZZA-DELIVERY', stockActual: 3, fechaIngresoOffset: -2, fechaVencimientoOffset: 8, consumo: 0.5 }]
      }
    }
  },
  {
    nombre: 'Pepperoni',
    unidad: 'fetas',
    costo: 140,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 12,
        lotes: [{ codigo: 'PEPPERONI-SALON', stockActual: 18, fechaIngresoOffset: -3, fechaVencimientoOffset: 7, consumo: 4 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 6,
        lotes: [{ codigo: 'PEPPERONI-DELIVERY', stockActual: 2, fechaIngresoOffset: -3, fechaVencimientoOffset: 5, consumo: 1 }]
      }
    }
  },
  {
    nombre: 'Cebolla morada',
    unidad: 'unidades',
    costo: 90,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 5,
        lotes: [{ codigo: 'CEBOLLA-SALON', stockActual: 12, fechaIngresoOffset: -4, fechaVencimientoOffset: 9, consumo: 2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'CEBOLLA-DELIVERY', stockActual: 6, fechaIngresoOffset: -3, fechaVencimientoOffset: 7, consumo: 1 }]
      }
    }
  },
  {
    nombre: 'Pollo grillado',
    unidad: 'porciones',
    costo: 980,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'POLLO-SALON', stockActual: 16, fechaIngresoOffset: -4, fechaVencimientoOffset: 6, consumo: 5 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 5,
        lotes: [{ codigo: 'POLLO-DELIVERY', stockActual: 8, fechaIngresoOffset: -2, fechaVencimientoOffset: 5, consumo: 2 }]
      }
    }
  },
  {
    nombre: 'Tortilla mexicana',
    unidad: 'unidades',
    costo: 130,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'TORTILLA-SALON', stockActual: 24, fechaIngresoOffset: -6, fechaVencimientoOffset: 25, consumo: 4 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 6,
        lotes: [{ codigo: 'TORTILLA-DELIVERY', stockActual: 14, fechaIngresoOffset: -5, fechaVencimientoOffset: 21, consumo: 2 }]
      }
    }
  },
  {
    nombre: 'Guacamole',
    unidad: 'porciones',
    costo: 250,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'GUACA-SALON', stockActual: 10, fechaIngresoOffset: -2, fechaVencimientoOffset: 3, consumo: 2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'GUACA-DELIVERY', stockActual: 5, fechaIngresoOffset: -1, fechaVencimientoOffset: 2, consumo: 1 }]
      }
    }
  },
  {
    nombre: 'Cafe molido',
    unidad: 'kg',
    costo: 5200,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 2.5,
        lotes: [{ codigo: 'CAFE-SALON', stockActual: 1.2, fechaIngresoOffset: -20, fechaVencimientoOffset: 30, consumo: 0.8 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 1,
        lotes: [{ codigo: 'CAFE-DELIVERY', stockActual: 1.6, fechaIngresoOffset: -12, fechaVencimientoOffset: 20, consumo: 0.3 }]
      }
    }
  },
  {
    nombre: 'Leche entera',
    unidad: 'litros',
    costo: 750,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 3,
        lotes: [
          { codigo: 'LECHE-SALON-A', stockActual: 5, fechaIngresoOffset: -2, fechaVencimientoOffset: 3, consumo: 1.2 },
          { codigo: 'LECHE-SALON-B', stockActual: 2, fechaIngresoOffset: -1, fechaVencimientoOffset: 6 }
        ]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 1.5,
        lotes: [{ codigo: 'LECHE-DELIVERY', stockActual: 2.2, fechaIngresoOffset: -1, fechaVencimientoOffset: 2, consumo: 0.4 }]
      }
    }
  },
  {
    nombre: 'Helado vainilla',
    unidad: 'bochas',
    costo: 220,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'HELADO-SALON', stockActual: 14, fechaIngresoOffset: -4, fechaVencimientoOffset: 9, consumo: 3 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 4,
        lotes: [
          { codigo: 'HELADO-DELIVERY-OLD', stockActual: 3, fechaIngresoOffset: -10, fechaVencimientoOffset: -2 },
          { codigo: 'HELADO-DELIVERY-NEW', stockActual: 6, fechaIngresoOffset: -2, fechaVencimientoOffset: 8 }
        ]
      }
    }
  },
  {
    nombre: 'Rucula',
    unidad: 'manojos',
    costo: 180,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'RUCULA-SALON', stockActual: 1.1, fechaIngresoOffset: -2, fechaVencimientoOffset: 2, consumo: 0.5 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 1.5,
        lotes: [{ codigo: 'RUCULA-DELIVERY', stockActual: 2, fechaIngresoOffset: -2, fechaVencimientoOffset: 3, consumo: 0.2 }]
      }
    }
  },
  {
    nombre: 'Champinones',
    unidad: 'kg',
    costo: 2400,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 1.2,
        lotes: [{ codigo: 'CHAMPI-SALON', stockActual: 2.8, fechaIngresoOffset: -3, fechaVencimientoOffset: 4, consumo: 0.6 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 0.8,
        lotes: [{ codigo: 'CHAMPI-DELIVERY', stockActual: 1.4, fechaIngresoOffset: -2, fechaVencimientoOffset: 3, consumo: 0.2 }]
      }
    }
  },
  {
    nombre: 'Medallon veggie',
    unidad: 'unidades',
    costo: 780,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'VEGGIE-SALON', stockActual: 10, fechaIngresoOffset: -8, fechaVencimientoOffset: 50, consumo: 2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'VEGGIE-DELIVERY', stockActual: 6, fechaIngresoOffset: -5, fechaVencimientoOffset: 40, consumo: 1 }]
      }
    }
  },
  {
    nombre: 'Agua mineral 500ml',
    unidad: 'unidades',
    costo: 300,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 8,
        lotes: [{ codigo: 'AGUA-SALON', stockActual: 20, fechaIngresoOffset: -10, fechaVencimientoOffset: 120, consumo: 3 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 6,
        lotes: [{ codigo: 'AGUA-DELIVERY', stockActual: 14, fechaIngresoOffset: -9, fechaVencimientoOffset: 110, consumo: 2 }]
      }
    }
  },
  {
    nombre: 'Limonada mix',
    unidad: 'porciones',
    costo: 260,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 5,
        lotes: [{ codigo: 'LIMONADA-SALON', stockActual: 12, fechaIngresoOffset: -2, fechaVencimientoOffset: 4, consumo: 2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'LIMONADA-DELIVERY', stockActual: 8, fechaIngresoOffset: -2, fechaVencimientoOffset: 4, consumo: 1 }]
      }
    }
  },
  {
    nombre: 'Cerveza rubia lata',
    unidad: 'unidades',
    costo: 780,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'CERVEZA-SALON', stockActual: 10, fechaIngresoOffset: -15, fechaVencimientoOffset: 180, consumo: 1 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 2,
        lotes: [{ codigo: 'CERVEZA-DELIVERY', stockActual: 5, fechaIngresoOffset: -12, fechaVencimientoOffset: 160 }]
      }
    }
  },
  {
    nombre: 'Ginger ale lata',
    unidad: 'unidades',
    costo: 540,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'GINGER-SALON', stockActual: 8, fechaIngresoOffset: -8, fechaVencimientoOffset: 120, consumo: 1 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'GINGER-DELIVERY', stockActual: 6, fechaIngresoOffset: -7, fechaVencimientoOffset: 110 }]
      }
    }
  },
  {
    nombre: 'Brownie base',
    unidad: 'porciones',
    costo: 450,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'BROWNIE-SALON', stockActual: 9, fechaIngresoOffset: -2, fechaVencimientoOffset: 5, consumo: 2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 2,
        lotes: [{ codigo: 'BROWNIE-DELIVERY', stockActual: 4, fechaIngresoOffset: -1, fechaVencimientoOffset: 4, consumo: 1 }]
      }
    }
  },
  {
    nombre: 'Cheesecake porcion',
    unidad: 'porciones',
    costo: 650,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'CHEESE-SALON', stockActual: 7, fechaIngresoOffset: -2, fechaVencimientoOffset: 6, consumo: 1 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 2,
        lotes: [{ codigo: 'CHEESE-DELIVERY', stockActual: 3, fechaIngresoOffset: -1, fechaVencimientoOffset: 5 }]
      }
    }
  },
  {
    nombre: 'Frutos rojos',
    unidad: 'porciones',
    costo: 180,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'FRUTOS-SALON', stockActual: 8, fechaIngresoOffset: -4, fechaVencimientoOffset: 20, consumo: 1 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 2,
        lotes: [{ codigo: 'FRUTOS-DELIVERY', stockActual: 4, fechaIngresoOffset: -4, fechaVencimientoOffset: 18 }]
      }
    }
  },
  {
    nombre: 'Flan casero porcion',
    unidad: 'porciones',
    costo: 380,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 4,
        lotes: [{ codigo: 'FLAN-SALON', stockActual: 8, fechaIngresoOffset: -2, fechaVencimientoOffset: 4, consumo: 1 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 2,
        lotes: [{ codigo: 'FLAN-DELIVERY', stockActual: 3, fechaIngresoOffset: -1, fechaVencimientoOffset: 3 }]
      }
    }
  },
  {
    nombre: 'Cookie artesanal',
    unidad: 'unidades',
    costo: 260,
    sucursales: {
      [SUCURSAL_IDS.SALON]: {
        stockMinimo: 6,
        lotes: [{ codigo: 'COOKIE-SALON', stockActual: 14, fechaIngresoOffset: -5, fechaVencimientoOffset: 16, consumo: 2 }]
      },
      [SUCURSAL_IDS.DELIVERY]: {
        stockMinimo: 3,
        lotes: [{ codigo: 'COOKIE-DELIVERY', stockActual: 7, fechaIngresoOffset: -4, fechaVencimientoOffset: 15, consumo: 1 }]
      }
    }
  }
];

const ensureVisualIngredientes = async (prisma, baseNow) => {
  for (const definition of INGREDIENT_DEFINITIONS) {
    const totalStock = Object.values(definition.sucursales)
      .reduce((sum, branch) => sum + branch.lotes.reduce((lotSum, lot) => lotSum + STOCK(lot.stockActual), 0), 0);
    const totalMin = Object.values(definition.sucursales)
      .reduce((sum, branch) => sum + STOCK(branch.stockMinimo), 0);

    await prisma.ingrediente.upsert({
      where: { nombre: definition.nombre },
      update: {
        unidad: definition.unidad,
        costo: MONEY(definition.costo),
        stockActual: STOCK(totalStock),
        stockMinimo: STOCK(totalMin),
        activo: true
      },
      create: {
        nombre: definition.nombre,
        unidad: definition.unidad,
        costo: MONEY(definition.costo),
        stockActual: STOCK(totalStock),
        stockMinimo: STOCK(totalMin),
        activo: true
      }
    });
  }

  await prisma.movimientoStock.deleteMany();
  await prisma.loteStock.deleteMany();
  await prisma.ingredienteStock.deleteMany();

  const ingredientes = await prisma.ingrediente.findMany({
    select: { id: true, nombre: true }
  });
  const ingredientByName = new Map(ingredientes.map((item) => [item.nombre, item]));

  for (const definition of INGREDIENT_DEFINITIONS) {
    const ingrediente = ingredientByName.get(definition.nombre);

    for (const [sucursalKey, branch] of Object.entries(definition.sucursales)) {
      const sucursalId = Number.parseInt(sucursalKey, 10);
      const branchStock = STOCK(branch.lotes.reduce((sum, lot) => sum + lot.stockActual, 0));

      await prisma.ingredienteStock.create({
        data: {
          ingredienteId: ingrediente.id,
          sucursalId,
          stockActual: branchStock,
          stockMinimo: STOCK(branch.stockMinimo),
          activo: true
        }
      });

      for (const lot of branch.lotes) {
        const fechaIngreso = addDays(baseNow, lot.fechaIngresoOffset || 0);
        const fechaVencimiento = lot.fechaVencimientoOffset === undefined
          ? null
          : addDays(baseNow, lot.fechaVencimientoOffset);
        const stockActual = STOCK(lot.stockActual);
        const consumo = STOCK(lot.consumo || 0);
        const stockInicial = STOCK(stockActual + consumo);

        const createdLote = await prisma.loteStock.create({
          data: {
            ingredienteId: ingrediente.id,
            sucursalId,
            codigoLote: lot.codigo,
            stockInicial,
            stockActual,
            costoUnitario: MONEY(definition.costo),
            fechaIngreso,
            fechaVencimiento,
            activo: stockActual > 0
          }
        });

        await prisma.movimientoStock.create({
          data: {
            ingredienteId: ingrediente.id,
            sucursalId,
            loteStockId: createdLote.id,
            tipo: 'ENTRADA',
            cantidad: stockInicial,
            motivo: 'Ingreso visual seed',
            createdAt: fechaIngreso
          }
        });

        if (consumo > 0) {
          await prisma.movimientoStock.create({
            data: {
              ingredienteId: ingrediente.id,
              sucursalId,
              loteStockId: createdLote.id,
              tipo: 'SALIDA',
              cantidad: consumo,
              motivo: 'Consumo demo visual',
              createdAt: addHours(fechaIngreso, 12)
            }
          });
        }
      }
    }
  }

  await prisma.movimientoStock.createMany({
    data: [
      {
        ingredienteId: ingredientByName.get('Rucula').id,
        sucursalId: SUCURSAL_IDS.SALON,
        tipo: 'AJUSTE',
        cantidad: 0.4,
        motivo: 'Merma por descarte visual',
        createdAt: addHours(baseNow, -18)
      },
      {
        ingredienteId: ingredientByName.get('Cafe molido').id,
        sucursalId: SUCURSAL_IDS.SALON,
        tipo: 'AJUSTE',
        cantidad: 0.2,
        motivo: 'Ajuste por molienda visual',
        createdAt: addHours(baseNow, -10)
      }
    ]
  });

  return ingredientByName;
};

const MODIFIER_DEFINITIONS = [
  { nombre: 'Sin cebolla', tipo: 'EXCLUSION', precio: 0, activo: true },
  { nombre: 'Sin tomate', tipo: 'EXCLUSION', precio: 0, activo: true },
  { nombre: 'Sin cheddar', tipo: 'EXCLUSION', precio: 0, activo: true },
  { nombre: 'Cheddar extra', tipo: 'ADICION', precio: 450, activo: true },
  { nombre: 'Bacon extra', tipo: 'ADICION', precio: 650, activo: true },
  { nombre: 'Huevo extra', tipo: 'ADICION', precio: 550, activo: true },
  { nombre: 'Salsa picante', tipo: 'ADICION', precio: 220, activo: true },
  { nombre: 'Doble carne', tipo: 'ADICION', precio: 1800, activo: true },
  { nombre: 'Borde relleno', tipo: 'ADICION', precio: 1200, activo: true },
  { nombre: 'Extra muzzarella', tipo: 'ADICION', precio: 800, activo: true },
  { nombre: 'Combo papas medianas', tipo: 'ADICION', precio: 1400, activo: true },
  { nombre: 'Aderezo de la casa', tipo: 'ADICION', precio: 180, activo: false }
];

const PRODUCT_DEFINITIONS = [
  {
    nombre: 'Hamburguesa Clasica',
    categoria: 'Hamburguesas',
    descripcion: 'Carne, lechuga, tomate y mayonesa',
    precio: 4500,
    destacado: true,
    disponible: true,
    ingredientes: [['Carne de hamburguesa', 1], ['Pan de hamburguesa', 1], ['Lechuga', 1], ['Tomate', 2]],
    modificadores: ['Sin cebolla', 'Sin tomate', 'Cheddar extra', 'Bacon extra', 'Huevo extra', 'Combo papas medianas']
  },
  {
    nombre: 'Hamburguesa con Queso',
    categoria: 'Hamburguesas',
    descripcion: 'Carne, cheddar, lechuga y tomate',
    precio: 5000,
    destacado: true,
    disponible: true,
    ingredientes: [['Carne de hamburguesa', 1], ['Pan de hamburguesa', 1], ['Queso cheddar', 2], ['Lechuga', 1], ['Tomate', 1]],
    modificadores: ['Sin cebolla', 'Sin tomate', 'Cheddar extra', 'Bacon extra', 'Huevo extra']
  },
  {
    nombre: 'Bacon Smash',
    categoria: 'Hamburguesas',
    descripcion: 'Doble carne smash, bacon crocante y cheddar',
    precio: 6300,
    destacado: true,
    disponible: true,
    ingredientes: [['Carne de hamburguesa', 2], ['Pan de hamburguesa', 1], ['Queso cheddar', 2], ['Bacon', 2], ['Cebolla morada', 1]],
    modificadores: ['Sin cebolla', 'Cheddar extra', 'Bacon extra', 'Doble carne', 'Salsa picante']
  },
  {
    nombre: 'Doble Cheddar',
    categoria: 'Hamburguesas',
    descripcion: 'Dos medallones, cuatro fetas de cheddar y cebolla',
    precio: 6800,
    destacado: true,
    disponible: true,
    ingredientes: [['Carne de hamburguesa', 2], ['Pan de hamburguesa', 1], ['Queso cheddar', 4], ['Cebolla morada', 1]],
    modificadores: ['Sin cebolla', 'Cheddar extra', 'Bacon extra', 'Huevo extra', 'Salsa picante']
  },
  {
    nombre: 'Burger Veggie',
    categoria: 'Hamburguesas',
    descripcion: 'Medallon veggie, lechuga fresca y tomate',
    precio: 5400,
    destacado: false,
    disponible: true,
    ingredientes: [['Medallon veggie', 1], ['Pan de hamburguesa', 1], ['Lechuga', 2], ['Tomate', 2]],
    modificadores: ['Sin cebolla', 'Sin tomate', 'Cheddar extra', 'Salsa picante']
  },
  {
    nombre: 'Burger BBQ',
    categoria: 'Hamburguesas',
    descripcion: 'Carne, bacon, cheddar y cebolla morada',
    precio: 6100,
    destacado: false,
    disponible: true,
    ingredientes: [['Carne de hamburguesa', 1], ['Pan de hamburguesa', 1], ['Queso cheddar', 2], ['Bacon', 1], ['Cebolla morada', 1]],
    modificadores: ['Sin cebolla', 'Sin cheddar', 'Bacon extra', 'Cheddar extra', 'Huevo extra']
  },
  {
    nombre: 'Papas Fritas',
    categoria: 'Papas',
    descripcion: 'Porcion de papas crocantes',
    precio: 1800,
    destacado: false,
    disponible: true,
    ingredientes: [['Papas congeladas', 0.25]],
    modificadores: ['Cheddar extra', 'Bacon extra']
  },
  {
    nombre: 'Papas Cheddar',
    categoria: 'Papas',
    descripcion: 'Papas fritas con cheddar fundido',
    precio: 3100,
    destacado: true,
    disponible: true,
    ingredientes: [['Papas congeladas', 0.35], ['Queso cheddar', 2]],
    modificadores: ['Bacon extra', 'Salsa picante']
  },
  {
    nombre: 'Papas Bacon y Verdeo',
    categoria: 'Papas',
    descripcion: 'Papas con cheddar, bacon y cebolla fresca',
    precio: 3600,
    destacado: true,
    disponible: true,
    ingredientes: [['Papas congeladas', 0.4], ['Queso cheddar', 2], ['Bacon', 2], ['Cebolla morada', 1]],
    modificadores: ['Cheddar extra', 'Bacon extra', 'Salsa picante']
  },
  {
    nombre: 'Papas Bravas',
    categoria: 'Papas',
    descripcion: 'Papas crocantes con salsa picante',
    precio: 2900,
    destacado: false,
    disponible: true,
    ingredientes: [['Papas congeladas', 0.35], ['Salsa de tomate', 0.05]],
    modificadores: ['Cheddar extra', 'Bacon extra']
  },
  {
    nombre: 'Nuggets de Pollo',
    categoria: 'Papas',
    descripcion: 'Nuggets crujientes con dip',
    precio: 4200,
    destacado: false,
    disponible: true,
    ingredientes: [['Pollo grillado', 1]],
    modificadores: ['Salsa picante', 'Combo papas medianas']
  },
  {
    nombre: 'Coca-Cola 500ml',
    categoria: 'Bebidas',
    descripcion: 'Gaseosa linea Coca-Cola',
    precio: 1200,
    destacado: false,
    disponible: true,
    ingredientes: [['Coca-Cola', 1]],
    modificadores: []
  },
  {
    nombre: 'Agua Mineral',
    categoria: 'Bebidas',
    descripcion: 'Botella 500ml sin gas',
    precio: 1100,
    destacado: false,
    disponible: true,
    ingredientes: [['Agua mineral 500ml', 1]],
    modificadores: []
  },
  {
    nombre: 'Limonada Menta Jengibre',
    categoria: 'Bebidas',
    descripcion: 'Limonada fresca con menta',
    precio: 1900,
    destacado: true,
    disponible: true,
    ingredientes: [['Limonada mix', 1]],
    modificadores: []
  },
  {
    nombre: 'Cerveza Rubia',
    categoria: 'Bebidas',
    descripcion: 'Lata 473ml',
    precio: 2400,
    destacado: false,
    disponible: false,
    ingredientes: [['Cerveza rubia lata', 1]],
    modificadores: []
  },
  {
    nombre: 'Ginger Ale',
    categoria: 'Bebidas',
    descripcion: 'Lata de ginger ale',
    precio: 1700,
    destacado: false,
    disponible: true,
    ingredientes: [['Ginger ale lata', 1]],
    modificadores: []
  },
  {
    nombre: 'Brownie con Helado',
    categoria: 'Postres',
    descripcion: 'Brownie tibio con bocha de vainilla',
    precio: 3200,
    destacado: true,
    disponible: true,
    ingredientes: [['Brownie base', 1], ['Helado vainilla', 1]],
    modificadores: []
  },
  {
    nombre: 'Cheesecake de Frutos Rojos',
    categoria: 'Postres',
    descripcion: 'Porcion de cheesecake con salsa roja',
    precio: 3400,
    destacado: false,
    disponible: true,
    ingredientes: [['Cheesecake porcion', 1], ['Frutos rojos', 1]],
    modificadores: []
  },
  {
    nombre: 'Flan Casero',
    categoria: 'Postres',
    descripcion: 'Flan con dulce de leche',
    precio: 2600,
    destacado: false,
    disponible: true,
    ingredientes: [['Flan casero porcion', 1]],
    modificadores: []
  },
  {
    nombre: 'Helado 2 bochas',
    categoria: 'Postres',
    descripcion: 'Helado de vainilla doble',
    precio: 2800,
    destacado: false,
    disponible: true,
    ingredientes: [['Helado vainilla', 2]],
    modificadores: []
  },
  {
    nombre: 'Pizza Margarita',
    categoria: 'Pizzas',
    descripcion: 'Margarita clasica para compartir',
    precio: 8800,
    destacado: true,
    disponible: true,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.22], ['Mozzarella', 0.3]],
    modificadores: ['Extra muzzarella', 'Borde relleno', 'Salsa picante']
  },
  {
    nombre: 'Pizza Margarita Individual',
    categoria: 'Pizzas',
    descripcion: 'Version individual',
    precio: 6900,
    destacado: false,
    disponible: true,
    productoBase: 'Pizza Margarita',
    nombreVariante: 'Individual',
    ordenVariante: 1,
    esVariantePredeterminada: false,
    multiplicadorInsumos: 0.6,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.22], ['Mozzarella', 0.3]],
    modificadores: ['Extra muzzarella', 'Borde relleno']
  },
  {
    nombre: 'Pizza Margarita Grande',
    categoria: 'Pizzas',
    descripcion: 'Version grande para grupos',
    precio: 10800,
    destacado: false,
    disponible: true,
    productoBase: 'Pizza Margarita',
    nombreVariante: 'Grande',
    ordenVariante: 2,
    esVariantePredeterminada: false,
    multiplicadorInsumos: 1.3,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.22], ['Mozzarella', 0.3]],
    modificadores: ['Extra muzzarella', 'Borde relleno']
  },
  {
    nombre: 'Pizza Pepperoni',
    categoria: 'Pizzas',
    descripcion: 'Mozzarella y pepperoni',
    precio: 9600,
    destacado: true,
    disponible: true,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.22], ['Mozzarella', 0.3], ['Pepperoni', 8]],
    modificadores: ['Extra muzzarella', 'Borde relleno']
  },
  {
    nombre: 'Pizza Pepperoni Individual',
    categoria: 'Pizzas',
    descripcion: 'Version individual pepperoni',
    precio: 7600,
    destacado: false,
    disponible: true,
    productoBase: 'Pizza Pepperoni',
    nombreVariante: 'Individual',
    ordenVariante: 1,
    esVariantePredeterminada: false,
    multiplicadorInsumos: 0.6,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.22], ['Mozzarella', 0.3], ['Pepperoni', 8]],
    modificadores: ['Extra muzzarella']
  },
  {
    nombre: 'Pizza Pepperoni Grande',
    categoria: 'Pizzas',
    descripcion: 'Version grande pepperoni',
    precio: 11600,
    destacado: false,
    disponible: true,
    productoBase: 'Pizza Pepperoni',
    nombreVariante: 'Grande',
    ordenVariante: 2,
    esVariantePredeterminada: false,
    multiplicadorInsumos: 1.3,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.22], ['Mozzarella', 0.3], ['Pepperoni', 8]],
    modificadores: ['Extra muzzarella', 'Borde relleno']
  },
  {
    nombre: 'Pizza Fugazzeta',
    categoria: 'Pizzas',
    descripcion: 'Cebolla morada y queso',
    precio: 9300,
    destacado: false,
    disponible: true,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.15], ['Mozzarella', 0.32], ['Cebolla morada', 1]],
    modificadores: ['Extra muzzarella', 'Borde relleno']
  },
  {
    nombre: 'Pizza Fugazzeta Individual',
    categoria: 'Pizzas',
    descripcion: 'Version individual fugazzeta',
    precio: 7200,
    destacado: false,
    disponible: true,
    productoBase: 'Pizza Fugazzeta',
    nombreVariante: 'Individual',
    ordenVariante: 1,
    esVariantePredeterminada: false,
    multiplicadorInsumos: 0.6,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.15], ['Mozzarella', 0.32], ['Cebolla morada', 1]],
    modificadores: ['Extra muzzarella']
  },
  {
    nombre: 'Pizza Fugazzeta Grande',
    categoria: 'Pizzas',
    descripcion: 'Version grande fugazzeta',
    precio: 11200,
    destacado: false,
    disponible: true,
    productoBase: 'Pizza Fugazzeta',
    nombreVariante: 'Grande',
    ordenVariante: 2,
    esVariantePredeterminada: false,
    multiplicadorInsumos: 1.3,
    ingredientes: [['Masa de pizza', 1], ['Salsa de tomate', 0.15], ['Mozzarella', 0.32], ['Cebolla morada', 1]],
    modificadores: ['Extra muzzarella', 'Borde relleno']
  },
  {
    nombre: 'Tacos de Pollo x2',
    categoria: 'Tacos',
    descripcion: 'Tortillas con pollo grillado y guacamole',
    precio: 5400,
    destacado: true,
    disponible: true,
    ingredientes: [['Tortilla mexicana', 2], ['Pollo grillado', 1], ['Guacamole', 1], ['Cebolla morada', 1]],
    modificadores: ['Salsa picante', 'Sin cebolla', 'Cheddar extra']
  },
  {
    nombre: 'Tacos Veggie x2',
    categoria: 'Tacos',
    descripcion: 'Hongos salteados y guacamole',
    precio: 5200,
    destacado: false,
    disponible: true,
    ingredientes: [['Tortilla mexicana', 2], ['Champinones', 0.15], ['Guacamole', 1], ['Cebolla morada', 1]],
    modificadores: ['Salsa picante', 'Sin cebolla', 'Cheddar extra']
  },
  {
    nombre: 'Tacos al Pastor x2',
    categoria: 'Tacos',
    descripcion: 'Pollo especiado con salsa roja',
    precio: 5600,
    destacado: false,
    disponible: true,
    ingredientes: [['Tortilla mexicana', 2], ['Pollo grillado', 1], ['Salsa de tomate', 0.05], ['Cebolla morada', 1]],
    modificadores: ['Salsa picante', 'Sin cebolla']
  },
  {
    nombre: 'Caesar Grill',
    categoria: 'Ensaladas',
    descripcion: 'Lechuga, pollo grillado y queso',
    precio: 5200,
    destacado: true,
    disponible: true,
    ingredientes: [['Lechuga', 3], ['Pollo grillado', 1], ['Mozzarella', 0.08]],
    modificadores: ['Sin cebolla', 'Sin tomate']
  },
  {
    nombre: 'Ensalada Mediterranea',
    categoria: 'Ensaladas',
    descripcion: 'Tomate, cebolla morada, hojas verdes y queso',
    precio: 5000,
    destacado: false,
    disponible: true,
    ingredientes: [['Lechuga', 2], ['Tomate', 3], ['Cebolla morada', 1], ['Mozzarella', 0.1]],
    modificadores: ['Sin cebolla', 'Sin tomate']
  },
  {
    nombre: 'Ensalada Burrata',
    categoria: 'Ensaladas',
    descripcion: 'Rucula, tomate y queso fresco',
    precio: 5800,
    destacado: false,
    disponible: true,
    ingredientes: [['Rucula', 1], ['Tomate', 3], ['Mozzarella', 0.12]],
    modificadores: ['Sin tomate']
  },
  {
    nombre: 'Cafe Doble',
    categoria: 'Cafeteria',
    descripcion: 'Cafe espresso doble',
    precio: 1900,
    destacado: false,
    disponible: true,
    ingredientes: [['Cafe molido', 0.04]],
    modificadores: []
  },
  {
    nombre: 'Latte',
    categoria: 'Cafeteria',
    descripcion: 'Cafe con leche entera vaporizada',
    precio: 2400,
    destacado: true,
    disponible: true,
    ingredientes: [['Cafe molido', 0.03], ['Leche entera', 0.25]],
    modificadores: []
  },
  {
    nombre: 'Capuccino',
    categoria: 'Cafeteria',
    descripcion: 'Espresso con espuma de leche',
    precio: 2600,
    destacado: false,
    disponible: true,
    ingredientes: [['Cafe molido', 0.03], ['Leche entera', 0.2]],
    modificadores: []
  },
  {
    nombre: 'Cookie XL',
    categoria: 'Cafeteria',
    descripcion: 'Cookie artesanal para compartir',
    precio: 2100,
    destacado: false,
    disponible: false,
    ingredientes: [['Cookie artesanal', 1]],
    modificadores: []
  }
];

const ensureVisualModificadores = async (prisma) => {
  for (const definition of MODIFIER_DEFINITIONS) {
    await prisma.modificador.upsert({
      where: { nombre: definition.nombre },
      update: definition,
      create: definition
    });
  }

  const modifiers = await prisma.modificador.findMany({
    select: { id: true, nombre: true }
  });

  return new Map(modifiers.map((item) => [item.nombre, item.id]));
};

const saveProductoByName = async (prisma, data) => {
  const existing = await prisma.producto.findFirst({
    where: { nombre: data.nombre }
  });

  if (existing) {
    return prisma.producto.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.producto.create({ data });
};

const ensureVisualProductos = async (prisma, categoriaIds, ingredientByName, modifierIds) => {
  const baseProducts = PRODUCT_DEFINITIONS.filter((product) => !product.productoBase);
  const variantProducts = PRODUCT_DEFINITIONS.filter((product) => product.productoBase);

  for (const product of baseProducts) {
    await saveProductoByName(prisma, {
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: MONEY(product.precio),
      categoriaId: categoriaIds.get(product.categoria),
      disponible: product.disponible !== false,
      destacado: Boolean(product.destacado),
      productoBaseId: null,
      nombreVariante: null,
      multiplicadorInsumos: MONEY(product.multiplicadorInsumos || 1),
      ordenVariante: product.ordenVariante || 0,
      esVariantePredeterminada: Boolean(product.esVariantePredeterminada)
    });
  }

  const productBaseIds = new Map((await prisma.producto.findMany({
    select: { id: true, nombre: true }
  })).map((item) => [item.nombre, item.id]));

  for (const product of variantProducts) {
    await saveProductoByName(prisma, {
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: MONEY(product.precio),
      categoriaId: categoriaIds.get(product.categoria),
      disponible: product.disponible !== false,
      destacado: Boolean(product.destacado),
      productoBaseId: productBaseIds.get(product.productoBase),
      nombreVariante: product.nombreVariante || null,
      multiplicadorInsumos: MONEY(product.multiplicadorInsumos || 1),
      ordenVariante: product.ordenVariante || 0,
      esVariantePredeterminada: Boolean(product.esVariantePredeterminada)
    });
  }

  const savedProducts = await prisma.producto.findMany({
    select: { id: true, nombre: true }
  });
  const productByName = new Map(savedProducts.map((item) => [item.nombre, item]));

  for (const product of PRODUCT_DEFINITIONS) {
    const saved = productByName.get(product.nombre);

    await prisma.productoIngrediente.deleteMany({
      where: { productoId: saved.id }
    });

    if ((product.ingredientes || []).length > 0) {
      await prisma.productoIngrediente.createMany({
        data: product.ingredientes.map(([ingredientName, cantidad]) => ({
          productoId: saved.id,
          ingredienteId: ingredientByName.get(ingredientName).id,
          cantidad: STOCK(cantidad)
        }))
      });
    }

    await prisma.productoModificador.deleteMany({
      where: { productoId: saved.id }
    });

    if ((product.modificadores || []).length > 0) {
      await prisma.productoModificador.createMany({
        data: product.modificadores.map((modifierName) => ({
          productoId: saved.id,
          modificadorId: modifierIds.get(modifierName)
        }))
      });
    }
  }

  return productByName;
};

const buildRefs = async (prisma) => {
  const [users, mesas, modifiers, categories, products, activePoint] = await prisma.$transaction([
    prisma.usuario.findMany({
      select: { id: true, email: true, nombre: true, apellido: true, rol: true, activo: true }
    }),
    prisma.mesa.findMany({
      select: { id: true, numero: true, zona: true, sucursalId: true }
    }),
    prisma.modificador.findMany({
      select: { id: true, nombre: true, precio: true }
    }),
    prisma.categoria.findMany({
      select: { id: true, nombre: true }
    }),
    prisma.producto.findMany({
      select: { id: true, nombre: true, precio: true, categoriaId: true }
    }),
    prisma.puntoVentaFiscal.findFirst({
      where: { activo: true },
      orderBy: { puntoVenta: 'asc' },
      select: { id: true, puntoVenta: true }
    })
  ]);

  return {
    usersByEmail: new Map(users.map((item) => [item.email, item])),
    mesasByNumber: new Map(mesas.map((item) => [item.numero, item])),
    modifiersByName: new Map(modifiers.map((item) => [item.nombre, item])),
    categoriesByName: new Map(categories.map((item) => [item.nombre, item])),
    productsByName: new Map(products.map((item) => [item.nombre, item])),
    puntoVentaFiscalId: activePoint?.id || null
  };
};

const createPrintBatch = async (tx, pedidoId, status, createdAt) => {
  if (!status) {
    return;
  }

  const batchId = `seed-${pedidoId}-${slugify(status)}-${createdAt.getTime()}`;
  const statusByType = {
    OK: { COCINA: 'OK', CAJA: 'OK', CLIENTE: 'OK' },
    PENDIENTE: { COCINA: 'PENDIENTE', CAJA: 'PENDIENTE', CLIENTE: 'PENDIENTE' },
    ERROR: { COCINA: 'OK', CAJA: 'ERROR', CLIENTE: 'PENDIENTE' }
  };
  const current = statusByType[status] || statusByType.PENDIENTE;

  for (const tipo of ['COCINA', 'CAJA', 'CLIENTE']) {
    const jobStatus = current[tipo];
    await tx.printJob.create({
      data: {
        pedidoId,
        tipo,
        status: jobStatus,
        intentos: jobStatus === 'ERROR' ? 2 : 0,
        maxIntentos: 3,
        nextAttemptAt: createdAt,
        lastError: jobStatus === 'ERROR' ? 'Impresora de caja sin papel (demo visual)' : null,
        contenido: `Comanda visual ${tipo} pedido #${pedidoId}`,
        batchId,
        createdAt,
        updatedAt: createdAt
      }
    });
  }
};

const buildPedidoTotals = (scenario, refs) => {
  const items = scenario.items.map((item) => {
    const producto = refs.productsByName.get(item.producto);
    const modifiers = (item.modificadores || []).map((name) => refs.modifiersByName.get(name));
    const precioMods = modifiers.reduce((sum, modifier) => sum + MONEY(modifier.precio), 0);
    const precioUnitario = MONEY(MONEY(producto.precio) + precioMods);
    const subtotal = MONEY(precioUnitario * item.cantidad);

    return {
      ...item,
      productoId: producto.id,
      precioUnitario,
      subtotal,
      modifiers
    };
  });

  const subtotal = MONEY(items.reduce((sum, item) => sum + item.subtotal, 0));
  const descuento = MONEY(scenario.descuento || 0);
  const costoEnvio = MONEY(scenario.costoEnvio || 0);
  const total = MONEY(subtotal - descuento + costoEnvio);

  return {
    items,
    subtotal,
    descuento,
    costoEnvio,
    total
  };
};

const resolvePedidoEstadoPago = (scenario, total) => {
  if (scenario.estadoPago) {
    return scenario.estadoPago;
  }

  const approvedTotal = (scenario.pagos || [])
    .filter((payment) => payment.estado === 'APROBADO')
    .reduce((sum, payment) => sum + MONEY(payment.monto), 0);

  if (approvedTotal >= total && approvedTotal > 0) {
    return 'APROBADO';
  }

  if ((scenario.pagos || []).some((payment) => payment.estado === 'RECHAZADO')) {
    return 'RECHAZADO';
  }

  return 'PENDIENTE';
};

const buildInvoicePayload = (pedido, scenario, tipoComprobante, clienteFiscal, puntoVenta) => ({
  pedidoId: pedido.id,
  tipoComprobante,
  total: pedido.total,
  estadoPedido: pedido.estado,
  mesa: pedido.mesaId ? {
    id: pedido.mesaId,
    numero: scenario.mesaNumero
  } : null,
  puntoVenta: puntoVenta ? {
    id: puntoVenta.id,
    puntoVenta: puntoVenta.puntoVenta,
    ambiente: 'homologacion'
  } : null,
  clienteFiscal,
  items: scenario.items.map((item) => ({
    producto: item.producto,
    cantidad: item.cantidad
  }))
});

const createPedidoScenario = async (prisma, refs, scenario) => {
  const totals = buildPedidoTotals(scenario, refs);
  const createdAt = scenario.createdAt;
  const updatedAt = scenario.updatedAt || addMinutes(createdAt, 15);
  const mesa = scenario.mesaNumero ? refs.mesasByNumber.get(scenario.mesaNumero) : null;
  const usuario = scenario.usuarioEmail ? refs.usersByEmail.get(normalizeEmail(scenario.usuarioEmail)) : null;
  const repartidor = scenario.repartidorEmail ? refs.usersByEmail.get(normalizeEmail(scenario.repartidorEmail)) : null;
  const sucursalId = mesa?.sucursalId
    || scenario.sucursalId
    || (scenario.tipo === 'DELIVERY' ? SUCURSAL_IDS.DELIVERY : SUCURSAL_IDS.SALON);
  const estadoPago = resolvePedidoEstadoPago(scenario, totals.total);

  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.create({
      data: {
        tipo: scenario.tipo,
        estado: scenario.estado,
        sucursalId,
        mesaId: mesa?.id || null,
        usuarioId: usuario?.id || null,
        clienteNombre: scenario.clienteNombre || null,
        clienteTelefono: scenario.clienteTelefono || null,
        clienteDireccion: scenario.clienteDireccion || null,
        clienteEmail: scenario.clienteEmail || null,
        repartidorId: repartidor?.id || null,
        tipoEntrega: scenario.tipoEntrega || null,
        costoEnvio: totals.costoEnvio,
        subtotal: totals.subtotal,
        descuento: totals.descuento,
        total: totals.total,
        observaciones: scenario.observaciones || null,
        estadoPago,
        origen: scenario.origen || 'INTERNO',
        impreso: scenario.printStatus === 'OK',
        createdAt,
        updatedAt
      }
    });

    for (const item of totals.items) {
      await tx.pedidoItem.create({
        data: {
          pedidoId: pedido.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          observaciones: item.observaciones || null,
          createdAt
        }
      });
    }

    const pedidoItems = await tx.pedidoItem.findMany({
      where: { pedidoId: pedido.id },
      orderBy: { id: 'asc' },
      select: { id: true }
    });

    for (let index = 0; index < totals.items.length; index += 1) {
      const item = totals.items[index];
      const pedidoItem = pedidoItems[index];

      if (!pedidoItem || !item.modifiers.length) {
        continue;
      }

      await tx.pedidoItemModificador.createMany({
        data: item.modifiers.map((modifier) => ({
          pedidoItemId: pedidoItem.id,
          modificadorId: modifier.id,
          precio: MONEY(modifier.precio)
        }))
      });
    }

    for (const [paymentIndex, payment] of (scenario.pagos || []).entries()) {
      const pagoCreatedAt = payment.createdAt || addMinutes(createdAt, 20 + paymentIndex * 4);
      const pago = await tx.pago.create({
        data: {
          pedidoId: pedido.id,
          monto: MONEY(payment.monto),
          metodo: payment.metodo,
          canalCobro: payment.canalCobro || 'CAJA',
          estado: payment.estado || 'APROBADO',
          referencia: payment.referencia || null,
          comprobante: payment.comprobante || null,
          propinaMonto: MONEY(payment.propinaMonto || 0),
          propinaMetodo: payment.propinaMetodo || null,
          mpPreferenceId: payment.mpPreferenceId || null,
          mpPaymentId: payment.mpPaymentId || null,
          montoAbonado: payment.montoAbonado === undefined ? null : MONEY(payment.montoAbonado),
          vuelto: payment.vuelto === undefined ? null : MONEY(payment.vuelto),
          idempotencyKey: payment.idempotencyKey || null,
          createdAt: pagoCreatedAt,
          updatedAt: payment.updatedAt || pagoCreatedAt
        }
      });

      if (payment.transaccionMercadoPago) {
        await tx.transaccionMercadoPago.create({
          data: {
            pagoId: pago.id,
            mpPaymentId: payment.transaccionMercadoPago.mpPaymentId,
            mpPreferenceId: payment.transaccionMercadoPago.mpPreferenceId || payment.mpPreferenceId || null,
            status: payment.transaccionMercadoPago.status,
            statusDetail: payment.transaccionMercadoPago.statusDetail || null,
            amount: MONEY(payment.transaccionMercadoPago.amount || payment.monto),
            currency: payment.transaccionMercadoPago.currency || 'ARS',
            payerEmail: payment.transaccionMercadoPago.payerEmail || scenario.clienteEmail || null,
            paymentMethod: payment.transaccionMercadoPago.paymentMethod || 'account_money',
            paymentTypeId: payment.transaccionMercadoPago.paymentTypeId || 'digital_wallet',
            installments: payment.transaccionMercadoPago.installments || 1,
            fee: payment.transaccionMercadoPago.fee === undefined ? null : MONEY(payment.transaccionMercadoPago.fee),
            netAmount: payment.transaccionMercadoPago.netAmount === undefined
              ? null
              : MONEY(payment.transaccionMercadoPago.netAmount),
            externalReference: payment.transaccionMercadoPago.externalReference || `pedido-${pedido.id}`,
            rawData: payment.transaccionMercadoPago.rawData || null,
            createdAt: payment.transaccionMercadoPago.createdAt || pagoCreatedAt
          }
        });
      }
    }

    if (scenario.comprobante) {
      let clienteFiscalId = null;
      let payloadCliente = null;

      if (scenario.comprobante.clienteFiscal) {
        const clienteFiscal = await tx.clienteFiscal.create({
          data: {
            nombre: scenario.comprobante.clienteFiscal.nombre,
            tipoDocumento: scenario.comprobante.clienteFiscal.tipoDocumento || null,
            numeroDocumento: scenario.comprobante.clienteFiscal.numeroDocumento || null,
            cuit: scenario.comprobante.clienteFiscal.cuit || null,
            condicionIva: scenario.comprobante.clienteFiscal.condicionIva || null,
            email: scenario.comprobante.clienteFiscal.email || null,
            domicilioFiscal: scenario.comprobante.clienteFiscal.domicilioFiscal || null
          }
        });

        clienteFiscalId = clienteFiscal.id;
        payloadCliente = scenario.comprobante.clienteFiscal;
      }

      await tx.comprobanteFiscal.create({
        data: {
          pedidoId: pedido.id,
          clienteFiscalId,
          puntoVentaFiscalId: refs.puntoVentaFiscalId,
          tipoComprobante: scenario.comprobante.tipoComprobante,
          numeroComprobante: scenario.comprobante.numeroComprobante || null,
          cae: scenario.comprobante.cae || null,
          caeVencimiento: scenario.comprobante.caeVencimiento || null,
          estado: scenario.comprobante.estado,
          observaciones: scenario.comprobante.observaciones || null,
          payload: buildInvoicePayload(
            pedido,
            scenario,
            scenario.comprobante.tipoComprobante,
            payloadCliente,
            refs.puntoVentaFiscalId ? { id: refs.puntoVentaFiscalId, puntoVenta: 1 } : null
          ),
          respuestaArca: scenario.comprobante.respuestaArca || null,
          createdAt: scenario.comprobante.createdAt || addMinutes(updatedAt, 5),
          updatedAt: scenario.comprobante.updatedAt || addMinutes(updatedAt, 5)
        }
      });
    }

    await createPrintBatch(tx, pedido.id, scenario.printStatus, createdAt);

    return { pedidoId: pedido.id };
  });
};

const buildLiveScenarios = (baseNow, roleEmails = buildRoleEmailSets()) => [
  {
    key: 'mesa-1-pendiente',
    tipo: 'MESA',
    estado: 'PENDIENTE',
    mesaNumero: 1,
    usuarioEmail: 'mozo@comanda.local',
    observaciones: 'Cliente apurado. Sale primero la bebida.',
    createdAt: addMinutes(baseNow, -25),
    updatedAt: addMinutes(baseNow, -12),
    printStatus: 'PENDIENTE',
    items: [
      { producto: 'Hamburguesa Clasica', cantidad: 2, modificadores: ['Cheddar extra'], observaciones: 'Una sin tomate' },
      { producto: 'Papas Cheddar', cantidad: 1, modificadores: ['Bacon extra'] },
      { producto: 'Coca-Cola 500ml', cantidad: 2 }
    ]
  },
  {
    key: 'mesa-2-preparacion',
    tipo: 'MESA',
    estado: 'EN_PREPARACION',
    mesaNumero: 2,
    usuarioEmail: 'mozo2@comanda.local',
    observaciones: 'Pedir salsa aparte.',
    createdAt: addMinutes(baseNow, -45),
    updatedAt: addMinutes(baseNow, -18),
    printStatus: 'OK',
    items: [
      { producto: 'Pizza Pepperoni', cantidad: 1, modificadores: ['Extra muzzarella'] },
      { producto: 'Ginger Ale', cantidad: 2 }
    ]
  },
  {
    key: 'mesa-3-listo',
    tipo: 'MESA',
    estado: 'LISTO',
    mesaNumero: 3,
    usuarioEmail: roleEmails.tertiaryMozo,
    observaciones: 'Mesa de cumpleaños.',
    createdAt: addMinutes(baseNow, -60),
    updatedAt: addMinutes(baseNow, -9),
    printStatus: 'ERROR',
    items: [
      { producto: 'Burger BBQ', cantidad: 2, modificadores: ['Bacon extra', 'Huevo extra'] },
      { producto: 'Papas Bacon y Verdeo', cantidad: 1 },
      { producto: 'Limonada Menta Jengibre', cantidad: 2 }
    ]
  },
  {
    key: 'mesa-4-esperando-cuenta',
    tipo: 'MESA',
    estado: 'ENTREGADO',
    mesaNumero: 4,
    usuarioEmail: 'mozo2@comanda.local',
    observaciones: 'Prefieren pagar por transferencia a alias.',
    createdAt: addMinutes(baseNow, -80),
    updatedAt: addMinutes(baseNow, -4),
    printStatus: 'OK',
    items: [
      { producto: 'Tacos de Pollo x2', cantidad: 1, modificadores: ['Salsa picante'] },
      { producto: 'Agua Mineral', cantidad: 1 },
      { producto: 'Brownie con Helado', cantidad: 1 }
    ]
  },
  {
    key: 'mesa-7-manual',
    tipo: 'MESA',
    estado: 'PENDIENTE',
    mesaNumero: 7,
    clienteNombre: 'Mesa 7 Manual',
    observaciones: 'Pedido manual de salon para pruebas visuales.',
    createdAt: addMinutes(baseNow, -16),
    updatedAt: addMinutes(baseNow, -8),
    printStatus: 'PENDIENTE',
    items: [
      { producto: 'Pizza Margarita Individual', cantidad: 1 },
      { producto: 'Latte', cantidad: 1 }
    ]
  },
  {
    key: 'delivery-1-pendiente',
    tipo: 'DELIVERY',
    estado: 'PENDIENTE',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: 'cajero@comanda.local',
    repartidorEmail: 'delivery@comanda.local',
    clienteNombre: 'Lucia Herrera',
    clienteTelefono: '1160011001',
    clienteDireccion: 'Av. Corrientes 1001',
    clienteEmail: 'lucia@example.com',
    costoEnvio: 900,
    observaciones: 'Tocar timbre 3B.',
    createdAt: addMinutes(baseNow, -22),
    updatedAt: addMinutes(baseNow, -6),
    printStatus: 'OK',
    items: [
      { producto: 'Hamburguesa con Queso', cantidad: 2, modificadores: ['Cheddar extra'] },
      { producto: 'Papas Fritas', cantidad: 1 },
      { producto: 'Coca-Cola 500ml', cantidad: 2 }
    ]
  },
  {
    key: 'delivery-2-preparacion',
    tipo: 'DELIVERY',
    estado: 'EN_PREPARACION',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: roleEmails.secondaryCajero,
    repartidorEmail: 'delivery@comanda.local',
    clienteNombre: 'Ezequiel Nunez',
    clienteTelefono: '1160011002',
    clienteDireccion: 'Billinghurst 2231',
    costoEnvio: 700,
    observaciones: 'Sin cebolla en todos.',
    createdAt: addMinutes(baseNow, -35),
    updatedAt: addMinutes(baseNow, -10),
    printStatus: 'OK',
    items: [
      { producto: 'Burger Veggie', cantidad: 1, modificadores: ['Sin tomate'] },
      { producto: 'Tacos Veggie x2', cantidad: 1, modificadores: ['Sin cebolla'] },
      { producto: 'Agua Mineral', cantidad: 2 }
    ]
  },
  {
    key: 'delivery-3-listo',
    tipo: 'DELIVERY',
    estado: 'LISTO',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: 'cajero@comanda.local',
    repartidorEmail: 'delivery@comanda.local',
    clienteNombre: 'Milagros Soto',
    clienteTelefono: '1160011003',
    clienteDireccion: 'Sarmiento 801',
    costoEnvio: 800,
    observaciones: 'Dejar con seguridad.',
    createdAt: addMinutes(baseNow, -55),
    updatedAt: addMinutes(baseNow, -3),
    printStatus: 'OK',
    items: [
      { producto: 'Pizza Pepperoni Grande', cantidad: 1, modificadores: ['Borde relleno'] },
      { producto: 'Ginger Ale', cantidad: 1 }
    ]
  },
  {
    key: 'delivery-4-listo-delivery2',
    tipo: 'DELIVERY',
    estado: 'LISTO',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: roleEmails.secondaryCajero,
    repartidorEmail: roleEmails.secondaryDelivery,
    clienteNombre: 'Marina Aguilar',
    clienteTelefono: '1160011004',
    clienteDireccion: 'Malabia 1440',
    costoEnvio: 850,
    createdAt: addMinutes(baseNow, -48),
    updatedAt: addMinutes(baseNow, -2),
    printStatus: 'OK',
    items: [
      { producto: 'Bacon Smash', cantidad: 1 },
      { producto: 'Papas Cheddar', cantidad: 1 },
      { producto: 'Limonada Menta Jengibre', cantidad: 1 }
    ]
  },
  {
    key: 'delivery-5-unassigned',
    tipo: 'DELIVERY',
    estado: 'PENDIENTE',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: 'cajero@comanda.local',
    clienteNombre: 'Pedro Vidal',
    clienteTelefono: '1160011005',
    clienteDireccion: 'Parana 455',
    costoEnvio: 750,
    observaciones: 'Llamar antes de subir.',
    createdAt: addMinutes(baseNow, -12),
    updatedAt: addMinutes(baseNow, -11),
    printStatus: 'PENDIENTE',
    items: [
      { producto: 'Tacos al Pastor x2', cantidad: 1, modificadores: ['Salsa picante'] },
      { producto: 'Agua Mineral', cantidad: 1 }
    ]
  },
  {
    key: 'mostrador-pendiente',
    tipo: 'MOSTRADOR',
    estado: 'PENDIENTE',
    usuarioEmail: 'cajero@comanda.local',
    clienteNombre: 'Take Away 1',
    tipoEntrega: 'RETIRO',
    createdAt: addMinutes(baseNow, -9),
    updatedAt: addMinutes(baseNow, -7),
    printStatus: 'PENDIENTE',
    items: [
      { producto: 'Cafe Doble', cantidad: 2 },
      { producto: 'Cookie XL', cantidad: 1 }
    ]
  },
  {
    key: 'mostrador-preparacion',
    tipo: 'MOSTRADOR',
    estado: 'EN_PREPARACION',
    usuarioEmail: roleEmails.secondaryCajero,
    clienteNombre: 'Take Away 2',
    tipoEntrega: 'RETIRO',
    createdAt: addMinutes(baseNow, -18),
    updatedAt: addMinutes(baseNow, -5),
    printStatus: 'OK',
    items: [
      { producto: 'Latte', cantidad: 1 },
      { producto: 'Brownie con Helado', cantidad: 1 }
    ]
  },
  {
    key: 'mostrador-cobrado',
    tipo: 'MOSTRADOR',
    estado: 'COBRADO',
    usuarioEmail: 'cajero@comanda.local',
    clienteNombre: 'Take Away 3',
    tipoEntrega: 'RETIRO',
    createdAt: addHours(startOfDay(baseNow), 14),
    updatedAt: addHours(startOfDay(baseNow), 14.6),
    printStatus: 'OK',
    pagos: [{ monto: 6000, metodo: 'EFECTIVO', canalCobro: 'CAJA', estado: 'APROBADO', montoAbonado: 6500, vuelto: 500 }],
    items: [
      { producto: 'Capuccino', cantidad: 1 },
      { producto: 'Cheesecake de Frutos Rojos', cantidad: 1 }
    ]
  },
  {
    key: 'mesa-6-cerrado',
    tipo: 'MESA',
    estado: 'CERRADO',
    mesaNumero: 6,
    usuarioEmail: 'mozo@comanda.local',
    createdAt: addHours(startOfDay(baseNow), 13),
    updatedAt: addHours(startOfDay(baseNow), 14),
    printStatus: 'OK',
    pagos: [{ monto: 8100, metodo: 'EFECTIVO', canalCobro: 'CAJA', estado: 'APROBADO', montoAbonado: 9000, vuelto: 900 }],
    items: [
      { producto: 'Doble Cheddar', cantidad: 1 },
      { producto: 'Papas Fritas', cantidad: 1 }
    ]
  },
  {
    key: 'delivery-menu-publico-aprobado',
    tipo: 'DELIVERY',
    estado: 'CERRADO',
    origen: 'MENU_PUBLICO',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: 'cajero@comanda.local',
    clienteNombre: 'Valentina Publica',
    clienteTelefono: '1160011006',
    clienteDireccion: 'Av. Santa Fe 990',
    clienteEmail: 'valentina.publica@example.com',
    costoEnvio: 900,
    createdAt: addHours(startOfDay(baseNow), 15),
    updatedAt: addHours(startOfDay(baseNow), 16.2),
    printStatus: 'OK',
    pagos: [{
      monto: 11700,
      metodo: 'MERCADOPAGO',
      canalCobro: 'CHECKOUT_WEB',
      estado: 'APROBADO',
      referencia: 'pedido-web-1',
      mpPreferenceId: 'pref-web-1',
      mpPaymentId: 'mp-web-1',
      transaccionMercadoPago: {
        mpPaymentId: 'seed-mp-approved-1',
        mpPreferenceId: 'pref-web-1',
        status: 'approved',
        statusDetail: 'accredited',
        amount: 11700,
        fee: 936,
        netAmount: 10764,
        externalReference: 'pedido-web-1'
      }
    }],
    comprobante: {
      tipoComprobante: 'FACTURA_B',
      estado: 'AUTORIZADO',
      numeroComprobante: '0001-00001021',
      cae: '61234567891234',
      caeVencimiento: addDays(baseNow, 10),
      clienteFiscal: {
        nombre: 'Valentina Publica',
        tipoDocumento: 'DNI',
        numeroDocumento: '35111222',
        condicionIva: 'Consumidor Final',
        email: 'valentina.publica@example.com',
        domicilioFiscal: 'Av. Santa Fe 990'
      }
    },
    items: [{ producto: 'Pizza Margarita Grande', cantidad: 1, modificadores: ['Extra muzzarella'] }]
  },
  {
    key: 'mesa-8-factura-observada',
    tipo: 'MESA',
    estado: 'COBRADO',
    mesaNumero: 8,
    usuarioEmail: roleEmails.tertiaryMozo,
    createdAt: addHours(startOfDay(baseNow), 16),
    updatedAt: addHours(startOfDay(baseNow), 17),
    printStatus: 'OK',
    pagos: [{ monto: 12000, metodo: 'MERCADOPAGO', canalCobro: 'CAJA', estado: 'APROBADO' }],
    comprobante: {
      tipoComprobante: 'FACTURA_B',
      estado: 'AUTORIZADO_CON_OBSERVACIONES',
      numeroComprobante: '0001-00001022',
      cae: '61234567891235',
      caeVencimiento: addDays(baseNow, 10),
      observaciones: 'CAE emitido con observaciones del domicilio.',
      clienteFiscal: {
        nombre: 'Mesa Ocho SRL',
        tipoDocumento: 'CUIT',
        numeroDocumento: '30722223331',
        cuit: '30722223331',
        condicionIva: 'Responsable Inscripto',
        domicilioFiscal: 'Dorrego 1211'
      }
    },
    items: [
      { producto: 'Pizza Fugazzeta', cantidad: 1 },
      { producto: 'Coca-Cola 500ml', cantidad: 2 }
    ]
  },
  {
    key: 'delivery-rejected-mp',
    tipo: 'DELIVERY',
    estado: 'CANCELADO',
    origen: 'MENU_PUBLICO',
    tipoEntrega: 'DELIVERY',
    usuarioEmail: roleEmails.secondaryCajero,
    clienteNombre: 'Pedido Rechazado',
    clienteTelefono: '1160011007',
    clienteDireccion: 'Gurruchaga 1400',
    clienteEmail: 'rechazado@example.com',
    costoEnvio: 700,
    createdAt: addHours(startOfDay(baseNow), 12.5),
    updatedAt: addHours(startOfDay(baseNow), 13),
    printStatus: null,
    estadoPago: 'RECHAZADO',
    pagos: [{
      monto: 7200,
      metodo: 'MERCADOPAGO',
      canalCobro: 'CHECKOUT_WEB',
      estado: 'RECHAZADO',
      referencia: 'pedido-web-reject-1',
      mpPreferenceId: 'pref-web-reject-1',
      mpPaymentId: 'mp-web-reject-1',
      transaccionMercadoPago: {
        mpPaymentId: 'seed-mp-rejected-1',
        mpPreferenceId: 'pref-web-reject-1',
        status: 'rejected',
        statusDetail: 'cc_rejected_call_for_authorize',
        amount: 7200,
        fee: 0,
        netAmount: 0,
        externalReference: 'pedido-web-reject-1'
      }
    }],
    items: [
      { producto: 'Burger Veggie', cantidad: 1 },
      { producto: 'Agua Mineral', cantidad: 1 }
    ]
  }
];

const HISTORICAL_NAMES = ['Camila Torres', 'Martin Suarez', 'Rocio Molina', 'Tomas Luna', 'Paula Gomez', 'Santiago Vera', 'Luciana Castro', 'Bruno Arias', 'Nadia Roldan', 'Federico Paz'];
const HISTORICAL_ADDRESSES = ['Araoz 1120', 'Guemes 4200', 'Cordoba 3901', 'Jufre 1777', 'Scalabrini Ortiz 2020', 'Lavalleja 101'];

const buildHistoricalScenarios = (refs, baseNow, roleEmails = buildRoleEmailSets()) => {
  const random = createSeededRandom(VISUAL_SEED_RANDOM);
  const mozos = roleEmails.historicalMozos;
  const cajeros = roleEmails.historicalCajeros;
  const repartidores = roleEmails.historicalRepartidores;
  const mesaNumbers = [1, 2, 3, 7, 8, 9, 10, 11, 12];
  const productPool = {
    MESA: ['Hamburguesa Clasica', 'Hamburguesa con Queso', 'Bacon Smash', 'Pizza Margarita', 'Pizza Pepperoni', 'Pizza Fugazzeta', 'Papas Cheddar', 'Brownie con Helado', 'Limonada Menta Jengibre'],
    DELIVERY: ['Burger BBQ', 'Burger Veggie', 'Pizza Pepperoni Grande', 'Tacos de Pollo x2', 'Tacos al Pastor x2', 'Papas Fritas', 'Agua Mineral', 'Coca-Cola 500ml'],
    MOSTRADOR: ['Cafe Doble', 'Latte', 'Capuccino', 'Brownie con Helado', 'Cheesecake de Frutos Rojos', 'Papas Fritas']
  };
  const modifierSamples = {
    'Hamburguesa Clasica': ['Cheddar extra', 'Sin tomate'],
    'Hamburguesa con Queso': ['Bacon extra'],
    'Bacon Smash': ['Huevo extra'],
    'Burger BBQ': ['Sin cebolla'],
    'Burger Veggie': ['Salsa picante'],
    'Pizza Margarita': ['Extra muzzarella'],
    'Pizza Pepperoni': ['Borde relleno'],
    'Pizza Fugazzeta': ['Extra muzzarella'],
    'Tacos de Pollo x2': ['Salsa picante'],
    'Tacos al Pastor x2': ['Sin cebolla'],
    'Papas Cheddar': ['Bacon extra'],
    'Papas Fritas': ['Cheddar extra']
  };
  const scenarios = [];

  for (let day = 1; day <= 7; day += 1) {
    for (let index = 0; index < 6; index += 1) {
      const tipo = pickOne(random, ['MESA', 'MESA', 'DELIVERY', 'DELIVERY', 'MOSTRADOR']);
      const createdAt = addMinutes(addHours(startOfDay(addDays(baseNow, -day)), randomInt(random, 11, 22)), randomInt(random, 0, 59));
      const usuarioEmail = tipo === 'MESA' ? pickOne(random, mozos) : pickOne(random, cajeros);
      const itemNames = pickManyUnique(random, productPool[tipo], randomInt(random, 2, tipo === 'MOSTRADOR' ? 3 : 4));

      scenarios.push({
        key: `historico-${day}-${index}`,
        tipo,
        estado: index % 3 !== 0 ? 'CERRADO' : 'COBRADO',
        origen: tipo === 'DELIVERY' && random() > 0.7 ? 'MENU_PUBLICO' : 'INTERNO',
        mesaNumero: tipo === 'MESA' ? pickOne(random, mesaNumbers) : undefined,
        usuarioEmail,
        repartidorEmail: tipo === 'DELIVERY' ? pickOne(random, repartidores) : undefined,
        clienteNombre: tipo === 'MOSTRADOR' ? `Retiro ${day}-${index}` : pickOne(random, HISTORICAL_NAMES),
        clienteTelefono: tipo === 'DELIVERY' ? `1160${day}${index}120` : null,
        clienteDireccion: tipo === 'DELIVERY' ? pickOne(random, HISTORICAL_ADDRESSES) : null,
        clienteEmail: tipo === 'DELIVERY' ? `hist-${day}-${index}@example.com` : null,
        tipoEntrega: tipo === 'DELIVERY' ? 'DELIVERY' : (tipo === 'MOSTRADOR' ? 'RETIRO' : null),
        costoEnvio: tipo === 'DELIVERY' ? MONEY(randomInt(random, 650, 950)) : 0,
        descuento: random() > 0.75 ? MONEY(randomInt(random, 300, 900)) : 0,
        observaciones: random() > 0.82 ? 'Sin contacto. Dejar en recepcion.' : null,
        createdAt,
        updatedAt: addMinutes(createdAt, randomInt(random, 30, 120)),
        printStatus: random() > 0.92 ? 'ERROR' : 'OK',
        items: itemNames.map((name) => ({
          producto: name,
          cantidad: randomInt(random, 1, name.startsWith('Pizza') ? 2 : 3),
          modificadores: modifierSamples[name] && random() > 0.55 ? [pickOne(random, modifierSamples[name])] : []
        }))
      });
    }
  }

  return scenarios.map((scenario, index) => {
    const totals = buildPedidoTotals(scenario, refs);
    const methodRandom = createSeededRandom(VISUAL_SEED_RANDOM + index);
    const paymentMethod = scenario.tipo === 'MOSTRADOR' && index % 4 === 0
      ? 'EFECTIVO'
      : pickOne(methodRandom, ['EFECTIVO', 'MERCADOPAGO']);
    const paymentCreatedAt = addMinutes(scenario.createdAt, 45);
    const pagos = [];

    if (index % 5 === 0) {
      const firstMonto = MONEY(totals.total * 0.6);
      pagos.push({ monto: firstMonto, metodo: paymentMethod, canalCobro: paymentMethod === 'MERCADOPAGO' ? 'CHECKOUT_WEB' : 'CAJA', estado: 'APROBADO', createdAt: paymentCreatedAt });
      pagos.push({
        monto: MONEY(totals.total - firstMonto),
        metodo: paymentMethod === 'EFECTIVO' ? 'MERCADOPAGO' : 'EFECTIVO',
        canalCobro: 'CAJA',
        estado: 'APROBADO',
        createdAt: addMinutes(paymentCreatedAt, 8),
        montoAbonado: paymentMethod === 'EFECTIVO' ? MONEY(totals.total - firstMonto + 300) : undefined,
        vuelto: paymentMethod === 'EFECTIVO' ? 300 : undefined
      });
    } else {
      pagos.push({
        monto: totals.total,
        metodo: paymentMethod,
        canalCobro: paymentMethod === 'MERCADOPAGO' ? 'CHECKOUT_WEB' : 'CAJA',
        estado: 'APROBADO',
        createdAt: paymentCreatedAt,
        montoAbonado: paymentMethod === 'EFECTIVO' ? MONEY(totals.total + 500) : undefined,
        vuelto: paymentMethod === 'EFECTIVO' ? 500 : undefined
      });
    }

    if (paymentMethod === 'MERCADOPAGO') {
      const lastPago = pagos[pagos.length - 1];
      lastPago.referencia = `hist-web-${index}`;
      lastPago.mpPreferenceId = `hist-pref-${index}`;
      lastPago.mpPaymentId = `hist-mp-${index}`;
      lastPago.transaccionMercadoPago = {
        mpPaymentId: `seed-mp-hist-${index}`,
        mpPreferenceId: `hist-pref-${index}`,
        status: 'approved',
        statusDetail: 'accredited',
        amount: totals.total,
        fee: MONEY(totals.total * 0.08),
        netAmount: MONEY(totals.total * 0.92),
        externalReference: `hist-web-${index}`,
        createdAt: paymentCreatedAt
      };
    }

    const invoiceCandidates = [
      { tipoComprobante: 'FACTURA_B', estado: 'PENDIENTE_CONFIGURACION_ARCA', observaciones: 'Pendiente de configurar ARCA en demo visual.' },
      { tipoComprobante: 'FACTURA_B', estado: 'ERROR_ARCA', observaciones: 'Tiempo de espera agotado en homologacion.' },
      { tipoComprobante: 'CONSUMIDOR_FINAL', estado: 'RECHAZADO_ARCA', observaciones: 'Documento invalido informado en demo.' }
    ];

    return {
      ...scenario,
      pagos,
      comprobante: index < invoiceCandidates.length
        ? {
            ...invoiceCandidates[index],
            clienteFiscal: {
              nombre: scenario.clienteNombre || `Cliente ${index}`,
              tipoDocumento: index === 2 ? 'Consumidor Final' : 'DNI',
              numeroDocumento: index === 2 ? '0' : `34${index}1122`,
              condicionIva: 'Consumidor Final',
              domicilioFiscal: scenario.clienteDireccion || 'Sin domicilio'
            },
            createdAt: addMinutes(paymentCreatedAt, 4)
          }
        : null
    };
  });
};

const seedReservas = async (prisma, refs, baseNow) => {
  const reservas = [
    { mesaNumero: 5, clienteNombre: 'Reserva inmediata', clienteTelefono: '1167001001', fechaHora: addMinutes(baseNow, 18), cantidadPersonas: 4, estado: 'CONFIRMADA', observaciones: 'Celebracion familiar' },
    { mesaNumero: 11, clienteNombre: 'Reserva VIP', clienteTelefono: '1167001002', fechaHora: addMinutes(baseNow, 26), cantidadPersonas: 6, estado: 'CONFIRMADA', observaciones: 'Traen torta' },
    { mesaNumero: 9, clienteNombre: 'Cumple Patio', clienteTelefono: '1167001003', fechaHora: addHours(baseNow, 2), cantidadPersonas: 6, estado: 'CONFIRMADA', observaciones: 'Sillas extra' },
    { mesaNumero: 10, clienteNombre: 'Presente temprano', clienteTelefono: '1167001004', fechaHora: addMinutes(baseNow, -15), cantidadPersonas: 5, estado: 'CLIENTE_PRESENTE', observaciones: 'Esperando menu' },
    { mesaNumero: 12, clienteNombre: 'Corporativa', clienteTelefono: '1167001005', fechaHora: addHours(baseNow, 4), cantidadPersonas: 8, estado: 'CONFIRMADA' },
    { mesaNumero: 2, clienteNombre: 'No llego mediodia', clienteTelefono: '1167001006', fechaHora: addHours(baseNow, -5), cantidadPersonas: 3, estado: 'NO_LLEGO' },
    { mesaNumero: 3, clienteNombre: 'Cancelada noche', clienteTelefono: '1167001007', fechaHora: addHours(baseNow, 5), cantidadPersonas: 4, estado: 'CANCELADA' },
    { mesaNumero: 7, clienteNombre: 'Reserva manana', clienteTelefono: '1167001008', fechaHora: addHours(baseNow, 20), cantidadPersonas: 2, estado: 'CONFIRMADA' },
    { mesaNumero: 1, clienteNombre: 'Reserva ayer', clienteTelefono: '1167001009', fechaHora: addHours(addDays(baseNow, -1), -1), cantidadPersonas: 4, estado: 'CLIENTE_PRESENTE' },
    { mesaNumero: 4, clienteNombre: 'Reserva brunch', clienteTelefono: '1167001010', fechaHora: addDays(baseNow, 1), cantidadPersonas: 2, estado: 'CONFIRMADA' },
    { mesaNumero: 8, clienteNombre: 'Reserva patio', clienteTelefono: '1167001011', fechaHora: addDays(baseNow, 2), cantidadPersonas: 4, estado: 'CONFIRMADA' },
    { mesaNumero: 6, clienteNombre: 'Anulada cliente', clienteTelefono: '1167001012', fechaHora: addHours(baseNow, -10), cantidadPersonas: 2, estado: 'CANCELADA' }
  ];

  for (const reserva of reservas) {
    const mesa = refs.mesasByNumber.get(reserva.mesaNumero);
    await prisma.reserva.create({
      data: {
        mesaId: mesa.id,
        clienteNombre: reserva.clienteNombre,
        clienteTelefono: reserva.clienteTelefono || null,
        fechaHora: reserva.fechaHora,
        cantidadPersonas: reserva.cantidadPersonas,
        estado: reserva.estado,
        observaciones: reserva.observaciones || null
      }
    });
  }
};

const seedFichajes = async (prisma, refs, baseNow) => {
  const activeUsers = ['mozo@comanda.local', 'mozo2@comanda.local', 'cocinero@comanda.local', 'cajero@comanda.local', 'delivery@comanda.local'];

  for (let day = 0; day < 7; day += 1) {
    const fecha = startOfDay(addDays(baseNow, -day));
    const isToday = day === 0;

    for (const email of activeUsers) {
      const user = refs.usersByEmail.get(normalizeEmail(email));
      const entrada = addHours(fecha, 10 + (day % 2));
      const salida = isToday ? null : addHours(entrada, 8 + (day % 3));

      await prisma.fichaje.create({
        data: {
          usuarioId: user.id,
          entrada,
          salida,
          fecha
        }
      });
    }
  }
};

const seedCierresCaja = async (prisma, refs, baseNow) => {
  const cajaOwner = refs.usersByEmail.get(normalizeEmail('cajero@comanda.local'));
  const startToday = startOfDay(baseNow);
  const historical = [
    { dayOffset: -3, apertura: 10, cierre: 23, fondoInicial: 35000, efectivo: 162500, mp: 176600, fisico: 197000, diferencia: -500 },
    { dayOffset: -2, apertura: 10, cierre: 23, fondoInicial: 36000, efectivo: 154200, mp: 182750, fisico: 190800, diferencia: 600 },
    { dayOffset: -1, apertura: 10, cierre: 23, fondoInicial: 36000, efectivo: 148900, mp: 171000, fisico: 184500, diferencia: -400 },
    { dayOffset: -7, apertura: 10, cierre: 22, fondoInicial: 32000, efectivo: 132300, mp: 145600, fisico: 163900, diferencia: -400 }
  ];

  for (const caja of historical) {
    const fecha = startOfDay(addDays(baseNow, caja.dayOffset));
    await prisma.cierreCaja.create({
      data: {
        usuarioId: cajaOwner.id,
        fecha,
        horaApertura: addHours(fecha, caja.apertura),
        horaCierre: addHours(fecha, caja.cierre),
        fondoInicial: MONEY(caja.fondoInicial),
        totalEfectivo: MONEY(caja.efectivo),
        totalMP: MONEY(caja.mp),
        efectivoFisico: MONEY(caja.fisico),
        diferencia: MONEY(caja.diferencia),
        estado: 'CERRADO',
        observaciones: 'Cierre historico de demo visual',
        createdAt: addHours(fecha, caja.cierre),
        updatedAt: addHours(fecha, caja.cierre)
      }
    });
  }

  await prisma.cierreCaja.create({
    data: {
      usuarioId: cajaOwner.id,
      fecha: startToday,
      horaApertura: addHours(startToday, 9),
      fondoInicial: 40000,
      estado: 'ABIERTO',
      observaciones: 'Caja abierta para demo visual'
    }
  });
};

const applyMesaStates = async (prisma, refs, baseNow) => {
  const stateByMesa = {
    1: { estado: 'OCUPADA', updatedAt: addMinutes(baseNow, -10) },
    2: { estado: 'OCUPADA', updatedAt: addMinutes(baseNow, -15) },
    3: { estado: 'OCUPADA', updatedAt: addMinutes(baseNow, -8) },
    4: { estado: 'ESPERANDO_CUENTA', updatedAt: addMinutes(baseNow, -4) },
    5: { estado: 'RESERVADA', updatedAt: addMinutes(baseNow, -2) },
    6: { estado: 'CERRADA', updatedAt: addHours(startOfDay(baseNow), 14) },
    7: { estado: 'OCUPADA', updatedAt: addMinutes(baseNow, -6) },
    8: { estado: 'LIBRE', updatedAt: addHours(startOfDay(baseNow), 17) },
    9: { estado: 'RESERVADA', updatedAt: addMinutes(baseNow, -3) },
    10: { estado: 'OCUPADA', updatedAt: addMinutes(baseNow, -20) },
    11: { estado: 'RESERVADA', updatedAt: addMinutes(baseNow, -1) },
    12: { estado: 'LIBRE', updatedAt: addHours(baseNow, -5) }
  };

  for (const [mesaNumber, data] of Object.entries(stateByMesa)) {
    const mesa = refs.mesasByNumber.get(Number.parseInt(mesaNumber, 10));
    await prisma.mesa.update({
      where: { id: mesa.id },
      data
    });
  }
};

const collectVisualCounts = async (prisma) => {
  const [usuarios, mesas, categorias, productos, ingredientes, pedidos, pagos, reservas, cierres, comprobantes, transacciones] = await prisma.$transaction([
    prisma.usuario.count(),
    prisma.mesa.count(),
    prisma.categoria.count(),
    prisma.producto.count(),
    prisma.ingrediente.count(),
    prisma.pedido.count(),
    prisma.pago.count(),
    prisma.reserva.count(),
    prisma.cierreCaja.count(),
    prisma.comprobanteFiscal.count(),
    prisma.transaccionMercadoPago.count()
  ]);

  return {
    usuarios,
    mesas,
    categorias,
    productos,
    ingredientes,
    pedidos,
    pagos,
    reservas,
    cierresCaja: cierres,
    comprobantes,
    transaccionesMercadoPago: transacciones
  };
};

const seedVisualData = async (prisma, options = {}) => {
  const {
    baseNow = new Date(),
    includeExtraUsers = true,
    credentials = VISUAL_CREDENTIALS,
    ...configOptions
  } = options;
  const roleEmails = buildRoleEmailSets({ includeExtraUsers });

  await ensureVisualConfigs(prisma, configOptions);
  await ensureVisualUsers(prisma, { includeExtraUsers });
  await ensureVisualMesas(prisma);

  const categoriaIds = await ensureVisualCategorias(prisma);
  const ingredientByName = await ensureVisualIngredientes(prisma, baseNow);
  const modifierIds = await ensureVisualModificadores(prisma);
  await ensureVisualProductos(prisma, categoriaIds, ingredientByName, modifierIds);

  let refs = await buildRefs(prisma);

  await seedFichajes(prisma, refs, baseNow);
  await seedCierresCaja(prisma, refs, baseNow);
  await seedReservas(prisma, refs, baseNow);

  const liveScenarios = buildLiveScenarios(baseNow, roleEmails);
  const historicalScenarios = buildHistoricalScenarios(refs, baseNow, roleEmails);

  for (const scenario of [...liveScenarios, ...historicalScenarios]) {
    await createPedidoScenario(prisma, refs, scenario);
  }

  refs = await buildRefs(prisma);
  await applyMesaStates(prisma, refs, baseNow);

  const counts = await collectVisualCounts(prisma);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return {
    credentials,
    urls: {
      menuPublico: `${frontendUrl}/menu`
    },
    counts
  };
};

module.exports = {
  VISUAL_CREDENTIALS,
  resetVisualSeedState,
  seedVisualData
};
