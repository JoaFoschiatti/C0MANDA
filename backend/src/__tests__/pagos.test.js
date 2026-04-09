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

describe('Pagos Endpoints', () => {
    let token;

  const crearPedidoConPagoAprobado = async (total = 100) => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: total,
        total
      }
    });

    const pagoResponse = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: total, metodo: 'EFECTIVO' })
      .expect(201);

    return {
      pedido,
      pago: pagoResponse.body.pago
    };
  };

  beforeAll(async () => {
        await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/pagos permite pagos parciales y completa el pedido sin cerrar la mesa automaticamente', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 1,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        subtotal: 100,
        total: 100
      }
    });

    const pago1 = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 40, metodo: 'EFECTIVO' })
      .expect(201);

    expect(pago1.body.pago.id).toBeDefined();
    expect(Number(pago1.body.totalPagado)).toBe(40);
    expect(Number(pago1.body.pendiente)).toBe(60);
    expect(pago1.body.pedido.estado).toBe('PENDIENTE');

    const pago2 = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 60, metodo: 'MERCADOPAGO' })
      .expect(201);

    expect(Number(pago2.body.totalPagado)).toBe(100);
    expect(Number(pago2.body.pendiente)).toBe(0);
    expect(pago2.body.pedido.estado).toBe('PENDIENTE');
    expect(pago2.body.pedido.estadoPago).toBe('APROBADO');

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('OCUPADA');
  });

  it('POST /api/pagos rechaza monto mayor al pendiente', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });

    await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 5, metodo: 'EFECTIVO' })
      .expect(201);

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 10, metodo: 'EFECTIVO' })
      .expect(400);

    expect(response.body.error.message).toMatch(/El monto excede el pendiente/);
  });

  it('POST /api/pagos rechaza pagar pedido cancelado', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10,
        estado: 'CANCELADO'
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 10, metodo: 'EFECTIVO' })
      .expect(400);

    expect(response.body.error.message).toBe('No se puede pagar un pedido cancelado');
  });

  it('GET /api/pagos/pedido/:pedidoId lista pagos y calcula totales', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50
      }
    });

    await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 20, metodo: 'EFECTIVO' })
      .expect(201);

    const response = await request(app)
      .get(`/api/pagos/pedido/${pedido.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Number(response.body.totalPedido)).toBe(50);
    expect(Number(response.body.totalPagado)).toBe(20);
    expect(Number(response.body.pendiente)).toBe(30);
    expect(Array.isArray(response.body.pagos)).toBe(true);
  });

  it('POST /api/pagos mantiene pendiente operativo un pedido web prepago hasta su entrega', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        origen: 'MENU_PUBLICO',
        operacionConfirmada: false,
        subtotal: 50,
        total: 50
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 50, metodo: 'MERCADOPAGO' })
      .expect(201);

    expect(response.body.pedido.estadoPago).toBe('APROBADO');
    expect(response.body.pedido.estado).toBe('PENDIENTE');
    expect(response.body.pedido.operacionConfirmada).toBe(true);
  });

  it('POST /api/pagos permite registrar MercadoPago por caja sin referencia ni comprobante', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: pedido.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        canalCobro: 'CAJA'
      })
      .expect(201);

    expect(response.body.pago.referencia).toBeNull();
    expect(response.body.pago.comprobante).toBeNull();
    expect(response.body.pedido.estado).toBe('PENDIENTE');
    expect(response.body.pedido.estadoPago).toBe('APROBADO');

    const pagoPersistido = await prisma.pago.findUnique({
      where: { id: response.body.pago.id }
    });

    expect(pagoPersistido.referencia).toBeNull();
    expect(pagoPersistido.comprobante).toBeNull();
  });

  it('POST /api/pagos rechaza pedido inexistente', async () => {
    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: 999999, monto: 10, metodo: 'EFECTIVO' })
      .expect(404);

    expect(response.body.error.message).toBe('Pedido no encontrado');
  });

  it('POST /api/pagos rechaza TARJETA como metodo de pago nuevo', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 30,
        total: 30
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: pedido.id,
        monto: 30,
        metodo: 'TARJETA'
      })
      .expect(400);

    expect(response.body.error.message).toBe('Datos inválidos');
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'metodo' })
    ]));
  });

  it('POST /api/pagos rechaza TARJETA como metodo de propina nuevo', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 30,
        total: 30
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: pedido.id,
        monto: 30,
        metodo: 'EFECTIVO',
        propinaMonto: 5,
        propinaMetodo: 'TARJETA'
      })
      .expect(400);

    expect(response.body.error.message).toBe('Datos inválidos');
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'propinaMetodo' })
    ]));
  });

  it('POST /api/pagos rechaza QR_PRESENCIAL como canal de cobro nuevo', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 30,
        total: 30
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: pedido.id,
        monto: 30,
        metodo: 'MERCADOPAGO',
        canalCobro: 'QR_PRESENCIAL'
      })
      .expect(400);

    expect(response.body.error.message).toBe('Datos inválidos');
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'canalCobro' })
    ]));
  });

  it('POST /api/pagos/qr/orden ya no esta disponible', async () => {
    await request(app)
      .post('/api/pagos/qr/orden')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: 1,
        propinaMonto: 0
      })
      .expect(404);
  });

  it('POST /api/pagos/reembolso rechaza monto menor o igual a 0', async () => {
    const { pago } = await crearPedidoConPagoAprobado(100);

    const response = await request(app)
      .post('/api/pagos/reembolso')
      .set('Authorization', authHeader(token))
      .send({
        pagoId: pago.id,
        monto: 0,
        motivo: 'Carga invalida'
      })
      .expect(400);

    expect(response.body.error.message).toBe('Datos inválidos');
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'monto' })
    ]));
  });

  it('POST /api/pagos/reembolso rechaza monto NaN o faltante', async () => {
    const { pago } = await crearPedidoConPagoAprobado(100);

    const [nanResponse, missingResponse] = await Promise.all([
      request(app)
        .post('/api/pagos/reembolso')
        .set('Authorization', authHeader(token))
        .send({
          pagoId: pago.id,
          monto: 'NaN',
          motivo: 'Carga invalida'
        })
        .expect(400),
      request(app)
        .post('/api/pagos/reembolso')
        .set('Authorization', authHeader(token))
        .send({
          pagoId: pago.id,
          motivo: 'Falta monto'
        })
        .expect(400)
    ]);

    expect(nanResponse.body.error.message).toBe('Datos inválidos');
    expect(missingResponse.body.error.message).toBe('Datos inválidos');
  });

  it('POST /api/pagos/reembolso no permite aumentar saldo con payload invalido', async () => {
    const { pedido, pago } = await crearPedidoConPagoAprobado(100);

    await request(app)
      .post('/api/pagos/reembolso')
      .set('Authorization', authHeader(token))
      .send({
        pagoId: pago.id,
        monto: -10,
        motivo: 'Intento malicioso'
      })
      .expect(400);

    const estadoCobro = await request(app)
      .get(`/api/pagos/pedido/${pedido.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Number(estadoCobro.body.totalPagado)).toBe(100);
    expect(Number(estadoCobro.body.pendiente)).toBe(0);
  });

  it('GET /api/pagos/mercadopago/transferencia-config devuelve alias, titular y cvu', async () => {
    await prisma.configuracion.upsert({
      where: { clave: 'mercadopago_transfer_alias' },
      update: { valor: 'mi-local.mp' },
      create: { clave: 'mercadopago_transfer_alias', valor: 'mi-local.mp' }
    });
    await prisma.configuracion.upsert({
      where: { clave: 'mercadopago_transfer_titular' },
      update: { valor: 'Mi Local SA' },
      create: { clave: 'mercadopago_transfer_titular', valor: 'Mi Local SA' }
    });
    await prisma.configuracion.upsert({
      where: { clave: 'mercadopago_transfer_cvu' },
      update: { valor: '0000003100000000000001' },
      create: { clave: 'mercadopago_transfer_cvu', valor: '0000003100000000000001' }
    });

    const response = await request(app)
      .get('/api/pagos/mercadopago/transferencia-config')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body).toEqual({
      alias: 'mi-local.mp',
      titular: 'Mi Local SA',
      cvu: '0000003100000000000001'
    });
  });

  it('POST /api/pagos/mercadopago/preferencia crea preferencia mock', async () => {
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
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
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
        cantidad: 1,
        precioUnitario: 10,
        subtotal: 10
      }
    });

    const response = await request(app)
      .post('/api/pagos/mercadopago/preferencia')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id })
      .expect(200);

    expect(response.body.preferencia).toBeDefined();
    expect(response.body.preferencia.id).toMatch(`PREF_${pedido.id}_`);
    expect(response.body.preferencia.init_point).toContain('mercadopago.com.ar');
  });
});
