const request = require('supertest');
const app = require('../app');
const { decodeBase32 } = require('../utils/base32');
const { MFA_PREAUTH_COOKIE, TRUSTED_DEVICE_COOKIE } = require('../services/mfa.service');
const {
  uniqueId,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

const TOTP_STEP_MS = 30 * 1000;

const computeTotp = (secret, timestamp = Date.now()) => {
  const crypto = require('crypto');
  const key = decodeBase32(secret);
  const counter = Math.floor(timestamp / TOTP_STEP_MS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3]
  ) % 1000000;

  return String(code).padStart(6, '0');
};

const findCookie = (response, name) => response.headers['set-cookie']?.find((cookie) => (
  cookie.startsWith(`${name}=`)
))?.split(';')[0];

describe('Auth Endpoints', () => {
  let originalTrustProxy;
  let originalNodeEnv;
  let originalMfaRequiredRoles;
  let adminToken;
  let loginEmail;
  const loginPassword = 'passwordSeguro123';

  beforeAll(async () => {
    originalTrustProxy = app.get('trust proxy');
    originalNodeEnv = process.env.NODE_ENV;
    originalMfaRequiredRoles = process.env.MFA_REQUIRED_ROLES;
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

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.MFA_REQUIRED_ROLES;
  });

  afterAll(async () => {
    await cleanupOperationalData();
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMfaRequiredRoles == null) {
      delete process.env.MFA_REQUIRED_ROLES;
    } else {
      process.env.MFA_REQUIRED_ROLES = originalMfaRequiredRoles;
    }
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

    it('should not require MFA challenge by default in test env', async () => {
      const admin = await createUsuario({
        email: `${uniqueId('admin-mfa')}@example.com`,
        passwordPlano: loginPassword,
        rol: 'ADMIN'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: admin.email,
          password: loginPassword
        })
        .expect(200);

      expect(response.body.next).toBeUndefined();
      expect(response.body.usuario.email).toBe(admin.email);
    });

    it('should require MFA setup for ADMIN in production by default', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.MFA_REQUIRED_ROLES;

      const admin = await createUsuario({
        email: `${uniqueId('admin-mfa-prod')}@example.com`,
        passwordPlano: loginPassword,
        rol: 'ADMIN'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: admin.email,
          password: loginPassword
        })
        .expect(202);

      expect(response.body).toMatchObject({
        next: 'MFA_SETUP_REQUIRED',
        usuario: {
          id: admin.id,
          email: admin.email,
          rol: 'ADMIN'
        }
      });
      expect(findCookie(response, MFA_PREAUTH_COOKIE)).toBeDefined();
    });

    it('should require MFA setup for CAJERO in production by default', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.MFA_REQUIRED_ROLES;

      const cajero = await createUsuario({
        email: `${uniqueId('cajero-mfa-prod')}@example.com`,
        passwordPlano: loginPassword,
        rol: 'CAJERO'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: cajero.email,
          password: loginPassword
        })
        .expect(202);

      expect(response.body).toMatchObject({
        next: 'MFA_SETUP_REQUIRED',
        usuario: {
          id: cajero.id,
          email: cajero.email,
          rol: 'CAJERO'
        }
      });
      expect(findCookie(response, MFA_PREAUTH_COOKIE)).toBeDefined();
    });

    it('should confirm MFA setup and trust the device for ADMIN users', async () => {
      process.env.MFA_REQUIRED_ROLES = 'ADMIN';

      const agent = request.agent(app);
      const admin = await createUsuario({
        email: `${uniqueId('admin-mfa-setup')}@example.com`,
        passwordPlano: loginPassword,
        rol: 'ADMIN'
      });

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: admin.email,
          password: loginPassword
        })
        .expect(202);

      expect(findCookie(loginResponse, MFA_PREAUTH_COOKIE)).toBeDefined();

      const setupResponse = await agent
        .get('/api/auth/mfa/setup')
        .expect(200);

      const confirmResponse = await agent
        .post('/api/auth/mfa/setup/confirm')
        .send({
          code: computeTotp(setupResponse.body.secret),
          trustDevice: true
        })
        .expect(200);

      expect(confirmResponse.body.recoveryCodes).toHaveLength(8);
      expect(findCookie(confirmResponse, TRUSTED_DEVICE_COOKIE)).toBeDefined();
      expect(confirmResponse.body.usuario.email).toBe(admin.email);
    });

    it('should skip the MFA challenge on a remembered device', async () => {
      process.env.MFA_REQUIRED_ROLES = 'ADMIN';

      const agent = request.agent(app);
      const admin = await createUsuario({
        email: `${uniqueId('admin-mfa-trusted')}@example.com`,
        passwordPlano: loginPassword,
        rol: 'ADMIN'
      });

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: admin.email,
          password: loginPassword
        })
        .expect(202);

      expect(findCookie(loginResponse, MFA_PREAUTH_COOKIE)).toBeDefined();

      const setupResponse = await agent
        .get('/api/auth/mfa/setup')
        .expect(200);

      const confirmResponse = await agent
        .post('/api/auth/mfa/setup/confirm')
        .send({
          code: computeTotp(setupResponse.body.secret),
          trustDevice: true
        })
        .expect(200);

      const trustedDeviceCookie = findCookie(confirmResponse, TRUSTED_DEVICE_COOKIE);

      const rememberedLogin = await request(app)
        .post('/api/auth/login')
        .set('Cookie', trustedDeviceCookie)
        .send({
          email: admin.email,
          password: loginPassword
        })
        .expect(200);

      expect(rememberedLogin.body.usuario.email).toBe(admin.email);
      expect(rememberedLogin.body.next).toBeUndefined();
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
