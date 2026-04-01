const fs = require('fs');
const path = require('path');
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

describe('Negocio Endpoints', () => {
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

  beforeEach(async () => {
    await prisma.negocio.update({
      where: { id: 1 },
      data: {
        logo: null
      }
    });
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/negocio/logo sube imagen y guarda logo', async () => {
    const pngMinimal = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bf0a0000000049454e44ae426082',
      'hex'
    );

    const response = await request(app)
      .post('/api/negocio/logo')
      .set('Authorization', authHeader(token))
      .attach('logo', pngMinimal, { filename: 'logo.png', contentType: 'image/png' })
      .expect(200);

    expect(response.body.message).toBe('Logo subido correctamente');
    expect(response.body.url).toMatch(/^\/uploads\/logo-/);

    const filename = response.body.url.replace('/uploads/', '');
    const filePath = path.join(__dirname, '../../uploads', filename);

    expect(fs.existsSync(filePath)).toBe(true);

    const negocio = await prisma.negocio.findUnique({
      where: { id: 1 },
      select: { logo: true }
    });

    expect(negocio.logo).toBe(response.body.url);

    fs.unlinkSync(filePath);
  });
});
