const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '../../..');
const baseEnvPath = path.join(projectRoot, '.env');
const testEnvPath = path.join(projectRoot, '.env.test');
const defaultTestEnvExamplePath = path.join(projectRoot, '.env.test.example');

const getSchemaFromUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsed = new URL(rawUrl);
    return parsed.searchParams.get('schema');
  } catch {
    const match = rawUrl.match(/[?&]schema=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
};

const assertIsolatedTestDatabase = (key, rawUrl) => {
  const schema = getSchemaFromUrl(rawUrl);
  if (schema !== 'test') {
    throw new Error(`${key} debe apuntar a un schema=test. Valor recibido: ${rawUrl}`);
  }
};

const forceIpv4Localhost = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString();
    }
  } catch {
    // fall through to naive replacement
  }

  return rawUrl.replace('@localhost', '@127.0.0.1');
};

const loadTestEnv = () => {
  dotenv.config({ path: baseEnvPath, quiet: true });

  const explicitTestEnvPath = process.env.TEST_ENV_FILE
    ? path.resolve(projectRoot, process.env.TEST_ENV_FILE)
    : testEnvPath;

  if (fs.existsSync(explicitTestEnvPath)) {
    dotenv.config({
      path: explicitTestEnvPath,
      override: true,
      quiet: true
    });
  }

  process.env.NODE_ENV = 'test';

  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    const hintPath = fs.existsSync(defaultTestEnvExamplePath)
      ? ` o copiar ${defaultTestEnvExamplePath} a ${testEnvPath}`
      : '';
    throw new Error(
      `Faltan DATABASE_URL y DIRECT_URL de test. Define ambas variables en el entorno${hintPath}.`
    );
  }

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = forceIpv4Localhost(process.env.DATABASE_URL);
    assertIsolatedTestDatabase('DATABASE_URL', process.env.DATABASE_URL);
  }

  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = forceIpv4Localhost(process.env.DIRECT_URL);
    assertIsolatedTestDatabase('DIRECT_URL', process.env.DIRECT_URL);
  }
};

module.exports = {
  assertIsolatedTestDatabase,
  loadTestEnv,
  forceIpv4Localhost,
  testEnvPath,
  defaultTestEnvExamplePath
};
