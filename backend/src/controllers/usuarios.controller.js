const { getPrisma } = require('../utils/get-prisma');
const { createHttpError } = require('../utils/http-error');
const usuariosService = require('../services/usuarios.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const usuarios = await usuariosService.listar(prisma, req.query);
  res.json(usuarios);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const usuario = await usuariosService.obtener(prisma, req.params.id);
  res.json(usuario);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const usuario = await usuariosService.crear(prisma, req.body);
  res.status(201).json(usuario);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);

  // No permitir auto-desactivacion
  if (req.body.activo === false && req.params.id === req.usuario?.id) {
    throw createHttpError.badRequest('No puedes desactivarte a ti mismo');
  }

  const usuario = await usuariosService.actualizar(prisma, req.params.id, req.body);
  res.json(usuario);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  await usuariosService.eliminar(prisma, req.params.id);
  res.status(204).end();
};

const resetMfa = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await usuariosService.resetMfa(prisma, req.params.id);
  res.json(resultado);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  resetMfa
};
