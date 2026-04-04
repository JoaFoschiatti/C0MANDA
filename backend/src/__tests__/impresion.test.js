const request = require('supertest');
const app = require('../app');
const { buildExpectedSignature } = require('../services/bridge-auth.service');
const {
  prisma,
  uniqueId,
    createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

const signBridgeRequest = (path, body, bridgeId = body?.bridgeId || 'bridge-test') => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = uniqueId('nonce');

  return {
    'x-bridge-id': bridgeId,
    'x-bridge-ts': timestamp,
    'x-bridge-nonce': nonce,
    'x-bridge-signature': buildExpectedSignature({
      method: 'POST',
      path,
      timestamp,
      nonce,
      body
    })
  };
};

describe('Impresion Endpoints', () => {
    let token;
  let pedido;
  let producto;

  beforeAll(async () => {
    process.env.BRIDGE_TOKEN = 'test-bridge-token';
    process.env.BRIDGE_ALLOWED_IPS = '127.0.0.1,::1,::ffff:127.0.0.1';

        await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });
    pedido = await prisma.pedido.create({
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
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/impresion/comanda/:pedidoId encola jobs', async () => {
    const response = await request(app)
      .post(`/api/impresion/comanda/${pedido.id}`)
      .set('Authorization', authHeader(token))
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.total).toBe(3);
    expect(response.body.batchId).toBeDefined();

    const jobs = await prisma.printJob.findMany({
      where: { pedidoId: pedido.id }
    });
    expect(jobs.length).toBe(3);
  });

  it('GET /api/impresion/comanda/:pedidoId/preview devuelve texto', async () => {
    const response = await request(app)
      .get(`/api/impresion/comanda/${pedido.id}/preview?tipo=CAJA`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain(`Pedido: #${pedido.id}`);
    expect(response.text).toContain(producto.nombre);
  });

  it('Bridge: POST /api/impresion/jobs/claim devuelve trabajos globales', async () => {
    const body = { bridgeId: 'bridge-test', limit: 1 };
    const response = await request(app)
      .post('/api/impresion/jobs/claim')
      .set(signBridgeRequest('/api/impresion/jobs/claim', body))
      .send(body)
      .expect(200);

    expect(response.body.jobs).toHaveLength(1);
    expect(response.body.jobs[0].pedidoId).toBe(pedido.id);
  });

  it('Bridge: claim/ack/fail opera en instalacion unica', async () => {
    const claimBody = { bridgeId: 'bridge-test', limit: 3 };
    const claimed = await request(app)
      .post('/api/impresion/jobs/claim')
      .set(signBridgeRequest('/api/impresion/jobs/claim', claimBody))
      .send(claimBody)
      .expect(200);

    expect(claimed.body.jobs.length).toBeGreaterThan(0);
    expect(claimed.body.jobs.length).toBeLessThanOrEqual(3);

    const [jobA, jobB] = claimed.body.jobs;
    expect(jobA).toBeDefined();
    expect(jobB).toBeDefined();

    const ackBody = { bridgeId: 'bridge-test' };
    await request(app)
      .post(`/api/impresion/jobs/${jobA.id}/ack`)
      .set(signBridgeRequest(`/api/impresion/jobs/${jobA.id}/ack`, ackBody))
      .send(ackBody)
      .expect(200);

    const jobAUpdated = await prisma.printJob.findUnique({ where: { id: jobA.id } });
    expect(jobAUpdated.status).toBe('OK');

    const failBody = { bridgeId: 'bridge-test', error: 'Printer error' };
    await request(app)
      .post(`/api/impresion/jobs/${jobB.id}/fail`)
      .set(signBridgeRequest(`/api/impresion/jobs/${jobB.id}/fail`, failBody))
      .send(failBody)
      .expect(200);

    const jobBUpdated = await prisma.printJob.findUnique({ where: { id: jobB.id } });
    expect(['PENDIENTE', 'ERROR']).toContain(jobBUpdated.status);
  });
});
