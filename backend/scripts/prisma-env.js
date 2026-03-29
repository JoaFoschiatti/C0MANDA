const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const [, , envFileArg, ...prismaArgs] = process.argv;

if (!envFileArg || prismaArgs.length === 0) {
  console.error('Uso: node scripts/prisma-env.js <env-file> <prisma-args...>');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const baseEnvPath = path.join(projectRoot, '.env');
const envFilePath = path.resolve(projectRoot, envFileArg);

const getSchemaFromUrl = (rawUrl) => {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    return parsed.searchParams.get('schema');
  } catch {
    const match = String(rawUrl).match(/[?&]schema=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
};

dotenv.config({ path: baseEnvPath, quiet: true });

if (!fs.existsSync(envFilePath)) {
  console.error(`No existe el archivo de entorno: ${envFilePath}`);
  process.exit(1);
}

dotenv.config({
  path: envFilePath,
  override: true,
  quiet: true
});

if (path.basename(envFilePath) === '.env.test') {
  ['DATABASE_URL', 'DIRECT_URL'].forEach((key) => {
    const schema = getSchemaFromUrl(process.env[key]);
    if (schema !== 'test') {
      console.error(`${key} debe apuntar a schema=test para usar ${envFilePath}`);
      process.exit(1);
    }
  });
}

const prismaEntrypoint = path.join(
  projectRoot,
  'node_modules',
  'prisma',
  'build',
  'index.js'
);

const result = spawnSync(process.execPath, [prismaEntrypoint, ...prismaArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
