const { prisma: basePrisma } = require('../db/prisma');
const configuracionService = require('../services/configuracion.service');
const { createHttpError } = require('../utils/http-error');
const { getPrisma } = require('../utils/get-prisma');

const obtenerTodas = async (req, res) => {
  const prisma = getPrisma(req);
  const config = await configuracionService.obtenerTodas(prisma);
  res.json(config);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);

  if (!req.params.clave) {
    throw createHttpError.badRequest('Clave requerida');
  }

  const config = await configuracionService.actualizar(prisma, req.params.clave, req.body.valor);
  res.json(config);
};

const actualizarBulk = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await configuracionService.actualizarBulk(prisma, req.body);
  res.json(result);
};

const subirBanner = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await configuracionService.subirBanner(prisma, req.file);
  res.json(result);
};

const seedConfiguraciones = async () => {
  const defaults = [
    { clave: 'tienda_abierta', valor: 'true' },
    { clave: 'horario_apertura', valor: '11:00' },
    { clave: 'horario_cierre', valor: '23:00' },
    { clave: 'nombre_negocio', valor: 'Mi Restaurante' },
    { clave: 'tagline_negocio', valor: 'Los mejores sabores' },
    { clave: 'costo_delivery', valor: '1500' },
    { clave: 'delivery_habilitado', valor: 'true' },
    { clave: 'direccion_retiro', valor: 'Av. Principal 123' },
    { clave: 'mercadopago_enabled', valor: 'false' },
    { clave: 'mercadopago_transfer_alias', valor: '' },
    { clave: 'mercadopago_transfer_titular', valor: '' },
    { clave: 'mercadopago_transfer_cvu', valor: '' },
    { clave: 'efectivo_enabled', valor: 'true' },
    { clave: 'whatsapp_numero', valor: '' },
    { clave: 'facturacion_habilitada', valor: 'false' },
    { clave: 'facturacion_ambiente', valor: 'homologacion' },
    { clave: 'facturacion_punto_venta', valor: '1' },
    { clave: 'facturacion_cuit_emisor', valor: '' },
    { clave: 'facturacion_descripcion', valor: '' },
    { clave: 'facturacion_alicuota_iva', valor: '21' }
  ];

  for (const config of defaults) {
    await basePrisma.configuracion.upsert({
      where: { clave: config.clave },
      update: {},
      create: config
    });
  }
};

module.exports = {
  obtenerTodas,
  actualizar,
  actualizarBulk,
  subirBanner,
  seedConfiguraciones
};
