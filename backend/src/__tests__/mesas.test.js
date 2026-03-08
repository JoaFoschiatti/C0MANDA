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

describe('Mesas Endpoints', () => {
  let tokenAdmin;
  let tokenMozo;

  beforeAll(async () => {
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

  it('POST /api/mesas crea mesa (ADMIN) y rechaza duplicados', async () => {
    const creada = await request(app)
      .post('/api/mesas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({ numero: 1, zona: 'Salon', capacidad: 4 })
      .expect(201);

    expect(creada.body.id).toBeDefined();
    expect(creada.body.numero).toBe(1);
    expect(creada.body.estado).toBe('LIBRE');
    expect(creada.body.activa).toBe(true);

    const duplicada = await request(app)
      .post('/api/mesas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({ numero: 1 })
      .expect(400);

    expect(duplicada.body.error.message).toBe('Ya existe una mesa con ese número');
  });

  it('POST /api/mesas rechaza creacion si no es ADMIN', async () => {
    await request(app)
      .post('/api/mesas')
      .set('Authorization', authHeader(tokenMozo))
      .send({ numero: 2 })
      .expect(403);
  });

  it('GET /api/mesas lista mesas y filtra por estado/activa', async () => {
    await prisma.mesa.create({
      data: {
        numero: 10,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const listado = await request(app)
      .get('/api/mesas')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const numeros = listado.body.map((mesa) => mesa.numero);
    expect(numeros).toContain(1);
    expect(numeros).toContain(10);

    const ocupadas = await request(app)
      .get('/api/mesas?estado=OCUPADA')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(ocupadas.body.every((mesa) => mesa.estado === 'OCUPADA')).toBe(true);
  });

  it('PATCH /api/mesas/:id/estado permite cambiar estado (MOZO)', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 20,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const response = await request(app)
      .patch(`/api/mesas/${mesa.id}/estado`)
      .set('Authorization', authHeader(tokenMozo))
      .send({ estado: 'RESERVADA' })
      .expect(200);

    expect(response.body.id).toBe(mesa.id);
    expect(response.body.estado).toBe('RESERVADA');
  });

  it('DELETE /api/mesas/:id hace soft delete (activa=false) y permite filtrar activa=false', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 30,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const response = await request(app)
      .delete(`/api/mesas/${mesa.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(response.body.message).toBe('Mesa desactivada correctamente');

    const inactivas = await request(app)
      .get('/api/mesas?activa=false')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const ids = inactivas.body.map((item) => item.id);
    expect(ids).toContain(mesa.id);
  });
});
