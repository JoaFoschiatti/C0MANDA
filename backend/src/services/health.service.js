const { prisma, assertNegocioBootstrap } = require('../db/prisma');
const { assertWritableDirectory, getRuntimePaths } = require('../config/runtime');

const runCheck = async (runner) => {
  try {
    await runner();
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
};

const getReadinessStatus = async (options = {}) => {
  const runtimePaths = options.runtimePaths || getRuntimePaths();
  const checks = {
    database: await runCheck(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
    bootstrap: await runCheck(async () => {
      await assertNegocioBootstrap();
    }),
    filesystem: await runCheck(async () => {
      assertWritableDirectory(runtimePaths.logsDir);
      assertWritableDirectory(runtimePaths.uploadsDir);
    })
  };

  const ready = Object.values(checks).every((check) => check.status === 'ok');

  return {
    status: ready ? 'ready' : 'error',
    timestamp: new Date().toISOString(),
    checks
  };
};

module.exports = {
  getReadinessStatus
};
