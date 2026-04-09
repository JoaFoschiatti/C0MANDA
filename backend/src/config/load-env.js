const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

const projectRoot = path.resolve(__dirname, '..', '..');
const baseEnvPath = path.join(projectRoot, '.env');
const defaultTestEnvPath = path.join(projectRoot, '.env.test');

const resolveTestEnvPath = () => (
  process.env.TEST_ENV_FILE
    ? path.resolve(projectRoot, process.env.TEST_ENV_FILE)
    : defaultTestEnvPath
);

const loadRuntimeEnv = () => {
  if (loaded) return;

  dotenv.config({ path: baseEnvPath, quiet: true });

  if (process.env.NODE_ENV === 'test' || process.env.TEST_ENV_FILE) {
    const testEnvPath = resolveTestEnvPath();
    if (fs.existsSync(testEnvPath)) {
      dotenv.config({
        path: testEnvPath,
        override: true,
        quiet: true
      });
    }
  }

  loaded = true;
};

module.exports = {
  loadRuntimeEnv,
  projectRoot,
  baseEnvPath,
  defaultTestEnvPath,
  resolveTestEnvPath
};
