const app = require('./app');
const { prisma, assertNegocioBootstrap } = require('./db/prisma');
const { logger } = require('./utils/logger');
const { iniciarJobReservas, detenerJobReservas } = require('./jobs/reservas.job');
const { iniciarJobLotesVencidos, detenerJobLotesVencidos } = require('./jobs/lotes-vencidos.job');
const { ensureRuntimeDirectories, validateProductionEnvironment } = require('./config/runtime');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
const SHUTDOWN_TIMEOUT_MS = 10000;

let server;
let shuttingDown = false;

const start = async () => {
  validateProductionEnvironment();
  const runtimePaths = ensureRuntimeDirectories();
  await assertNegocioBootstrap();

  server = app.listen(PORT, HOST, () => {
    logger.info(`API corriendo en http://${HOST}:${PORT}`, {
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV || 'development',
      uploadsDir: runtimePaths.uploadsDir,
      logsDir: runtimePaths.logsDir
    });

    iniciarJobReservas();
    iniciarJobLotesVencidos();
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Recibido ${signal}. Cerrando servidor...`, { signal });

  try {
    detenerJobReservas();
  } catch (error) {
    logger.error('Error deteniendo job de reservas', error);
  }

  try {
    detenerJobLotesVencidos();
  } catch (error) {
    logger.error('Error deteniendo job de lotes vencidos', error);
  }

  await new Promise((resolve) => {
    if (!server) return resolve();

    const forceTimer = setTimeout(() => {
      logger.warn('Shutdown timeout: forzando cierre');
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);

    server.close(() => {
      clearTimeout(forceTimer);
      resolve();
    });
  });

  try {
    await prisma.$disconnect();
    logger.info('Prisma desconectado correctamente');
  } catch (error) {
    logger.error('Error desconectando Prisma', error);
  }

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  logger.error('No se pudo iniciar el servidor', {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});
