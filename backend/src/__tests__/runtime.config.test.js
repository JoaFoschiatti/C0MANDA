const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ENCRYPTION_KEY_REGEX,
  ensureRuntimeDirectories,
  getRuntimePaths,
  validateProductionEnvironment
} = require('../config/runtime');

describe('runtime config', () => {
  it('validates a correct production environment', () => {
    expect(() => validateProductionEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/comanda?schema=public',
      DIRECT_URL: 'postgresql://user:pass@127.0.0.1:5432/comanda?schema=public',
      JWT_SECRET: '12345678901234567890123456789012',
      PUBLIC_ORDER_JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      FRONTEND_URL: 'https://comanda.example.com',
      BACKEND_URL: 'https://api.comanda.example.com',
      ENCRYPTION_KEY: 'a'.repeat(64),
      MERCADOPAGO_WEBHOOK_SECRET: 'webhook-secret',
      BRIDGE_TOKEN: 'bridge-token-123456'
    })).not.toThrow();
  });

  it('rejects incomplete production environment', () => {
    expect(() => validateProductionEnvironment({
      NODE_ENV: 'production',
      FRONTEND_URL: 'not-a-url',
      ENCRYPTION_KEY: 'short',
      JWT_SECRET: 'short'
    })).toThrow(/Configuracion invalida de produccion/);
  });

  it('rejects partial ARCA configuration', () => {
    expect(() => validateProductionEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/comanda?schema=public',
      DIRECT_URL: 'postgresql://user:pass@127.0.0.1:5432/comanda?schema=public',
      JWT_SECRET: '12345678901234567890123456789012',
      PUBLIC_ORDER_JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      FRONTEND_URL: 'https://comanda.example.com',
      BACKEND_URL: 'https://api.comanda.example.com',
      ENCRYPTION_KEY: 'b'.repeat(64),
      MERCADOPAGO_WEBHOOK_SECRET: 'webhook-secret',
      BRIDGE_TOKEN: 'bridge-token-123456',
      ARCA_CUIT: '30712345678'
    })).toThrow(/ARCA/);
  });

  it('ensures runtime directories are writable', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'comanda-runtime-'));
    const runtimePaths = getRuntimePaths(tempRoot);

    try {
      ensureRuntimeDirectories(runtimePaths);

      expect(fs.existsSync(runtimePaths.logsDir)).toBe(true);
      expect(fs.existsSync(runtimePaths.uploadsDir)).toBe(true);
      expect(ENCRYPTION_KEY_REGEX.test('c'.repeat(64))).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
