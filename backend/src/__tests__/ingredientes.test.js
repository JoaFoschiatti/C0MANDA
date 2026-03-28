const request = require('supertest');
const app = require('../app');
const { SUCURSAL_IDS } = require('../constants/sucursales');
const {
  prisma,
  uniqueId,
    createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

describe('Ingredientes Endpoints', () => {
    let token;

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

  it('POST /api/ingredientes crea ingrediente y movimiento inicial', async () => {
    const response = await request(app)
      .post('/api/ingredientes')
      .set('Authorization', authHeader(token))
      .send({
        nombre: 'Harina',
        unidad: 'kg',
        stockActual: 5,
        stockMinimo: 1,
        costo: 100
      })
      .expect(201);

    expect(response.body.id).toBeDefined();

    const detalle = await request(app)
      .get(`/api/ingredientes/${response.body.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(detalle.body.movimientos.length).toBeGreaterThan(0);
    expect(detalle.body.movimientos[0].tipo).toBe('ENTRADA');
    expect(detalle.body.movimientos[0].motivo).toBe('Stock inicial');
  });

  it('POST /api/ingredientes/:id/movimiento valida stock insuficiente', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('i')}`,
        unidad: 'unidades',
        stockActual: 1,
        stockMinimo: 0,
        activo: true
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/movimiento`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SALIDA', cantidad: 10, motivo: 'Prueba' })
      .expect(400);

    expect(response.body.error.message).toBe('Stock insuficiente');
  });

  it('POST /api/ingredientes/:id/ajuste registra AJUSTE y actualiza stock', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('aj')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 0,
        activo: true
      }
    });

    await prisma.ingredienteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        sucursalId: SUCURSAL_IDS.SALON,
        stockActual: 2,
        stockMinimo: 0,
        activo: true
      }
    });

    await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        sucursalId: SUCURSAL_IDS.SALON,
        codigoLote: `LOT-${uniqueId('aj')}`,
        stockInicial: 2,
        stockActual: 2,
        fechaIngreso: new Date('2026-03-20T10:00:00.000Z')
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/ajuste`)
      .set('Authorization', authHeader(token))
      .send({ stockReal: 7, motivo: 'Conteo' })
      .expect(200);

    expect(Number(response.body.stockActual)).toBe(7);

    const detalle = await request(app)
      .get(`/api/ingredientes/${ingrediente.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(detalle.body.movimientos[0].tipo).toBe('AJUSTE');
    expect(Number(detalle.body.movimientos[0].cantidad)).toBe(5);
  });

  it('POST /api/ingredientes/:id/movimiento crea o actualiza lotes para entradas', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('lote')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 0,
        costo: 120,
        activo: true
      }
    });

    await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/movimiento`)
      .set('Authorization', authHeader(token))
      .send({
        tipo: 'ENTRADA',
        cantidad: 3.5,
        motivo: 'Compra proveedor',
        codigoLote: 'LOTE-ABC-01',
        fechaVencimiento: '2026-12-31',
        costoUnitario: 150
      })
      .expect(200);

    const detalle = await request(app)
      .get(`/api/ingredientes/${ingrediente.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Number(detalle.body.stockActual)).toBe(3.5);
    expect(detalle.body.lotes).toHaveLength(1);
    expect(detalle.body.lotes[0].codigoLote).toBe('LOTE-ABC-01');
    expect(Number(detalle.body.lotes[0].stockActual)).toBe(3.5);
    expect(Number(detalle.body.lotes[0].costoUnitario)).toBe(150);
    expect(detalle.body.movimientos[0].loteStockId).toBe(detalle.body.lotes[0].id);
  });

  it('POST /api/ingredientes/:id/movimiento excluye lotes vencidos del stock consumible', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('vence')}`,
        unidad: 'kg',
        stockActual: 5,
        stockMinimo: 1,
        activo: true
      }
    });

    await prisma.loteStock.createMany({
      data: [
        {
          ingredienteId: ingrediente.id,
          codigoLote: `LOT-${uniqueId('exp')}`,
          stockInicial: 4,
          stockActual: 4,
          fechaIngreso: new Date('2026-01-05T10:00:00.000Z'),
          fechaVencimiento: new Date('2026-02-01T23:59:59.999Z')
        },
        {
          ingredienteId: ingrediente.id,
          codigoLote: `LOT-${uniqueId('vig')}`,
          stockInicial: 1,
          stockActual: 1,
          fechaIngreso: new Date('2026-02-05T10:00:00.000Z')
        }
      ]
    });

    await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/movimiento`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SALIDA', cantidad: 2, motivo: 'Consumo' })
      .expect(400);

    const detalle = await request(app)
      .get(`/api/ingredientes/${ingrediente.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Number(detalle.body.stockActual)).toBe(1);
    expect(Number(detalle.body.stockFisico)).toBe(5);
    expect(Number(detalle.body.stockNoConsumible)).toBe(4);
    expect(detalle.body.lotes.some((lote) => lote.estadoLote === 'VENCIDO')).toBe(true);
  });

  it('POST /api/ingredientes/lotes/:id/descartar exige descarte manual para lotes vencidos', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('desc')}`,
        unidad: 'kg',
        stockActual: 2,
        stockMinimo: 0,
        activo: true
      }
    });

    const loteVencido = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('desc')}`,
        stockInicial: 2,
        stockActual: 2,
        fechaIngreso: new Date('2026-01-10T10:00:00.000Z'),
        fechaVencimiento: new Date('2026-02-10T23:59:59.999Z')
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/lotes/${loteVencido.id}/descartar`)
      .set('Authorization', authHeader(token))
      .send({
        cantidad: 1.5,
        motivo: 'Vencimiento detectado en control diario'
      })
      .expect(200);

    expect(Number(response.body.lote.stockActual)).toBe(0.5);
    expect(Number(response.body.movimiento.cantidad)).toBe(1.5);
    expect(response.body.movimiento.tipo).toBe('AJUSTE');
    expect(Number(response.body.ingrediente.stockActual)).toBe(0);
    expect(Number(response.body.ingrediente.stockNoConsumible)).toBe(0.5);
    expect(Number(response.body.ingrediente.stockFisico)).toBe(0.5);

    const loteActualizado = await prisma.loteStock.findUnique({
      where: { id: loteVencido.id }
    });

    expect(Number(loteActualizado.stockActual)).toBe(0.5);
  });

  it('GET /api/ingredientes/alertas devuelve solo ingredientes activos con stock bajo', async () => {
    const ingredienteBajo = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('bajo')}`,
        unidad: 'kg',
        stockActual: 1,
        stockMinimo: 2,
        activo: true
      }
    });

    await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ok')}`,
        unidad: 'kg',
        stockActual: 10,
        stockMinimo: 2,
        activo: true
      }
    });

    await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('inact')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 2,
        activo: false
      }
    });

    const response = await request(app)
      .get('/api/ingredientes/alertas')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.map((ingrediente) => ingrediente.id);
    expect(ids).toContain(ingredienteBajo.id);
    expect(response.body.every((ingrediente) => ingrediente.activo === true)).toBe(true);
  });
});
