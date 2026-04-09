const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
  ensureNegocio,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData
} = require('./helpers/test-helpers');

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('Reportes Endpoints', () => {
  let admin;
  let token;

  beforeEach(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
    admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN',
      nombre: 'Admin Reportes'
    });
    token = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('GET /api/reportes/dashboard devuelve metricas del restaurante', async () => {
    await prisma.mesa.createMany({
      data: [
        { numero: 1, capacidad: 4, estado: 'OCUPADA', activa: true },
        { numero: 2, capacidad: 4, estado: 'LIBRE', activa: true }
      ]
    });

    await prisma.ingrediente.createMany({
      data: [
        {
          nombre: `Ing-${uniqueId('bajo')}`,
          unidad: 'u',
          stockActual: 5,
          stockMinimo: 10,
          costo: 1,
          activo: true
        },
        {
          nombre: `Ing-${uniqueId('ok')}`,
          unidad: 'u',
          stockActual: 20,
          stockMinimo: 10,
          costo: 1,
          activo: true
        }
      ]
    });

    const ingredienteConVencido = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('vencido')}`,
        unidad: 'u',
        stockActual: 0,
        stockMinimo: 1,
        costo: 1,
        activo: true
      }
    });

    await prisma.loteStock.create({
      data: {
        ingredienteId: ingredienteConVencido.id,
        codigoLote: `LOT-${uniqueId('dash')}`,
        stockInicial: 2,
        stockActual: 2,
        fechaIngreso: new Date('2026-01-10T10:00:00.000Z'),
        fechaVencimiento: new Date('2026-02-10T23:59:59.999Z')
      }
    });

    const empUser = await createUsuario({
      email: `${uniqueId('emp')}@example.com`,
      nombre: 'Emp',
      rol: 'MOZO',
      tarifaHora: 100
    });

    const ahora = new Date();
    await prisma.fichaje.create({
      data: {
        usuarioId: empUser.id,
        entrada: ahora,
        salida: null,
        fecha: ahora
      }
    });

    await prisma.pedido.createMany({
      data: [
        { tipo: 'MOSTRADOR', estado: 'COBRADO', estadoPago: 'APROBADO', subtotal: 100, total: 100 },
        { tipo: 'MOSTRADOR', estado: 'PENDIENTE', subtotal: 50, total: 50 },
        { tipo: 'MOSTRADOR', estado: 'EN_PREPARACION', subtotal: 30, total: 30 }
      ]
    });

    const response = await request(app)
      .get('/api/reportes/dashboard')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      ventasHoy: 100,
      pedidosHoy: 3,
      pedidosPendientes: 2,
      mesasOcupadas: 1,
      mesasTotal: 2,
      alertasStock: 6,
      lotesVencidosPendientes: 1,
      empleadosTrabajando: 1,
      tareasPendientes: 8,
      tareasCaja: 1,
      tareasStock: 7,
      tareasAltaPrioridad: 8
    }));
  });

  it('GET /api/reportes/tareas-centro permite ADMIN y CAJERO pero rechaza MOZO', async () => {
    const adminTareas = await createUsuario({
      email: `${uniqueId('admin-tareas')}@example.com`,
      rol: 'ADMIN',
      nombre: 'Admin Tareas'
    });
    const cajero = await createUsuario({
      email: `${uniqueId('cajero-tareas')}@example.com`,
      rol: 'CAJERO',
      nombre: 'Cajero Tareas'
    });
    const mozo = await createUsuario({
      email: `${uniqueId('mozo-tareas')}@example.com`,
      rol: 'MOZO',
      nombre: 'Mozo Tareas'
    });

    const adminToken = signTokenForUser(adminTareas);
    const cajeroToken = signTokenForUser(cajero);
    const mozoToken = signTokenForUser(mozo);

    const mesaEsperando = await prisma.mesa.create({
      data: {
        numero: 11,
        capacidad: 4,
        estado: 'ESPERANDO_CUENTA',
        activa: true
      }
    });

    await prisma.pedido.create({
      data: {
        mesaId: mesaEsperando.id,
        tipo: 'MESA',
        estado: 'ENTREGADO',
        subtotal: 200,
        total: 200
      }
    });

    const mesaCobrada = await prisma.mesa.create({
      data: {
        numero: 13,
        capacidad: 4,
        estado: 'CERRADA',
        activa: true
      }
    });

    const pedidoCobrado = await prisma.pedido.create({
      data: {
        mesaId: mesaCobrada.id,
        tipo: 'MESA',
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        subtotal: 300,
        total: 300
      }
    });

    const mesaLiberar = await prisma.mesa.create({
      data: {
        numero: 14,
        capacidad: 4,
        estado: 'CERRADA',
        activa: true
      }
    });

    const pedidoCerrado = await prisma.pedido.create({
      data: {
        mesaId: mesaLiberar.id,
        tipo: 'MESA',
        estado: 'CERRADO',
        subtotal: 150,
        total: 150
      }
    });

    await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('tarea-bajo')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 3,
        costo: 1,
        activo: true
      }
    });

    const ingredienteVencido = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('tarea-vencido')}`,
        unidad: 'u',
        stockActual: 0,
        stockMinimo: 0,
        costo: 1,
        activo: true
      }
    });

    const ingredienteProximo = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('tarea-proximo')}`,
        unidad: 'u',
        stockActual: 5,
        stockMinimo: 1,
        costo: 1,
        activo: true
      }
    });

    const now = new Date();
    const vencido = new Date(now);
    vencido.setDate(vencido.getDate() - 1);
    vencido.setHours(23, 59, 59, 999);
    const proximo = new Date(now);
    proximo.setDate(proximo.getDate() + 3);
    proximo.setHours(23, 59, 59, 999);

    const loteVencido = await prisma.loteStock.create({
      data: {
        ingredienteId: ingredienteVencido.id,
        codigoLote: `LOT-${uniqueId('vencido')}`,
        stockInicial: 2,
        stockActual: 2,
        fechaIngreso: now,
        fechaVencimiento: vencido
      }
    });

    const loteProximo = await prisma.loteStock.create({
      data: {
        ingredienteId: ingredienteProximo.id,
        codigoLote: `LOT-${uniqueId('proximo')}`,
        stockInicial: 4,
        stockActual: 4,
        fechaIngreso: now,
        fechaVencimiento: proximo
      }
    });

    const responseAdmin = await request(app)
      .get('/api/reportes/tareas-centro')
      .set('Authorization', authHeader(adminToken))
      .expect(200);

    expect(responseAdmin.body.resumen).toEqual(expect.objectContaining({
      total: 11,
      altaPrioridad: 9,
      caja: 3,
      stock: 8,
      mesasEsperandoCuenta: 1,
      pedidosPorCerrar: 1,
      mesasPorLiberar: 1,
      stockBajo: 6,
      lotesPorVencer: 1,
      lotesVencidosPendientes: 1
    }));

    const tiposCaja = responseAdmin.body.caja.map((item) => item.tipo);
    expect(tiposCaja.slice(0, 2)).toEqual([
      'MESA_ESPERANDO_CUENTA',
      'PEDIDO_COBRADO_PENDIENTE_CIERRE'
    ]);
    expect(tiposCaja).toEqual(expect.arrayContaining([
      'MESA_CERRADA_PENDIENTE_LIBERACION'
    ]));
    expect(tiposCaja).not.toContain('QR_PRESENCIAL_PENDIENTE');
    expect(responseAdmin.body.stock).toHaveLength(8);

    const tareaCobrado = responseAdmin.body.caja.find((item) => item.tipo === 'PEDIDO_COBRADO_PENDIENTE_CIERRE');
    expect(tareaCobrado.entidad).toEqual(expect.objectContaining({
      pedidoId: pedidoCobrado.id,
      mesaId: mesaCobrada.id
    }));

    const tareaLiberar = responseAdmin.body.caja.find((item) => item.tipo === 'MESA_CERRADA_PENDIENTE_LIBERACION');
    expect(tareaLiberar.entidad).toEqual(expect.objectContaining({
      mesaId: mesaLiberar.id,
      pedidoId: pedidoCerrado.id
    }));

    const tareaLoteVencido = responseAdmin.body.stock.find((item) => item.tipo === 'LOTE_VENCIDO_PENDIENTE_DESCARTE');
    expect(tareaLoteVencido.entidad).toEqual(expect.objectContaining({
      ingredienteId: ingredienteVencido.id,
      loteId: loteVencido.id
    }));

    const tareaLoteProximo = responseAdmin.body.stock.find((item) => item.tipo === 'LOTE_PROXIMO_A_VENCER');
    expect(tareaLoteProximo.entidad).toEqual(expect.objectContaining({
      ingredienteId: ingredienteProximo.id,
      loteId: loteProximo.id
    }));

    const responseCajero = await request(app)
      .get('/api/reportes/tareas-centro')
      .set('Authorization', authHeader(cajeroToken))
      .expect(200);

    expect(responseCajero.body.resumen.total).toBe(11);

    await request(app)
      .get('/api/reportes/tareas-centro')
      .set('Authorization', authHeader(mozoToken))
      .expect(403);
  });

  it('GET /api/reportes/ventas requiere fechaDesde y fechaHasta', async () => {
    const response = await request(app)
      .get('/api/reportes/ventas')
      .set('Authorization', authHeader(token))
      .expect(400);

    expect(response.body.error.message).toBe('Datos inválidos');
  });

  it('GET /api/reportes/ventas calcula totales y ventas por metodo', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const productoA = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('a')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const productoB = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('b')}`,
        precio: 50,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const createdAt = new Date(2030, 0, 15, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    const pedido1 = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        usuarioId: admin.id,
        subtotal: 100,
        total: 100,
        createdAt
      }
    });
    const rondaPedido1 = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido1.id,
        numero: 1
      }
    });

    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido1.id,
        rondaId: rondaPedido1.id,
        productoId: productoA.id,
        cantidad: 1,
        precioUnitario: 100,
        subtotal: 100
      }
    });

    await prisma.pago.createMany({
      data: [
        { pedidoId: pedido1.id, monto: 40, metodo: 'EFECTIVO', estado: 'APROBADO' },
        { pedidoId: pedido1.id, monto: 60, metodo: 'MERCADOPAGO', estado: 'APROBADO' }
      ]
    });

    const pedido2 = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        usuarioId: null,
        subtotal: 50,
        total: 50,
        createdAt
      }
    });
    const rondaPedido2 = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido2.id,
        numero: 1
      }
    });

    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido2.id,
        rondaId: rondaPedido2.id,
        productoId: productoB.id,
        cantidad: 1,
        precioUnitario: 50,
        subtotal: 50
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido2.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        estado: 'APROBADO'
      }
    });

    const response = await request(app)
      .get(`/api/reportes/ventas?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.totalPedidos).toBe(2);
    expect(response.body.totalVentas).toBe(150);
    expect(response.body.ticketPromedio).toBe(75);
    expect(response.body.ventasPorMetodo).toEqual(expect.objectContaining({
      EFECTIVO: 40,
      MERCADOPAGO: 110
    }));
    expect(response.body.ventasPorTipo).toEqual(expect.objectContaining({
      MOSTRADOR: { cantidad: 1, total: 100 },
      DELIVERY: { cantidad: 1, total: 50 }
    }));
  });

  it('GET /api/reportes/productos-mas-vendidos agrupa por producto base', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const base = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const variante = await prisma.producto.create({
      data: {
        nombre: `${base.nombre} Doble`,
        nombreVariante: 'Doble',
        precio: 150,
        categoriaId: categoria.id,
        disponible: true,
        productoBaseId: base.id,
        ordenVariante: 1,
        esVariantePredeterminada: true
      }
    });

    const createdAt = new Date(2030, 0, 16, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        subtotal: 400,
        total: 400,
        createdAt
      }
    });
    const rondaPedido = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 1
      }
    });

    await prisma.pedidoItem.createMany({
      data: [
        {
          pedidoId: pedido.id,
          rondaId: rondaPedido.id,
          productoId: base.id,
          cantidad: 1,
          precioUnitario: 100,
          subtotal: 100
        },
        {
          pedidoId: pedido.id,
          rondaId: rondaPedido.id,
          productoId: variante.id,
          cantidad: 2,
          precioUnitario: 150,
          subtotal: 300
        }
      ]
    });

    const response = await request(app)
      .get(`/api/reportes/productos-mas-vendidos?fechaDesde=${fecha}&fechaHasta=${fecha}&agruparPorBase=true&limite=10`)
      .set('Authorization', authHeader(token))
      .expect(200);

    const entry = response.body.find((row) => row.productoBaseId === base.id);
    expect(entry).toBeDefined();
    expect(entry.cantidadVendida).toBe(3);
    expect(entry.totalVentas).toBe(400);
    expect(entry.variantes).toHaveLength(1);
    expect(entry.variantes[0].nombreVariante).toBe('Doble');
  });

  it('GET /api/reportes/ventas-por-mozo distingue menu publico vs usuario', async () => {
    const createdAt = new Date(2030, 0, 18, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    await prisma.pedido.createMany({
      data: [
        {
          tipo: 'MOSTRADOR',
          estado: 'COBRADO',
          estadoPago: 'APROBADO',
          usuarioId: admin.id,
          subtotal: 100,
          total: 100,
          createdAt
        },
        {
          tipo: 'MOSTRADOR',
          estado: 'COBRADO',
          estadoPago: 'APROBADO',
          usuarioId: null,
          subtotal: 50,
          total: 50,
          createdAt
        }
      ]
    });

    const response = await request(app)
      .get(`/api/reportes/ventas-por-mozo?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    const menuPublico = response.body.find((row) => row.mozo === 'Menú Público');
    expect(menuPublico).toBeDefined();
    expect(menuPublico.pedidos).toBe(1);

    const adminEntry = response.body.find((row) => row.mozo === admin.nombre);
    expect(adminEntry).toBeDefined();
    expect(adminEntry.pedidos).toBe(1);
  });

  it('GET /api/reportes/consumo-insumos calcula consumo con multiplicador', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'kg',
        stockActual: 100,
        stockMinimo: 10,
        costo: 5,
        activo: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true,
        multiplicadorInsumos: 2.0
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 0.5
      }
    });

    const createdAt = new Date(2030, 0, 17, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        subtotal: 300,
        total: 300,
        createdAt
      }
    });
    const rondaConsumo = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 1
      }
    });

    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido.id,
        rondaId: rondaConsumo.id,
        productoId: producto.id,
        cantidad: 3,
        precioUnitario: 100,
        subtotal: 300
      }
    });

    const response = await request(app)
      .get(`/api/reportes/consumo-insumos?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.resumen.totalIngredientes).toBe(1);

    const row = response.body.ingredientes.find((item) => item.ingredienteId === ingrediente.id);
    expect(row).toBeDefined();
    expect(row.consumoTotal).toBeCloseTo(3, 6);
    expect(row.estado).toBe('OK');
    expect(row.detalleProductos).toHaveLength(1);
    expect(row.detalleProductos[0]).toEqual(expect.objectContaining({
      producto: producto.nombre,
      multiplicador: 2,
      cantidad: 3
    }));
  });
});
