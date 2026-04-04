const fs = require('fs');
const path = require('path');

const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const TEST_DATA_PATH = path.join(__dirname, '.e2e-test-data.json');
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');
const RELEASE_LABEL = (process.env.PLAYWRIGHT_RELEASE_LABEL || '').trim();
const ACTIVE_ARTIFACTS_DIR = RELEASE_LABEL
  ? path.join(ARTIFACTS_DIR, 'release', RELEASE_LABEL)
  : ARTIFACTS_DIR;
const SCREENSHOTS_DIR = path.join(ACTIVE_ARTIFACTS_DIR, 'screenshots');
const QA_REPORT_PATH = path.join(ACTIVE_ARTIFACTS_DIR, 'qa-review.json');

const FIXTURES = {
  prefix: 'E2E',
  negocioNombre: 'Comanda E2E',
  negocioEmail: 'e2e@comanda.local',
  adminEmail: 'admin.e2e@comanda.local',
  adminPassword: 'e2e12345',
  adminNombre: 'Admin E2E',
  mozoEmail: 'mozo.e2e@comanda.local',
  mozoPassword: 'mozoe2e123',
  mozoNombre: 'Mozo E2E',
  cocineroEmail: 'cocinero.e2e@comanda.local',
  cocineroPassword: 'cocineroe2e123',
  cocineroNombre: 'Cocinero E2E',
  cajeroEmail: 'cajero.e2e@comanda.local',
  cajeroPassword: 'cajeroe2e123',
  cajeroNombre: 'Cajero E2E',
  deliveryEmail: 'delivery.e2e@comanda.local',
  deliveryPassword: 'deliverye2e123',
  deliveryNombre: 'Delivery E2E',
  baseCategoryName: 'E2E Categoria Base',
  createdCategoryName: 'E2E Categoria Nueva',
  baseProductName: 'E2E Producto Base',
  baseMesaNumber: 9901,
  extraMesaNumber: 9902,
  reservationClientName: 'E2E Cliente Reserva',
  orderClientName: 'E2E Cliente Pedido',
  cierreObservaciones: 'E2E cierre de caja'
};

const createPrisma = () => new PrismaClient();

const createUniqueSuffix = (label = '') => {
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return label ? `${label}-${base}` : base;
};

const readTestData = () => JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf-8'));

const writeTestData = (data) => {
  fs.writeFileSync(TEST_DATA_PATH, JSON.stringify(data, null, 2));
};

const removeTestData = () => {
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.unlinkSync(TEST_DATA_PATH);
  }
};

const ensureArtifactsDir = () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
};

const resetArtifacts = () => {
  fs.mkdirSync(ACTIVE_ARTIFACTS_DIR, { recursive: true });
  fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
  ensureArtifactsDir();
  fs.writeFileSync(QA_REPORT_PATH, '[]');
};

const appendQaReport = (entry) => {
  ensureArtifactsDir();
  const current = fs.existsSync(QA_REPORT_PATH)
    ? JSON.parse(fs.readFileSync(QA_REPORT_PATH, 'utf-8'))
    : [];
  current.push({
    ...entry,
    capturedAt: new Date().toISOString()
  });
  fs.writeFileSync(QA_REPORT_PATH, JSON.stringify(current, null, 2));
};

const buildLocalDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildFutureLocalDateTime = (hoursAhead = 4) => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(0);
  date.setHours(date.getHours() + hoursAhead);
  return buildLocalDateTime(date);
};

const buildDateInputValue = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildEndOfDayDate = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(23, 59, 59, 999);
  return date;
};

const seedExpiredIngredient = async (prisma, options = {}) => {
  const suffix = options.suffix || createUniqueSuffix('ING');
  const ingrediente = await prisma.ingrediente.create({
    data: {
      nombre: options.nombre || `${FIXTURES.prefix} Ingrediente ${suffix}`,
      unidad: options.unidad || 'kg',
      stockActual: options.stockActual ?? 0,
      stockMinimo: options.stockMinimo ?? 1,
      costo: options.costo ?? 1500
    }
  });

  const lote = await prisma.loteStock.create({
    data: {
      ingredienteId: ingrediente.id,
      codigoLote: options.codigoLote || `${FIXTURES.prefix}-LOTE-${suffix}`,
      stockInicial: options.stockLote ?? 2,
      stockActual: options.stockLote ?? 2,
      costoUnitario: options.costo ?? 1500,
      fechaIngreso: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      fechaVencimiento: options.fechaVencimiento || buildEndOfDayDate(-2)
    }
  });

  return { ingrediente, lote, suffix };
};

