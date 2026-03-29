const { logger } = require('../utils/logger');

const tryAcquireAdvisoryLock = async (tx, key) => {
  if (typeof tx.$queryRaw !== 'function') {
    return true;
  }

  const result = await tx.$queryRaw`
    SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked
  `;

  return Boolean(result?.[0]?.locked);
};

const withAdvisoryLock = async (prismaClient, key, callback) => prismaClient.$transaction(async (tx) => {
  const locked = await tryAcquireAdvisoryLock(tx, key);
  if (!locked) {
    logger.info('Advisory lock no adquirido; se omite ejecucion duplicada', { key });
    return null;
  }

  return callback(tx);
});

module.exports = {
  tryAcquireAdvisoryLock,
  withAdvisoryLock
};
