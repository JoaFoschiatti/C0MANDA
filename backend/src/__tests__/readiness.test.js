const request = require('supertest');

describe('Readiness Endpoint - degraded states', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns 503 when readiness checks fail', async () => {
    jest.doMock('../services/health.service', () => ({
      getReadinessStatus: jest.fn().mockResolvedValue({
        status: 'error',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error', message: 'DB offline' },
          bootstrap: { status: 'ok' },
          filesystem: { status: 'ok' }
        }
      })
    }));

    const app = require('../app');

    const response = await request(app)
      .get('/api/ready')
      .expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.checks.database.message).toBe('DB offline');
  });
});