const seedKitchenPedido = async (prisma, options = {}) => {
  const pedido = await prisma.pedido.create({
    data: {
      tipo: options.tipo || 'MESA',
      estado: options.estado || 'PENDIENTE',
      estadoPago: options.estadoPago || 'PENDIENTE',
      mesaId: options.mesaId || null,
      usuarioId: options.usuarioId || null,
      clienteNombre: options.clienteNombre || `${FIXTURES.prefix} Cocina ${createUniqueSuffix('PED')}`,
      subtotal: options.total ?? 2500,
      total: options.total ?? 2500,
      observaciones: options.observaciones || `${FIXTURES.prefix} pedido cocina`
    }
  });

  await prisma.pedidoItem.create({
    data: {
      pedidoId: pedido.id,
      productoId: options.productoId,
      cantidad: options.cantidad || 1,
      precioUnitario: options.precioUnitario ?? options.total ?? 2500,
      subtotal: options.subtotal ?? options.total ?? 2500
    }
  });

  return { pedido };
};

const seedDeliveryPedido = async (prisma, options = {}) => {
  const pedido = await prisma.pedido.create({
    data: {
      tipo: 'DELIVERY',
      estado: options.estado || 'LISTO',
      estadoPago: options.estadoPago || 'APROBADO',
      usuarioId: options.usuarioId || null,
      clienteNombre: options.clienteNombre || `${FIXTURES.prefix} Delivery ${createUniqueSuffix('CLI')}`,
      clienteTelefono: options.clienteTelefono || '3415550202',
      clienteDireccion: options.clienteDireccion || `${FIXTURES.prefix} Calle 123`,
      subtotal: options.total ?? 3200,
      total: options.total ?? 3200,
      observaciones: options.observaciones || `${FIXTURES.prefix} pedido delivery`
    }
  });

  await prisma.pedidoItem.create({
    data: {
      pedidoId: pedido.id,
      productoId: options.productoId,
      cantidad: options.cantidad || 1,
      precioUnitario: options.precioUnitario ?? options.total ?? 3200,
      subtotal: options.subtotal ?? options.total ?? 3200
    }
  });

  if (options.createPago !== false) {
    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: options.total ?? 3200,
        metodo: options.metodoPago || 'EFECTIVO',
        canalCobro: options.canalCobro || 'CAJA',
        estado: options.estadoPago || 'APROBADO'
      }
    });
  }

  return { pedido };
};

const seedPaidOrderForReports = async (prisma, options = {}) => {
  const total = options.total ?? 4200;
  const pedido = await prisma.pedido.create({
    data: {
      tipo: options.tipo || 'MOSTRADOR',
      estado: options.estado || 'COBRADO',
      estadoPago: 'APROBADO',
      mesaId: options.mesaId || null,
      usuarioId: options.usuarioId || null,
      clienteNombre: options.clienteNombre || `${FIXTURES.prefix} Reporte ${createUniqueSuffix('CLI')}`,
      subtotal: total,
      total,
      observaciones: options.observaciones || `${FIXTURES.prefix} pedido reporte`
    }
  });

  await prisma.pedidoItem.create({
    data: {
      pedidoId: pedido.id,
      productoId: options.productoId,
      cantidad: options.cantidad || 1,
      precioUnitario: options.precioUnitario ?? total,
      subtotal: options.subtotal ?? total
    }
  });

  const pago = await prisma.pago.create({
    data: {
      pedidoId: pedido.id,
      monto: total,
      metodo: options.metodoPago || 'EFECTIVO',
      canalCobro: options.canalCobro || 'CAJA',
      estado: 'APROBADO'
    }
  });

  return { pedido, pago };
};

