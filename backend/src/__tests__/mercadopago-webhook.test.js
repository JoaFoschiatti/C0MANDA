const request = require('supertest');

const mockGetPayment = jest.fn();
const mockSaveTransaction = jest.fn();

jest.mock('../services/mercadopago.service', () => {
  const actual = jest.requireActual('../services/mercadopago.service');
  return {
    ...actual,
    getPayment: (...args) => mockGetPayment(...args),
    saveTransaction: (...args) => mockSaveTransaction(...args)
  };
});

const app = require('../app');
const {
  prisma,
  uniqueId,
  ensureNegocio,
  cleanupOperationalData
} = require('./helpers/test-helpers');

describe('MercadoPago Webhook', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_WEBHOOK_VERIFICATION = 'true';
  });

  beforeEach(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
    mockGetPayment.mockReset();
    mockSaveTransaction.mockReset();
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('actualiza el pago existente por mpPaymentId sin duplicar', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 100,
        total: 100
      }
    });

    const pagoExistente = await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 100,
        metodo: 'MERCADOPAGO',
        estado: 'PENDIENTE',
        mpPaymentId: '123',
        idempotencyKey: `mp-${pedido.id}-${uniqueId('idem')}`
      }
    });

    mockGetPayment.mockResolvedValue({
      id: 123,
      status: 'approved',
      transaction_amount: '100.00',
      external_reference: `pedido-${pedido.id}`,
      preference_id: 'PREF-123'
    });
    mockSaveTransaction.mockResolvedValue({});

    await request(app)
      .post('/api/pagos/webhook/mercadopago')
      .send({ type: 'payment', data: { id: '123' } })
      .expect(200);

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: pedido.id },
      orderBy: { id: 'asc' }
    });

    expect(pagos).toHaveLength(1);
    expect(pagos[0].id).toBe(pagoExistente.id);
    expect(pagos[0].estado).toBe('APROBADO');
    expect(pagos[0].mpPaymentId).toBe('123');
    expect(pagos[0].referencia).toBe('MP-123');

    const pedidoActual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(pedidoActual.estadoPago).toBe('APROBADO');

    await request(app)
      .post('/api/pagos/webhook/mercadopago')
      .send({ type: 'payment', data: { id: '123' } })
      .expect(200);

    const pagosDespues = await prisma.pago.findMany({
      where: { pedidoId: pedido.id }
    });
    expect(pagosDespues).toHaveLength(1);
  });

  it('matchea el pago pendiente por mpPreferenceId sin crear duplicado', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50
      }
    });

    const pagoPendiente = await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        estado: 'PENDIENTE',
        mpPreferenceId: 'PREF-XYZ',
        idempotencyKey: `mp-${pedido.id}-${uniqueId('idem')}`
      }
    });

    mockGetPayment.mockResolvedValue({
      id: 999,
      status: 'approved',
      transaction_amount: '50.00',
      external_reference: `pedido-${pedido.id}`,
      preference_id: 'PREF-XYZ'
    });
    mockSaveTransaction.mockResolvedValue({});

    await request(app)
      .post('/api/pagos/webhook/mercadopago')
      .send({ type: 'payment', data: { id: '999' } })
      .expect(200);

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: pedido.id },
      orderBy: { id: 'asc' }
    });

    expect(pagos).toHaveLength(1);
    expect(pagos[0].id).toBe(pagoPendiente.id);
    expect(pagos[0].estado).toBe('APROBADO');
    expect(pagos[0].mpPaymentId).toBe('999');
    expect(pagos[0].referencia).toBe('MP-999');
    expect(pagos[0].mpPreferenceId).toBe('PREF-XYZ');

    const pedidoActual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(pedidoActual.estadoPago).toBe('APROBADO');
  });
});
