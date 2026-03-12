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

describe('Usuarios Endpoints', () => {
  let tokenAdmin;

  beforeAll(async () => {
    await cleanupOperationalData();
    await ensureNegocio();

    const admin = await createUsuario({
      email: `${uniqueId('admin-usuarios')}@example.com`,
      rol: 'ADMIN'
    });
    tokenAdmin = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/usuarios canonicaliza el email y rechaza duplicados case-insensitive', async () => {
    const creado = await request(app)
      .post('/api/usuarios')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        nombre: 'Usuario Nuevo',
        email: ' Nuevo.Usuario@Example.com ',
        password: 'claveSegura123',
        rol: 'MOZO'
      })
      .expect(201);

    expect(creado.body.email).toBe('nuevo.usuario@example.com');

    const duplicado = await request(app)
      .post('/api/usuarios')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        nombre: 'Duplicado',
        email: 'NUEVO.USUARIO@example.com',
        password: 'claveSegura123',
        rol: 'CAJERO'
      })
      .expect(400);

    expect(duplicado.body.error.message).toBe('Ya existe un usuario con ese Email');
  });

  it('PUT /api/usuarios/:id canonicaliza el email actualizado', async () => {
    const usuario = await createUsuario({
      email: `${uniqueId('usuario-actualizar')}@example.com`,
      rol: 'MOZO'
    });

    const response = await request(app)
      .put(`/api/usuarios/${usuario.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        email: ' Actualizado.Usuario@Example.com '
      })
      .expect(200);

    expect(response.body.email).toBe('actualizado.usuario@example.com');

    const persistido = await prisma.usuario.findUnique({
      where: { id: usuario.id }
    });

    expect(persistido.email).toBe('actualizado.usuario@example.com');
  });
});