const seedMercadoPagoTransaction = async (prisma, options = {}) => {
  const { pedido, pago } = await seedPaidOrderForReports(prisma, {
    ...options,
    metodoPago: 'MERCADOPAGO',
    canalCobro: 'CHECKOUT_WEB'
  });

  const transaccion = await prisma.transaccionMercadoPago.create({
    data: {
      pagoId: pago.id,
      mpPaymentId: options.mpPaymentId || `mp-pay-${createUniqueSuffix('TX')}`,
      mpPreferenceId: options.mpPreferenceId || `mp-pref-${createUniqueSuffix('PREF')}`,
      status: options.status || 'approved',
      statusDetail: options.statusDetail || 'accredited',
      amount: options.amount ?? options.total ?? 4200,
      fee: options.fee ?? 210,
      netAmount: options.netAmount ?? 3990,
      payerEmail: options.payerEmail || 'cliente.mp.e2e@comanda.local',
      paymentMethod: options.paymentMethod || 'credit_card',
      paymentTypeId: options.paymentTypeId || 'credit_card',
      installments: options.installments ?? 1,
      externalReference: options.externalReference || `pedido-${pedido.id}`,
      rawData: options.rawData || { source: 'e2e' }
    }
  });

  return { pedido, pago, transaccion };
};

const seedCobradoTaskPedido = async (prisma, options = {}) => {
  const suffix = options.suffix || createUniqueSuffix('TASK');
  const mesa = await prisma.mesa.create({
    data: {
      numero: options.numeroMesa || Number.parseInt(`99${Date.now().toString().slice(-4)}`, 10),
      zona: options.zona || `${FIXTURES.prefix} Caja ${suffix}`,
      capacidad: options.capacidad || 4,
      estado: 'CERRADA',
      activa: true
    }
  });

  const total = options.total ?? 18500;
  const pedido = await prisma.pedido.create({
    data: {
      tipo: 'MESA',
      estado: 'COBRADO',
      estadoPago: 'APROBADO',
      mesaId: mesa.id,
      usuarioId: options.usuarioId || null,
      clienteNombre: options.clienteNombre || `${FIXTURES.prefix} Cliente Caja ${suffix}`,
      subtotal: total,
      total,
      observaciones: options.observaciones || `${FIXTURES.prefix} pedido cobrado ${suffix}`
    }
  });

  const pago = await prisma.pago.create({
    data: {
      pedidoId: pedido.id,
      monto: total,
      metodo: options.metodo || 'EFECTIVO',
      canalCobro: options.canalCobro || 'CAJA',
      estado: 'APROBADO'
    }
  });

  return { mesa, pedido, pago, suffix };
};

