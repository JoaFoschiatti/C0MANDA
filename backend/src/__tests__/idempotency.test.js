const request = require('supertest');
const app = require('../app');
const { buildIdempotentRequestHash } = require('../utils/idempotency');
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

const createCategoriaYProducto = async (precio = 10) => {
  const categoria = await prisma.categoria.create({
    data: {
      nombre: `Cat-${uniqueId('idem-cat')}`,
      orden: 1,
      activa: true
    }
  });

  const producto = await prisma.producto.create({
    data: {
      nombre: `Prod-${uniqueId('idem-prod')}`,
      precio,
      categoriaId: categoria.id,
      disponible: true
    }
  });

  return { categoria, producto };
};

describe('Idempotency Middleware', () => {
  let admin;
  let tokenAdmin;

  beforeEach(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
    admin = await createUsuario({
      email: `${uniqueId('admin-idem')}@example.com`,
      rol: 'ADMIN'
    });
    tokenAdmin = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('replays POST /api/pedidos without creating duplicates', async () => {
    const { producto } = await createCategoriaYProducto(14);
    const idempotencyKey = uniqueId('idem-pedido');
    const payload = {
      tipo: 'MOSTRADOR',
      items: [{ productoId: producto.id, cantidad: 1 }]
    };

    const firstResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    const replayResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(await prisma.pedido.count()).toBe(1);
  });

  it('replays POST /api/pagos and stores a single payment', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50
      }
    });
    const idempotencyKey = uniqueId('idem-pago');
    const payload = {
      pedidoId: pedido.id,
      monto: 50,
      metodo: 'EFECTIVO'
    };

    const firstResponse = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    const replayResponse = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(await prisma.pago.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });

  it('returns 409 when POST /api/pagos reuses a key with a different payload', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 100,
        total: 100
      }
    });
    const idempotencyKey = uniqueId('idem-pago-conflict');

    await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({ pedidoId: pedido.id, monto: 40, metodo: 'EFECTIVO' })
      .expect(201);

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({ pedidoId: pedido.id, monto: 50, metodo: 'EFECTIVO' })
      .expect(409);

    expect(response.body.error.message).toBe('La misma Idempotency-Key ya fue usada con un payload diferente');
    expect(await prisma.pago.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });

  it('returns 409 when a matching request is still in progress', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });
    const idempotencyKey = uniqueId('idem-pago-pending');
    const payload = {
      pedidoId: pedido.id,
      monto: 10,
      metodo: 'EFECTIVO'
    };

    await prisma.idempotentRequest.create({
      data: {
        usuarioId: admin.id,
        operation: 'pagos:create',
        idempotencyKey,
        requestHash: buildIdempotentRequestHash({
          operation: 'pagos:create',
          method: 'POST',
          params: {},
          query: {},
          body: payload
        })
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(409);

    expect(response.body.error.message).toBe('La operacion ya esta en proceso para esta Idempotency-Key');
    expect(await prisma.pago.count({ where: { pedidoId: pedido.id } })).toBe(0);
  });

  it('replays PATCH /api/pedidos/:id/estado without duplicating stock moves or print jobs', async () => {
    const { producto } = await createCategoriaYProducto(5);
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('idem-ing')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    await seedStockSucursal(ingrediente.id, 10);
    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 2
      }
    });

    const pedidoResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [{ productoId: producto.id, cantidad: 1 }]
      })
      .expect(201);

    const pedidoId = pedidoResponse.body.id;
    const idempotencyKey = uniqueId('idem-estado');
    const payload = { estado: 'EN_PREPARACION' };

    const firstResponse = await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(200);

    const replayResponse = await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(200);

    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(await prisma.movimientoStock.count({ where: { pedidoId, tipo: 'SALIDA' } })).toBe(1);
    expect(await prisma.printJob.count({ where: { pedidoId } })).toBe(1);

    const ingredienteActualizado = await prisma.ingrediente.findUnique({
      where: { id: ingrediente.id }
    });
    expect(Number(ingredienteActualizado.stockActual)).toBe(8);
  });

  it('replays POST /api/mesas/:id/precuenta without duplicating print jobs or audits', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 66,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });
    const { producto } = await createCategoriaYProducto(10);
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        estado: 'PENDIENTE',
        subtotal: 20,
        total: 20
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
        precioUnitario: 10,
        subtotal: 20
      }
    });

    const idempotencyKey = uniqueId('idem-precuenta');

    const firstResponse = await request(app)
      .post(`/api/mesas/${mesa.id}/precuenta`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({})
      .expect(200);

    const replayResponse = await request(app)
      .post(`/api/mesas/${mesa.id}/precuenta`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({})
      .expect(200);

    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(await prisma.printJob.count({ where: { pedidoId: pedido.id } })).toBe(2);
    expect(await prisma.pedidoAuditoria.count({
      where: {
        pedidoId: pedido.id,
        accion: 'PRECUENTA_SOLICITADA'
      }
    })).toBe(1);
  });

  it('replays POST /api/pedidos/:id/cerrar without duplicating audits', async () => {
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

    const idempotencyKey = uniqueId('idem-cerrar');

    const firstResponse = await request(app)
      .post(`/api/pedidos/${pedido.id}/cerrar`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({})
      .expect(200);

    const replayResponse = await request(app)
      .post(`/api/pedidos/${pedido.id}/cerrar`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({})
      .expect(200);

    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(await prisma.pedidoAuditoria.count({
      where: {
        pedidoId: pedido.id,
        accion: 'PEDIDO_CERRADO'
      }
    })).toBe(1);
  });

  it('replays POST /api/mesas/:id/liberar without duplicating audits', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 68,
        capacidad: 4,
        estado: 'CERRADA',
        activa: true
      }
    });
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        estado: 'CERRADO',
        estadoPago: 'APROBADO',
        subtotal: 10,
        total: 10
      }
    });

    const idempotencyKey = uniqueId('idem-liberar');

    const firstResponse = await request(app)
      .post(`/api/mesas/${mesa.id}/liberar`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({})
      .expect(200);

    const replayResponse = await request(app)
      .post(`/api/mesas/${mesa.id}/liberar`)
      .set('Authorization', authHeader(tokenAdmin))
      .set('Idempotency-Key', idempotencyKey)
      .send({})
      .expect(200);

    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(await prisma.pedidoAuditoria.count({
      where: {
        pedidoId: pedido.id,
        accion: 'MESA_LIBERADA'
      }
    })).toBe(1);
  });
});
