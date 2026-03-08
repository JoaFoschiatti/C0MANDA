const { getPrisma } = require('../utils/get-prisma');
const facturacionService = require('../services/facturacion.service');

const crearComprobante = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await facturacionService.crearComprobante(prisma, req.body);
  res.status(201).json(result);
};

const obtenerComprobante = async (req, res) => {
  const prisma = getPrisma(req);
  const comprobante = await facturacionService.obtenerComprobante(prisma, Number(req.params.id));
  res.json(comprobante);
};

const guardarConfiguracion = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await facturacionService.guardarConfiguracion(prisma, req.body);
  res.json(result);
};

module.exports = {
  crearComprobante,
  obtenerComprobante,
  guardarConfiguracion
};
