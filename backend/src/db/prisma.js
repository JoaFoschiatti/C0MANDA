const { PrismaClient } = require('@prisma/client');
const { createHttpError } = require('../utils/http-error');

const prisma = new PrismaClient();
const NEGOCIO_SINGLETON_ID = 1;

const getNegocio = async () => prisma.negocio.findUnique({
  where: { id: NEGOCIO_SINGLETON_ID }
});

const assertNegocioBootstrap = async () => {
  const negocio = await getNegocio();

  if (!negocio) {
    throw createHttpError.serviceUnavailable(
      'La instalacion no fue bootstrappeada. Ejecuta la seed inicial antes de iniciar el sistema.'
    );
  }

  const admin = await prisma.usuario.findFirst({
    where: {
      rol: 'ADMIN',
      activo: true
    },
    select: { id: true }
  });

  if (!admin) {
    throw createHttpError.serviceUnavailable(
      'La instalacion no tiene un usuario administrador activo.'
    );
  }

  return negocio;
};

module.exports = {
  prisma,
  NEGOCIO_SINGLETON_ID,
  getNegocio,
  assertNegocioBootstrap
};
