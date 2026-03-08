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

describe('Fichajes Endpoints', () => {
    let token;
  let usuario;

  beforeAll(async () => {
        await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    usuario = await createUsuario({
      email: `${uniqueId('emp')}@example.com`,
      nombre: 'Empleado',
      rol: 'MOZO',
      tarifaHora: 1500
    });
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/fichajes/entrada crea fichaje y evita doble entrada', async () => {
    const creado = await request(app)
      .post('/api/fichajes/entrada')
      .set('Authorization', authHeader(token))
      .send({ usuarioId: usuario.id })
      .expect(201);

    expect(creado.body.id).toBeDefined();
    expect(creado.body.usuarioId).toBe(usuario.id);
    expect(creado.body.salida).toBe(null);
    expect(creado.body.usuario.nombre).toBe('Empleado');

    const duplicado = await request(app)
      .post('/api/fichajes/entrada')
      .set('Authorization', authHeader(token))
      .send({ usuarioId: usuario.id })
      .expect(400);

    expect(duplicado.body.error.message).toBe('El usuario ya tiene un fichaje de entrada sin salida');
  });

  it('POST /api/fichajes/salida cierra fichaje y evita salida sin entrada', async () => {
    const estadoAntes = await request(app)
      .get(`/api/fichajes/usuario/${usuario.id}/estado`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(estadoAntes.body.fichado).toBe(true);

    const salida = await request(app)
      .post('/api/fichajes/salida')
      .set('Authorization', authHeader(token))
      .send({ usuarioId: usuario.id })
      .expect(200);

    expect(salida.body.salida).toBeDefined();

    const estadoDespues = await request(app)
      .get(`/api/fichajes/usuario/${usuario.id}/estado`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(estadoDespues.body.fichado).toBe(false);

    const sinEntrada = await request(app)
      .post('/api/fichajes/salida')
      .set('Authorization', authHeader(token))
      .send({ usuarioId: usuario.id })
      .expect(400);

    expect(sinEntrada.body.error.message).toBe('No hay fichaje de entrada para registrar salida');
  });

  it('GET /api/fichajes/usuario/:usuarioId/horas calcula horas en período', async () => {
    // Crear un fichaje del día y fijar horas conocidas (2h 30m)
    const nuevo = await request(app)
      .post('/api/fichajes/entrada')
      .set('Authorization', authHeader(token))
      .send({ usuarioId: usuario.id })
      .expect(201);

    const inicio = new Date();
    inicio.setHours(10, 0, 0, 0);
    const fin = new Date();
    fin.setHours(12, 30, 0, 0);

    await request(app)
      .put(`/api/fichajes/${nuevo.body.id}`)
      .set('Authorization', authHeader(token))
      .send({ entrada: inicio.toISOString(), salida: fin.toISOString() })
      .expect(200);

    const now = new Date();
    const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const reporte = await request(app)
      .get(`/api/fichajes/usuario/${usuario.id}/horas?fechaDesde=${hoy}&fechaHasta=${hoy}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(reporte.body.usuarioId).toBe(usuario.id);
    expect(reporte.body.totalFichajes).toBeGreaterThanOrEqual(1);
    expect(reporte.body.horasTotales).toBeGreaterThanOrEqual(2.5);
  });
});
