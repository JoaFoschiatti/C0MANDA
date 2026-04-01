const { prisma } = require('../db/prisma');
const negocioService = require('../services/negocio.service');

const obtenerNegocio = async (_req, res) => {
  const negocio = await negocioService.obtenerNegocio(prisma);
  res.json(negocio);
};

const actualizarNegocio = async (req, res) => {
  const result = await negocioService.actualizarNegocio(prisma, req.body);
  res.json(result);
};

const subirLogo = async (req, res) => {
  const result = await negocioService.subirLogo(prisma, req.file);
  res.json(result);
};

module.exports = {
  obtenerNegocio,
  actualizarNegocio,
  subirLogo
};
