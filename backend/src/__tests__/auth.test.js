const request = require('supertest');
const app = require('../app');
const {
  uniqueId,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

describe('Auth Endpoints', () => {
  let originalTrustProxy;
  let adminToken;
  let loginEmail;
  const loginPassword = 'passwordSeguro123';

  beforeAll(async () => {
    originalTrustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
    await cleanupOperationalData();
    await ensureNegocio();

    const admin = await createUsuario({
      email: `${uniqueId('admin-auth')}@example.com`,
      rol: 'ADMIN'
    });
    adminToken = signTokenForUser(admin);

    const loginUser = await createUsuario({
      email: `${uniqueId('login-auth')}@example.com`,
      passwordPlano: loginPassword,
      rol: 'MOZO'
    });
    loginEmail = loginUser.email;
  });

  afterAll(async () => {
    await cleanupOperationalData();
    app.set('trust proxy', originalTrustProxy);
  });

  const loginAttempt = (email, ip = '198.51.100.10') => request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({
      email,
      password: 'passwordIncorrecto'
    });

  describe('POST /api/auth/login', () => {
    it('should return 401 for invalid credentials', async () => {
      const response = await loginAttempt('usuario@inexistente.com')
        .expect(401);

      expect(response.body.error.message).toBe('Credenciales invalidas');
    });

    it('should return error for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Datos inválidos');
      expect(response.body.error.details).toBeDefined();
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'test'
        });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should login with email normalized from uppercase and surrounding spaces', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: ` ${loginEmail.toUpperCase()} `,
          password: loginPassword
        })
        .expect(200);

      expect(response.body.usuario.email).toBe(loginEmail);
    });

    it('should not share the rate limit bucket across different emails on the same IP', async () => {
      const sharedIp = '198.51.100.20';

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await loginAttempt('primer.usuario@example.com', sharedIp);
        expect(response.status).toBe(401);
      }

      const response = await loginAttempt('segundo.usuario@example.com', sharedIp);

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Credenciales invalidas');
    });

    it('should rate limit repeated attempts for the same normalized email and IP', async () => {
      const sharedIp = '198.51.100.21';
      const emailVariants = [
        'MISMO.USUARIO@example.com',
        'mismo.usuario@example.com',
        'Mismo.Usuario@example.com'
      ];

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await loginAttempt(emailVariants[attempt % emailVariants.length], sharedIp);
        expect(response.status).toBe(401);
      }

      const response = await loginAttempt(' mismo.usuario@example.com ', sharedIp);

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: {
          message: 'Demasiados intentos de login. Intente nuevamente en unos minutos.'
        }
      });
    });

    it('should reject registration when email collides after normalization', async () => {
      const existingEmail = `${uniqueId('registro-dup')}@example.com`;
      await createUsuario({
        email: existingEmail,
        rol: 'MOZO'
      });

      const response = await request(app)
        .post('/api/auth/registrar')
        .set('Authorization', authHeader(adminToken))
        .send({
          email: ` ${existingEmail.toUpperCase()} `,
          password: 'otraClave123',
          nombre: 'Nuevo Usuario',
          rol: 'CAJERO'
        })
        .expect(400);

      expect(response.body.error.message).toBe('El email ya esta registrado');
    });
  });

  describe('GET /api/auth/perfil', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/perfil')
        .expect(401);

      expect(response.body.error.message).toBe('Token no proporcionado');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', 'Bearer token_invalido')
        .expect(401);

      expect(response.body.error.message).toBe('Token invalido');
    });
  });
});
