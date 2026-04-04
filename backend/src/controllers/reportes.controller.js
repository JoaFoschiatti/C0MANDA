const { getPrisma } = require('../utils/get-prisma');
const reportesService = require('../services/reportes.service');

const dashboard = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.dashboard(prisma);
  res.json(resultado);
};

const tareasCentro = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.tareasCentro(prisma);
  res.json(resultado);
};

const ventasReporte = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasReporte(prisma, req.query);
  res.json(resultado);
};

const productosMasVendidos = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.productosMasVendidos(prisma, req.query);
  res.json(resultado);
};

const ventasPorMozo = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasPorMozo(prisma, req.query);
  res.json(resultado);
};

const inventarioReporte = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.inventarioReporte(prisma);
  res.json(resultado);
};

const ventasPorProductoBase = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasPorProductoBase(prisma, req.query);
  res.json(resultado);
};

const consumoInsumos = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.consumoInsumos(prisma, req.query);
  res.json(resultado);
};

const ventasPorHora = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasPorHora(prisma, req.query);
  res.json(resultado);
};

module.exports = {
  dashboard,
  tareasCentro,
  ventasReporte,
  productosMasVendidos,
  ventasPorMozo,
  inventarioReporte,
  ventasPorProductoBase,
  consumoInsumos,
  ventasPorHora
};
