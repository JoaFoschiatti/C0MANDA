const { createHttpError } = require('../utils/http-error');

const obtenerTodas = async (prisma) => {
  const configs = await prisma.configuracion.findMany({
    orderBy: { clave: 'asc' }
  });

  return configs.reduce((acc, config) => {
    acc[config.clave] = config.valor;
    return acc;
  }, {});
};

const actualizar = async (prisma, clave, valor) => {
  if (!clave) {
    throw createHttpError.badRequest('Clave requerida');
  }

  return prisma.configuracion.upsert({
    where: { clave },
    update: { valor: String(valor) },
    create: { clave, valor: String(valor) }
  });
};

const actualizarBulk = async (prisma, configs) => {
  const entries = Object.entries(configs || {});

  if (entries.length === 0) {
    return { message: 'Configuraciones actualizadas', count: 0 };
  }

  const updates = await Promise.all(
    entries.map(([clave, valor]) =>
      prisma.configuracion.upsert({
        where: { clave },
        update: { valor: String(valor) },
        create: { clave, valor: String(valor) }
      })
    )
  );

  return { message: 'Configuraciones actualizadas', count: updates.length };
};

const subirBanner = async (prisma, file) => {
  if (!file) {
    throw createHttpError.badRequest('No se subio ninguna imagen');
  }

  const bannerUrl = `/uploads/${file.filename}`;

  await prisma.configuracion.upsert({
    where: { clave: 'banner_imagen' },
    update: { valor: bannerUrl },
    create: { clave: 'banner_imagen', valor: bannerUrl }
  });

  return { url: bannerUrl, message: 'Banner subido correctamente' };
};

module.exports = {
  obtenerTodas,
  actualizar,
  actualizarBulk,
  subirBanner
};
