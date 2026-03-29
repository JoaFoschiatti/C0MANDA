const path = require('path');
const { spawnSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');
const prismaCli = require.resolve('prisma/build/index.js', { paths: [backendRoot] });
const visualSeedScript = path.join(backendRoot, 'prisma', 'seed.visual.js');

const runNode = (args) => spawnSync(process.execPath, args, {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env
});

const resetResult = runNode([
  prismaCli,
  'migrate',
  'reset',
  '--force',
  '--skip-generate',
  '--skip-seed'
]);

if (resetResult.status !== 0) {
  process.exit(resetResult.status || 1);
}

const seedResult = runNode([visualSeedScript]);
process.exit(seedResult.status || 0);
