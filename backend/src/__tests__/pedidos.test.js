const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
    createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

const seedStockSucursal = async (ingredienteId, stockActual, options = {}) => {
  const {
    stockMinimo = 0,
    sucursalId = 1,
    codigoLote = `LOT-${uniqueId('seed-stock')}`
  } = options;

  await prisma.ingredienteStock.upsert({
    where: {
      ingredienteId_sucursalId: {
        ingredienteId,
        sucursalId
      }
    },
    update: {
      stockActual,
      stockMinimo,
      activo: true
    },
    create: {
      ingredienteId,
      sucursalId,
      stockActual,
      stockMinimo,
      activo: true
    }
  });

  await prisma.loteStock.create({
    data: {
      ingredienteId,
      sucursalId,
      codigoLote,
      stockInicial: stockActual,
      stockActual,
      fechaIngreso: new Date('2026-01-01T10:00:00.000Z')
    }
  });
};

const createCategoriaYProducto = async () => {
  const categoria = await prisma.categoria.create({
    data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
  });

  const producto = await prisma.producto.create({
    data: {
      nombre: `Prod-${uniqueId('prod')}`,
      precio: 10,
      categoriaId: categoria.id,
      disponible: true
    }
  });

  return { categoria, producto };
};

describe('Pedidos Endpoints', () => {
  let tokenAdmin;
  let tokenMozo;

  beforeEach(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    tokenAdmin = signTokenForUser(admin);

    const mozo = await createUsuario({
      email: `${uniqueId('mozo')}@example.com`,
      rol: 'MOZO'
    });
    tokenMozo = signTokenForUser(mozo);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/pedidos crea pedido MESA, aplica modificadores y ocupa mesa', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 1,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const { producto } = await createCategoriaYProducto();

    const modificador = await prisma.modificador.create({
      data: {
        nombre: `Extra-${uniqueId('mod')}`,
        precio: 3,
        tipo: 'ADICION',
        activo: true
      }
    });

    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [
          {
            productoId: producto.id,
            cantidad: 2,
            observaciones: 'Sin sal',
            modificadores: [modificador.id]
          }
        ]
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.tipo).toBe('MESA');
    expect(response.body.mesaId).toBe(mesa.id);
    expect(Number(response.body.subtotal)).toBe(26);
    expect(Number(response.body.total)).toBe(26);

    expect(response.body.items).toHaveLength(1);
    expect(Number(response.body.items[0].precioUnitario)).toBe(13);
    expect(Number(response.body.items[0].subtotal)).toBe(26);
    expect(response.body.items[0].modificadores).toHaveLength(1);
    expect(response.body.items[0].modificadores[0].modificadorId).toBe(modificador.id);
    expect(Number(response.body.items[0].modificadores[0].precio)).toBe(3);

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('OCUPADA');
  });

  it('POST /api/pedidos rechaza abrir otra cuenta en una mesa con pedido abierto', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 200,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const { producto } = await createCategoriaYProducto();

    const pedidoInicial = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [{ productoId: producto.id, cantidad: 1 }]
      })
      .expect(201);

    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [{ productoId: producto.id, cantidad: 1 }]
      })
      .expect(409);

    expect(response.body.error.message).toBe('La mesa ya tiene un pedido abierto');
    expect(response.body.error.details).toEqual(expect.objectContaining({
      pedidoId: pedidoInicial.body.id,
      mesaId: mesa.id
    }));
  });

  it('MOZO no puede crear pedidos DELIVERY pero si MESA y MOSTRADOR', async () => {
    const { producto } = await createCategoriaYProducto();
    const mesa = await prisma.mesa.create({
      data: {
        numero: 2,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const forbidden = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenMozo))
      .send({
        tipo: 'DELIVERY',
        clienteNombre: 'Juan',
        items: [
          {
            productoId: producto.id,
            cantidad: 1
          }
        ]
      })
      .expect(403);

    expect(forbidden.body.error.message).toBe('Los mozos no pueden crear pedidos de delivery');

    const mostrador = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenMozo))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          {
            productoId: producto.id,
            cantidad: 1
          }
        ]
      })
      .expect(201);

    expect(mostrador.body.tipo).toBe('MOSTRADOR');

    const mesaResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenMozo))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [
          {
            productoId: producto.id,
            cantidad: 1
          }
        ]
      })
      .expect(201);

    expect(mesaResponse.body.tipo).toBe('MESA');
    expect(mesaResponse.body.mesaId).toBe(mesa.id);
  });

  it('GET /api/pedidos busca por numero de pedido, mesa o cliente con q', async () => {
    const mesaNumero = Number(String(Date.now()).slice(-6)) + Math.floor(Math.random() * 1000);
    const mesa = await prisma.mesa.create({
      data: {
        numero: mesaNumero,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const pedidoMesa = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        subtotal: 10,
        total: 10
      }
    });

    const pedidoCliente = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        clienteNombre: 'Juan Perez',
        subtotal: 12,
        total: 12
      }
    });

    await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        clienteNombre: 'Mostrador',
        subtotal: 8,
        total: 8
      }
    });

    const porPedido = await request(app)
      .get(`/api/pedidos?q=${pedidoMesa.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(porPedido.body.data.map((pedido) => pedido.id)).toEqual([pedidoMesa.id]);

    const porMesa = await request(app)
      .get(`/api/pedidos?q=${mesaNumero}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(porMesa.body.data.map((pedido) => pedido.id)).toEqual([pedidoMesa.id]);

    const porCliente = await request(app)
      .get('/api/pedidos?q=juan')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(porCliente.body.data.map((pedido) => pedido.id)).toEqual([pedidoCliente.id]);
  });

  it('GET /api/pedidos combina q con estado, tipo, fecha y mesaId', async () => {
    const mesaNumero = Number(String(Date.now()).slice(-6)) + 2000 + Math.floor(Math.random() * 1000);
    const mesa = await prisma.mesa.create({
      data: {
        numero: mesaNumero,
        capacidad: 4,
        estado: 'CERRADA',
        activa: true
      }
    });

    const fechaFiltro = '2026-04-01';
    const fechaCoincidente = new Date('2026-04-01T15:00:00.000Z');
    const fechaNoCoincidente = new Date('2026-04-02T15:00:00.000Z');

    const pedidoCoincidente = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        estado: 'COBRADO',
        mesaId: mesa.id,
        subtotal: 20,
        total: 20,
        createdAt: fechaCoincidente
      }
    });

    await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        estado: 'PENDIENTE',
        mesaId: mesa.id,
        subtotal: 20,
        total: 20,
        createdAt: fechaCoincidente
      }
    });

    await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        estado: 'COBRADO',
        mesaId: mesa.id,
        subtotal: 20,
        total: 20,
        createdAt: fechaNoCoincidente
      }
    });

    const response = await request(app)
      .get(`/api/pedidos?q=${mesaNumero}&estado=COBRADO&tipo=MESA&fecha=${fechaFiltro}&mesaId=${mesa.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.data.map((pedido) => pedido.id)).toEqual([pedidoCoincidente.id]);
  });

  it('MOZO solo puede cambiar estado a ENTREGADO', async () => {
    const pedidoPendiente = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });

    const forbidden = await request(app)
      .patch(`/api/pedidos/${pedidoPendiente.id}/estado`)
      .set('Authorization', authHeader(tokenMozo))
      .send({ estado: 'EN_PREPARACION' })
      .expect(403);

    expect(forbidden.body.error.message).toBe('No tienes permiso para cambiar a este estado');

    const pedidoListo = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'LISTO',
        subtotal: 10,
        total: 10
      }
    });

    const ok = await request(app)
      .patch(`/api/pedidos/${pedidoListo.id}/estado`)
      .set('Authorization', authHeader(tokenMozo))
      .send({ estado: 'ENTREGADO' })
      .expect(200);

    expect(ok.body.estado).toBe('ENTREGADO');
  });

  it('PATCH /api/pedidos/:id/estado a EN_PREPARACION descuenta stock, registra movimientos y encola impresión', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat2')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });
    await seedStockSucursal(ingrediente.id, 10);

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod2')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 2
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          { productoId: producto.id, cantidad: 2 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    const response = await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    expect(response.body.estado).toBe('EN_PREPARACION');
    expect(response.body.impresion).toBeDefined();
    expect(response.body.impresion.total).toBe(1);
    expect(response.body.impresion.batchId).toBeDefined();

    const ingredienteActualizado = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingredienteActualizado.stockActual)).toBe(6);

    const movimientosSalida = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' }
    });
    expect(movimientosSalida.length).toBe(1);
    expect(Number(movimientosSalida[0].cantidad)).toBe(4);

    const jobs = await prisma.printJob.findMany({
      where: { pedidoId }
    });
    expect(jobs.length).toBe(1);

    const detalle = await request(app)
      .get(`/api/pedidos/${pedidoId}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(detalle.body.id).toBe(pedidoId);
    expect(detalle.body.impresion).toBeDefined();
    expect(detalle.body.impresion.total).toBe(1);
    expect(detalle.body.impresion.status).toBe('PENDIENTE');
    expect(detalle.body.printJobs).toBeUndefined();

    const listado = await request(app)
      .get('/api/pedidos?estado=EN_PREPARACION')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const ids = listado.body.data.map(p => p.id);
    expect(ids).toContain(pedidoId);
  });

  it('POST /api/pedidos/:id/cancelar restaura stock y libera mesa si ya estaba en preparación', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 50,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat3')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing2')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });
    await seedStockSucursal(ingrediente.id, 10);

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod3')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 1
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [
          { productoId: producto.id, cantidad: 2 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    const ingredienteLuegoPreparacion = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingredienteLuegoPreparacion.stockActual)).toBe(8);

    const cancelado = await request(app)
      .post(`/api/pedidos/${pedidoId}/cancelar`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ motivo: 'Cliente se fue' })
      .expect(200);

    expect(cancelado.body.estado).toBe('CANCELADO');

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('LIBRE');

    const ingredienteFinal = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingredienteFinal.stockActual)).toBe(10);

    const movimientosEntrada = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'ENTRADA' }
    });
    expect(movimientosEntrada.length).toBe(1);
    expect(Number(movimientosEntrada[0].cantidad)).toBe(2);
  });
  it('PATCH /api/pedidos/:id/estado descuenta stock por lotes usando FIFO', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('catfifo')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('fifo')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    const loteViejo = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('old')}`,
        stockInicial: 3,
        stockActual: 3,
        fechaIngreso: new Date('2026-01-10T10:00:00.000Z')
      }
    });

    const loteNuevo = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('new')}`,
        stockInicial: 7,
        stockActual: 7,
        fechaIngreso: new Date('2026-02-10T10:00:00.000Z')
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prodfifo')}`,
        precio: 8,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 2
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          { productoId: producto.id, cantidad: 2 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    const lotes = await prisma.loteStock.findMany({
      where: { ingredienteId: ingrediente.id },
      orderBy: { fechaIngreso: 'asc' }
    });

    expect(Number(lotes[0].stockActual)).toBe(0);
    expect(lotes[0].activo).toBe(false);
    expect(Number(lotes[1].stockActual)).toBe(6);

    const movimientosSalida = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' },
      orderBy: { createdAt: 'asc' }
    });

    expect(movimientosSalida).toHaveLength(2);
    expect(Number(movimientosSalida[0].cantidad)).toBe(3);
    expect(movimientosSalida[0].loteStockId).toBe(loteViejo.id);
    expect(Number(movimientosSalida[1].cantidad)).toBe(1);
    expect(movimientosSalida[1].loteStockId).toBe(loteNuevo.id);
  });

  it('POST /api/pedidos/:id/cancelar repone stock sobre el mismo lote consumido', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('catcancel')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('lotecancel')}`,
        unidad: 'u',
        stockActual: 5,
        stockMinimo: 0,
        activo: true
      }
    });

    const lote = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('cancel')}`,
        stockInicial: 5,
        stockActual: 5,
        fechaIngreso: new Date('2026-01-15T10:00:00.000Z')
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('cancel')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 2
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          { productoId: producto.id, cantidad: 1 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    await request(app)
      .post(`/api/pedidos/${pedidoId}/cancelar`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ motivo: 'Prueba lote' })
      .expect(200);

    const movimientos = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id },
      orderBy: { createdAt: 'asc' }
    });

    expect(movimientos).toHaveLength(2);
    expect(movimientos[0].tipo).toBe('SALIDA');
    expect(movimientos[0].loteStockId).toBe(lote.id);
    expect(movimientos[1].tipo).toBe('ENTRADA');
    expect(movimientos[1].loteStockId).toBe(lote.id);

    const loteActualizado = await prisma.loteStock.findUnique({ where: { id: lote.id } });
    expect(Number(loteActualizado.stockActual)).toBe(5);
  });

  it('PATCH /api/pedidos/:id/estado usa el lote vigente mas antiguo cuando hay lotes vencidos', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('catexp')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('expfifo')}`,
        unidad: 'u',
        stockActual: 5,
        stockMinimo: 0,
        activo: true
      }
    });

    const loteVencido = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('exp')}`,
        stockInicial: 2,
        stockActual: 2,
        fechaIngreso: new Date('2026-01-01T10:00:00.000Z'),
        fechaVencimiento: new Date('2026-02-01T23:59:59.999Z')
      }
    });

    const loteVigente = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('vig')}`,
        stockInicial: 3,
        stockActual: 3,
        fechaIngreso: new Date('2026-02-15T10:00:00.000Z')
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('expfifo')}`,
        precio: 9,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 3
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          { productoId: producto.id, cantidad: 1 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    const lotes = await prisma.loteStock.findMany({
      where: { ingredienteId: ingrediente.id },
      orderBy: { fechaIngreso: 'asc' }
    });

    expect(Number(lotes.find((item) => item.id === loteVencido.id).stockActual)).toBe(2);
    expect(Number(lotes.find((item) => item.id === loteVigente.id).stockActual)).toBe(0);

    const movimientosSalida = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' }
    });

    expect(movimientosSalida).toHaveLength(1);
    expect(Number(movimientosSalida[0].cantidad)).toBe(3);
    expect(movimientosSalida[0].loteStockId).toBe(loteVigente.id);
  });

  it('GET /api/pedidos devuelve un payload resumido para la grilla', async () => {
    const repartidor = await createUsuario({
      email: `${uniqueId('delivery-list')}@example.com`,
      rol: 'DELIVERY'
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        estado: 'LISTO',
        clienteNombre: 'Ana',
        repartidorId: repartidor.id,
        subtotal: 50,
        total: 50
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        canalCobro: 'CAJA',
        estado: 'PENDIENTE',
        referencia: `TRF-${uniqueId('pedido-list')}`,
        comprobante: 'comprobante-transferencia'
      }
    });

    await prisma.printJob.create({
      data: {
        pedidoId: pedido.id,
        tipo: 'CAJA',
        batchId: uniqueId('batch-list'),
        contenido: 'Caja'
      }
    });

    await prisma.comprobanteFiscal.create({
      data: {
        pedidoId: pedido.id,
        tipoComprobante: 'CONSUMIDOR_FINAL',
        estado: 'BORRADOR'
      }
    });

    const response = await request(app)
      .get('/api/pedidos?estado=LISTO')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const listado = response.body.data.find((item) => item.id === pedido.id);

    expect(listado).toBeDefined();
    expect(listado.sucursal).toBeUndefined();
    expect(listado.usuario).toBeUndefined();
    expect(listado.items).toBeUndefined();
    expect(listado.printJobs).toBeUndefined();
    expect(listado.repartidor).toEqual({
      id: repartidor.id,
      nombre: repartidor.nombre
    });
    expect(listado.pagos).toEqual([
      expect.objectContaining({
        canalCobro: 'CAJA',
        estado: 'PENDIENTE',
        comprobante: 'comprobante-transferencia'
      })
    ]);
    expect(listado.impresion).toEqual(expect.objectContaining({
      total: 1,
      status: 'PENDIENTE'
    }));
    expect(listado.comprobanteFiscal).toEqual(expect.objectContaining({
      estado: 'BORRADOR'
    }));
  });

  it('GET /api/pedidos/cocina devuelve solo los campos necesarios para cocina', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 70,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cocina')}`, orden: 1, activa: true }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('cocina')}`,
        precio: 20,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const modificador = await prisma.modificador.create({
      data: {
        nombre: `Mod-${uniqueId('cocina')}`,
        tipo: 'ADICION',
        precio: 5,
        activo: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        estado: 'PENDIENTE',
        mesaId: mesa.id,
        subtotal: 20,
        total: 20,
        observaciones: 'Sin demora'
      }
    });
    const ronda = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 1
      }
    });
    const pedidoItem = await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido.id,
        rondaId: ronda.id,
        productoId: producto.id,
        cantidad: 1,
        precioUnitario: 20,
        subtotal: 20,
        observaciones: 'Bien cocido'
      }
    });
    await prisma.pedidoItemModificador.create({
      data: {
        pedidoItemId: pedidoItem.id,
        modificadorId: modificador.id,
        precio: 5
      }
    });

    const response = await request(app)
      .get('/api/pedidos/cocina')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const cocina = response.body.find((item) => item.id === pedido.id);

    expect(cocina).toBeDefined();
    expect(cocina.sucursal).toBeUndefined();
    expect(cocina.mesa).toEqual({ numero: 70 });
    expect(cocina.items).toBeUndefined();
    expect(cocina.rondas[0].items[0]).toEqual(expect.objectContaining({
      cantidad: 1,
      observaciones: 'Bien cocido',
      producto: { nombre: producto.nombre }
    }));
    expect(cocina.rondas[0].items[0].modificadores[0]).toEqual({
      id: expect.any(Number),
      modificador: {
        nombre: modificador.nombre,
        tipo: 'ADICION'
      }
    });
  });

  it('GET /api/pedidos/delivery devuelve solo el payload necesario para entregas', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('delivery')}`, orden: 1, activa: true }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('delivery')}`,
        precio: 18,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        estado: 'LISTO',
        clienteNombre: 'Maria',
        clienteTelefono: '123',
        clienteDireccion: 'Calle 1',
        observaciones: 'Puerta azul',
        subtotal: 18,
        total: 18
      }
    });
    const ronda = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 1
      }
    });
    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido.id,
        rondaId: ronda.id,
        productoId: producto.id,
        cantidad: 2,
        precioUnitario: 9,
        subtotal: 18
      }
    });

    const response = await request(app)
      .get('/api/pedidos/delivery')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const delivery = response.body.find((item) => item.id === pedido.id);

    expect(delivery).toBeDefined();
    expect(delivery.sucursal).toBeUndefined();
    expect(delivery.usuario).toBeUndefined();
    expect(delivery.repartidor).toBeUndefined();
    expect(delivery.items[0]).toEqual({
      cantidad: 2,
      producto: {
        nombre: producto.nombre
      }
    });
  });

  it('GET /api/pedidos/cocina y /api/pedidos/delivery excluyen pedidos publicos no confirmados', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('public-sec')}`, orden: 1, activa: true }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('public-sec')}`,
        precio: 18,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const pedidoCocina = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'PENDIENTE',
        origen: 'MENU_PUBLICO',
        operacionConfirmada: false,
        subtotal: 18,
        total: 18
      }
    });
    const rondaCocina = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedidoCocina.id,
        numero: 1
      }
    });
    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedidoCocina.id,
        rondaId: rondaCocina.id,
        productoId: producto.id,
        cantidad: 1,
        precioUnitario: 18,
        subtotal: 18
      }
    });

    const pedidoDelivery = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        estado: 'PENDIENTE',
        origen: 'MENU_PUBLICO',
        operacionConfirmada: false,
        clienteNombre: 'Cliente Web',
        clienteTelefono: '123',
        clienteDireccion: 'Calle 1',
        subtotal: 18,
        total: 18
      }
    });
    const rondaDelivery = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedidoDelivery.id,
        numero: 1
      }
    });
    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedidoDelivery.id,
        rondaId: rondaDelivery.id,
        productoId: producto.id,
        cantidad: 1,
        precioUnitario: 18,
        subtotal: 18
      }
    });

    const cocinaInicial = await request(app)
      .get('/api/pedidos/cocina')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const deliveryInicial = await request(app)
      .get('/api/pedidos/delivery')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(cocinaInicial.body.some((item) => item.id === pedidoCocina.id)).toBe(false);
    expect(deliveryInicial.body.some((item) => item.id === pedidoDelivery.id)).toBe(false);

    await prisma.pedido.update({
      where: { id: pedidoCocina.id },
      data: { operacionConfirmada: true, estadoPago: 'APROBADO' }
    });

    await prisma.pedido.update({
      where: { id: pedidoDelivery.id },
      data: { operacionConfirmada: true, estadoPago: 'APROBADO' }
    });

    const cocinaConfirmada = await request(app)
      .get('/api/pedidos/cocina')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const deliveryConfirmado = await request(app)
      .get('/api/pedidos/delivery')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(cocinaConfirmada.body.some((item) => item.id === pedidoCocina.id)).toBe(true);
    expect(deliveryConfirmado.body.some((item) => item.id === pedidoDelivery.id)).toBe(true);
  });

  it('POST /api/pedidos/:id/items agrega una nueva ronda sobre un pedido cobrado y reabre la cuenta', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 65,
        capacidad: 4,
        estado: 'ESPERANDO_CUENTA',
        activa: true
      }
    });

    const { producto } = await createCategoriaYProducto();

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        subtotal: 10,
        total: 10
      }
    });
    const rondaInicial = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 1,
        enviadaCocinaAt: new Date(),
        stockAplicadoAt: new Date()
      }
    });
    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido.id,
        rondaId: rondaInicial.id,
        productoId: producto.id,
        cantidad: 1,
        precioUnitario: 10,
        subtotal: 10
      }
    });
    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 10,
        metodo: 'EFECTIVO',
        canalCobro: 'CAJA',
        estado: 'APROBADO'
      }
    });

    const response = await request(app)
      .post(`/api/pedidos/${pedido.id}/items`)
      .set('Authorization', authHeader(tokenMozo))
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }]
      })
      .expect(200);

    expect(response.body.ronda).toEqual(expect.objectContaining({ numero: 2 }));
    expect(response.body.impresion).toEqual(expect.objectContaining({ total: 1 }));
    expect(response.body.pedido.estado).toBe('EN_PREPARACION');
    expect(response.body.pedido.estadoPago).toBe('PENDIENTE');
    expect(Number(response.body.pedido.total)).toBe(20);

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('OCUPADA');

    const rondas = await prisma.pedidoRonda.findMany({
      where: { pedidoId: pedido.id },
      orderBy: { numero: 'asc' }
    });
    expect(rondas).toHaveLength(2);
    expect(rondas[1].enviadaCocinaAt).not.toBeNull();

    const jobs = await prisma.printJob.findMany({ where: { pedidoId: pedido.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].tipo).toBe('COCINA');
  });

  it('POST /api/mesas/:id/precuenta calcula el total acumulado y encola CAJA + CLIENTE', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 66,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const { producto } = await createCategoriaYProducto();

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        estado: 'PENDIENTE',
        subtotal: 20,
        total: 20
      }
    });
    const ronda1 = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 1
      }
    });
    const ronda2 = await prisma.pedidoRonda.create({
      data: {
        pedidoId: pedido.id,
        numero: 2
      }
    });
    await prisma.pedidoItem.createMany({
      data: [
        {
          pedidoId: pedido.id,
          rondaId: ronda1.id,
          productoId: producto.id,
          cantidad: 1,
          precioUnitario: 10,
          subtotal: 10
        },
        {
          pedidoId: pedido.id,
          rondaId: ronda2.id,
          productoId: producto.id,
          cantidad: 1,
          precioUnitario: 10,
          subtotal: 10
        }
      ]
    });

    const response = await request(app)
      .post(`/api/mesas/${mesa.id}/precuenta`)
      .set('Authorization', authHeader(tokenMozo))
      .send({})
      .expect(200);

    expect(Number(response.body.pedido.total)).toBe(20);
    expect(Number(response.body.pendiente)).toBe(20);
    expect(response.body.mesa.estado).toBe('ESPERANDO_CUENTA');
    expect(response.body.impresion).toEqual(expect.objectContaining({ total: 2 }));

    const jobs = await prisma.printJob.findMany({
      where: { pedidoId: pedido.id },
      orderBy: { tipo: 'asc' }
    });
    expect(jobs.map((job) => job.tipo)).toEqual(['CAJA', 'CLIENTE']);
  });

  it('POST /api/pedidos/:id/cerrar permite a un mozo cerrar una cuenta saldada', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 67,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        estado: 'COBRADO',
        estadoPago: 'APROBADO',
        subtotal: 10,
        total: 10
      }
    });
    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 10,
        metodo: 'EFECTIVO',
        canalCobro: 'CAJA',
        estado: 'APROBADO'
      }
    });

    const response = await request(app)
      .post(`/api/pedidos/${pedido.id}/cerrar`)
      .set('Authorization', authHeader(tokenMozo))
      .send({})
      .expect(200);

    expect(response.body.estado).toBe('CERRADO');
    expect(response.body.estadoPago).toBe('APROBADO');

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('CERRADA');
  });
});
