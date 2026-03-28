const http = require('http');
const app = require('../app');
const eventBus = require('../services/event-bus');
const {
  prisma,
  uniqueId,
    createUsuario,
  signTokenForUser,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

describe('Eventos SSE', () => {
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

  it('emite eventos autenticados para la instalacion unica', async () => {
    const server = app.listen(0);

    try {
      const port = server.address().port;

      const received = await new Promise((resolve, reject) => {
        const req = http.request({
          method: 'GET',
          host: '127.0.0.1',
          port,
          path: '/api/eventos',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`
          }
        }, (res) => {
          try {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/event-stream/);
          } catch (assertError) {
            res.destroy();
            req.destroy();
            reject(assertError);
            return;
          }

          let buffer = '';

          const timeoutId = setTimeout(() => {
            res.destroy();
            req.destroy();
            reject(new Error('No se recibio evento SSE a tiempo'));
          }, 1500);

          const cleanup = () => {
            clearTimeout(timeoutId);
            res.removeAllListeners('data');
          };

          res.on('data', (chunk) => {
            buffer += chunk.toString('utf8');

            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const msg of messages) {
              if (msg.startsWith(':')) continue;

              const lines = msg.split('\n').filter(Boolean);
              const eventLine = lines.find((line) => line.startsWith('event:'));
              const dataLine = lines.find((line) => line.startsWith('data:'));

              if (!eventLine || !dataLine) continue;

              const eventType = eventLine.replace(/^event:\s*/, '');
              const dataRaw = dataLine.replace(/^data:\s*/, '');

              cleanup();
              res.destroy();
              req.destroy();
              resolve({ eventType, data: JSON.parse(dataRaw) });
              return;
            }
          });

          setImmediate(() => {
            eventBus.publish('test.ok', { ok: true });
          });
        });

        req.on('error', reject);
        req.end();
      });

      expect(received.eventType).toBe('test.ok');
      expect(received.data).toEqual({ ok: true });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