const cleanupE2EData = async (prisma, fixtures = FIXTURES) => {
  const usuarios = await prisma.usuario.findMany({
    where: {
      email: {
        in: [
          fixtures.adminEmail,
          fixtures.mozoEmail,
          fixtures.cocineroEmail,
          fixtures.cajeroEmail,
          fixtures.deliveryEmail
        ]
      }
    },
    select: { id: true }
  });
  const usuarioIds = usuarios.map((usuario) => usuario.id);

  const mesas = await prisma.mesa.findMany({
    where: {
      OR: [
        { numero: { in: [fixtures.baseMesaNumber, fixtures.extraMesaNumber] } },
        { zona: { startsWith: fixtures.prefix } }
      ]
    },
    select: { id: true }
  });
  const mesaIds = mesas.map((mesa) => mesa.id);

  const categorias = await prisma.categoria.findMany({
    where: {
      OR: [
        { nombre: { in: [fixtures.baseCategoryName, fixtures.createdCategoryName] } },
        { nombre: { startsWith: fixtures.prefix } }
      ]
    },
    select: { id: true }
  });
  const categoriaIds = categorias.map((categoria) => categoria.id);

  const productos = await prisma.producto.findMany({
    where: {
      OR: [
        { nombre: fixtures.baseProductName },
        { nombre: { startsWith: fixtures.prefix } },
        ...(categoriaIds.length > 0 ? [{ categoriaId: { in: categoriaIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const productoIds = productos.map((producto) => producto.id);

  const pedidos = await prisma.pedido.findMany({
    where: {
      OR: [
        { clienteNombre: { startsWith: fixtures.prefix } },
        { clienteNombre: { contains: 'E2E' } },
        { observaciones: { startsWith: fixtures.prefix } },
        ...(usuarioIds.length > 0 ? [{ usuarioId: { in: usuarioIds } }] : []),
        ...(mesaIds.length > 0 ? [{ mesaId: { in: mesaIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const pedidoIds = pedidos.map((pedido) => pedido.id);


  const ingredientes = await prisma.ingrediente.findMany({
    where: {
      nombre: { startsWith: fixtures.prefix }
    },
    select: { id: true }
  });
  const ingredienteIds = ingredientes.map((ingrediente) => ingrediente.id);

  if (pedidoIds.length > 0) {
    const pedidoItems = await prisma.pedidoItem.findMany({
      where: { pedidoId: { in: pedidoIds } },
      select: { id: true }
    });
    const pedidoItemIds = pedidoItems.map((item) => item.id);

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: { in: pedidoIds } },
      select: { id: true }
    });
    const pagoIds = pagos.map((pago) => pago.id);

    if (pagoIds.length > 0) {
      await prisma.transaccionMercadoPago.deleteMany({
        where: { pagoId: { in: pagoIds } }
      });
    }

    if (pedidoItemIds.length > 0) {
      await prisma.pedidoItemModificador.deleteMany({
        where: { pedidoItemId: { in: pedidoItemIds } }
      });
    }

    await prisma.printJob.deleteMany({
      where: { pedidoId: { in: pedidoIds } }
    });
    await prisma.movimientoStock.deleteMany({
      where: { pedidoId: { in: pedidoIds } }
    });
    await prisma.pago.deleteMany({
      where: { pedidoId: { in: pedidoIds } }
    });
    await prisma.pedidoAuditoria.deleteMany({
      where: { pedidoId: { in: pedidoIds } }
    });
    await prisma.pedidoItem.deleteMany({
      where: { pedidoId: { in: pedidoIds } }
    });
    await prisma.pedido.deleteMany({
      where: { id: { in: pedidoIds } }
    });
  }

  if (ingredienteIds.length > 0) {
    await prisma.movimientoStock.deleteMany({
      where: { ingredienteId: { in: ingredienteIds } }
    });
    await prisma.productoIngrediente.deleteMany({
      where: { ingredienteId: { in: ingredienteIds } }
    });
    await prisma.loteStock.deleteMany({
      where: { ingredienteId: { in: ingredienteIds } }
    });
    await prisma.ingrediente.deleteMany({
      where: { id: { in: ingredienteIds } }
    });
  }

  await prisma.reserva.deleteMany({
    where: {
      OR: [
        { clienteNombre: { startsWith: fixtures.prefix } },
        ...(mesaIds.length > 0 ? [{ mesaId: { in: mesaIds } }] : [])
      ]
    }
  });

  // La caja es global en la instalacion unica; se limpia para arrancar cada suite en estado cerrado.
  await prisma.cierreCaja.deleteMany();

  if (productoIds.length > 0) {
    await prisma.productoIngrediente.deleteMany({
      where: { productoId: { in: productoIds } }
    });
    await prisma.productoModificador.deleteMany({
      where: { productoId: { in: productoIds } }
    });
    await prisma.producto.deleteMany({
      where: { id: { in: productoIds } }
    });
  }

  if (categoriaIds.length > 0) {
    await prisma.categoria.deleteMany({
      where: { id: { in: categoriaIds } }
    });
  }

  const modificadores = await prisma.modificador.findMany({
    where: {
      nombre: { startsWith: fixtures.prefix }
    },
    select: { id: true }
  });
  const modificadorIds = modificadores.map((modificador) => modificador.id);

  if (modificadorIds.length > 0) {
    await prisma.productoModificador.deleteMany({
      where: { modificadorId: { in: modificadorIds } }
    });
    await prisma.modificador.deleteMany({
      where: { id: { in: modificadorIds } }
    });
  }

  if (mesaIds.length > 0) {
    await prisma.mesa.deleteMany({
      where: { id: { in: mesaIds } }
    });
  }

  if (usuarioIds.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: { usuarioId: { in: usuarioIds } }
    });
    await prisma.usuario.deleteMany({
      where: { id: { in: usuarioIds } }
    });
  }
};

module.exports = {
  ACTIVE_ARTIFACTS_DIR,
  ARTIFACTS_DIR,
  FIXTURES,
  QA_REPORT_PATH,
  SCREENSHOTS_DIR,
  TEST_DATA_PATH,
  appendQaReport,
  buildDateInputValue,
  buildEndOfDayDate,
  createPrisma,
  createUniqueSuffix,
  ensureArtifactsDir,
  readTestData,
  writeTestData,
  removeTestData,
  resetArtifacts,
  buildFutureLocalDateTime,
  cleanupE2EData,
  seedCobradoTaskPedido,
  seedDeliveryPedido,
  seedExpiredIngredient,
  seedKitchenPedido,
  seedMercadoPagoTransaction,
  seedPaidOrderForReports
};
