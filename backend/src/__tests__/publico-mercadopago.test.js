const request = require('supertest');
const {
  PUBLIC_ORDER_COOKIE_NAME,
  signPublicOrderToken
} = require('../utils/public-order-access');

const mockCreatePreference = jest.fn();
const mockSearchPaymentByReference = jest.fn();
const mockSaveTransaction = jest.fn();

jest.mock('../services/mercadopago.service', () => {
  const actual = jest.requireActual('../services/mercadopago.service');
  return {
    ...actual,
    createPreference: (...args) => mockCreatePreference(...args),
    searchPaymentByReference: (...args) => mockSearchPaymentByReference(...args),
    saveTransaction: (...args) => mockSaveTransaction(...args)
  };
});

const app = require('../app');
const eventBus = require('../services/event-bus');
const {
  prisma,
  uniqueId,
  ensureNegocio,
  cleanupOperationalData
} = require('./helpers/test-helpers');

const withPublicOrderCookie = (testRequest, pedidoId, token = signPublicOrderToken(pedidoId)) => (
  testRequest.set('Cookie', [`${PUBLIC_ORDER_COOKIE_NAME}=${token}`])
);

describe('Publico MercadoPago', () => {
  beforeEach(async () => {
    await cleanupOperationalData();
    await ensureNegocio();

    await prisma.mercadoPagoConfig.create({
      data: {
        id: 1,
        accessToken: 'dummy-token',
        isActive: true,
        isOAuth: false
      }
    });

    await prisma.configuracion.create({
      data: {
        clave: 'mercadopago_enabled',
        valor: 'true'
      }
    });

    mockCreatePreference.mockReset();
    mockSearchPaymentByReference.mockReset();
    mockSaveTransaction.mockReset();
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/publico/pedido con MERCADOPAGO crea preferencia y pago pendiente', async () => {
    const agent = request.agent(app);
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 123,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    mockCreatePreference.mockResolvedValue({
      id: 'PREF_TEST',
      init_point: 'https://mercadopago.test/init'
    });

    const response = await agent
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'MERCADOPAGO'
      })
      .expect(201);

    expect(response.body.initPoint).toBe('https://mercadopago.test/init');
    expect(response.body.accessToken).toBeUndefined();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('public_order_access=')])
    );
    expect(response.body.pedido.origen).toBe('MENU_PUBLICO');
    expect(response.body.pedido.operacionConfirmada).toBe(false);

    const pagos = await prisma.pago.findMany({ where: { pedidoId: response.body.pedido.id } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].metodo).toBe('MERCADOPAGO');
    expect(pagos[0].estado).toBe('PENDIENTE');
    expect(pagos[0].mpPreferenceId).toBe('PREF_TEST');
  });

  it('POST /api/publico/pedido reutiliza el mismo pedido con clientRequestId y no duplica la orden', async () => {
    const agent = request.agent(app);
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-idem')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod-idem')}`,
        precio: 123,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    mockCreatePreference
      .mockResolvedValueOnce({
        id: 'PREF_IDEM_1',
        init_point: 'https://mercadopago.test/init-1'
      })
      .mockResolvedValueOnce({
        id: 'PREF_IDEM_2',
        init_point: 'https://mercadopago.test/init-2'
      });

    const payload = {
      items: [{ productoId: producto.id, cantidad: 1 }],
      clienteNombre: 'Cliente Test',
      clienteTelefono: '3410000000',
      tipoEntrega: 'RETIRO',
      metodoPago: 'MERCADOPAGO',
      clientRequestId: 'request-idem-1'
    };

    const firstResponse = await agent
      .post('/api/publico/pedido')
      .send(payload)
      .expect(201);

    const secondResponse = await agent
      .post('/api/publico/pedido')
      .send(payload)
      .expect(201);

    expect(firstResponse.body.pedido.id).toBe(secondResponse.body.pedido.id);
    expect(secondResponse.body.initPoint).toBe('https://mercadopago.test/init-2');

    const pedidos = await prisma.pedido.findMany({
      where: { clientRequestId: 'request-idem-1' }
    });
    expect(pedidos).toHaveLength(1);

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: firstResponse.body.pedido.id },
      orderBy: { createdAt: 'asc' }
    });
    expect(pagos).toHaveLength(2);
    expect(pagos.filter((pago) => pago.estado === 'PENDIENTE')).toHaveLength(1);
    expect(pagos.filter((pago) => pago.estado === 'CANCELADO')).toHaveLength(1);
  });

  it('POST /api/publico/pedido rechaza MP si esta deshabilitado', async () => {
    await prisma.configuracion.update({
      where: { clave: 'mercadopago_enabled' },
      data: { valor: 'false' }
    });

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-off')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod-off')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'MERCADOPAGO'
      })
      .expect(400);

    expect(response.body.error.message).toBe('MercadoPago no esta disponible en este momento');
  });

  it('POST /api/publico/pedido/:id/pagar crea un nuevo pago pendiente y devuelve initPoint', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50,
        estadoPago: 'PENDIENTE',
        origen: 'MENU_PUBLICO'
      }
    });

    mockCreatePreference.mockResolvedValue({
      id: 'PREF_PAY',
      init_point: 'https://mercadopago.test/pay',
      sandbox_init_point: 'https://sandbox.mercadopago.test/pay'
    });

    const response = await withPublicOrderCookie(
      request(app).post(`/api/publico/pedido/${pedido.id}/pagar`),
      pedido.id
    )
      .expect(200);

    expect(response.body.preferenceId).toBe('PREF_PAY');
    expect(response.body.initPoint).toBe('https://mercadopago.test/pay');
    expect(response.body.sandboxInitPoint).toBe('https://sandbox.mercadopago.test/pay');

    const pagos = await prisma.pago.findMany({ where: { pedidoId: pedido.id } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].mpPreferenceId).toBe('PREF_PAY');
    expect(pagos[0].estado).toBe('PENDIENTE');
  });

  it('GET /api/publico/pedido/:id actualiza estadoPago si searchPaymentByReference devuelve aprobado', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 50,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50,
        estadoPago: 'PENDIENTE',
        origen: 'MENU_PUBLICO',
        items: {
          create: [{
            productoId: producto.id,
            cantidad: 1,
            precioUnitario: 50,
            subtotal: 50
          }]
        }
      }
    });

    const pago = await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        canalCobro: 'CHECKOUT_WEB',
        estado: 'PENDIENTE',
        mpPreferenceId: 'PREF_PENDING',
        idempotencyKey: `mp-${pedido.id}-${Date.now()}`
      }
    });

    mockSearchPaymentByReference.mockResolvedValue({
      id: 555,
      status: 'approved'
    });
    mockSaveTransaction.mockResolvedValue({});

    const captured = [];
    const unsubscribe = eventBus.subscribe((event) => captured.push(event));

    try {
      const response = await withPublicOrderCookie(
        request(app).get(`/api/publico/pedido/${pedido.id}`),
        pedido.id
      )
        .expect(200);

      expect(response.body.estadoPago).toBe('APROBADO');
      expect(response.body.estado).toBe('PENDIENTE');
      expect(response.body.operacionConfirmada).toBe(true);
      expect(response.body.clienteTelefono).toBeUndefined();
      expect(response.body.clienteDireccion).toBeUndefined();
      expect(response.body.clienteEmail).toBeUndefined();
      const pagoEnRespuesta = response.body.pagos.find((item) => item.id === pago.id);
      expect(pagoEnRespuesta.estado).toBe('APROBADO');
      expect(pagoEnRespuesta.mpPaymentId).toBe('555');

      const pagoActualizado = await prisma.pago.findUnique({ where: { id: pago.id } });
      expect(pagoActualizado.estado).toBe('APROBADO');

      const pedidoActualizado = await prisma.pedido.findUnique({ where: { id: pedido.id } });
      expect(pedidoActualizado.estadoPago).toBe('APROBADO');
      expect(pedidoActualizado.estado).toBe('PENDIENTE');
      expect(pedidoActualizado.operacionConfirmada).toBe(true);

      const evento = captured.find((event) => event.type === 'pedido.updated' && event.payload?.id === pedido.id);
      expect(evento).toBeDefined();
      expect(evento.payload).toEqual(expect.objectContaining({
        id: pedido.id,
        estadoPago: 'APROBADO'
      }));
      expect(evento.payload.tipo).toBe('MOSTRADOR');
    } finally {
      unsubscribe();
    }
  });

  it('GET /api/publico/pedido/:id rechaza acceso sin cookie valida', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50,
        estadoPago: 'PENDIENTE',
        origen: 'MENU_PUBLICO'
      }
    });

    await withPublicOrderCookie(
      request(app).get(`/api/publico/pedido/${pedido.id}`),
      pedido.id,
      'token-invalido'
    )
      .expect(404);
  });
});
