const { createHttpError } = require('../utils/http-error');

const NEGOCIO_SELECT = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  direccion: true,
  logo: true,
  bannerUrl: true,
  colorPrimario: true,
  colorSecundario: true,
  createdAt: true,
  updatedAt: true
};

const obtenerNegocio = async (prisma) => {
  const negocio = await prisma.negocio.findUnique({
    where: { id: 1 },
    select: NEGOCIO_SELECT
  });

  if (!negocio) {
    throw createHttpError.serviceUnavailable('La instalacion no fue bootstrappeada');
  }

  return negocio;
};

const actualizarNegocio = async (prisma, data) => {
  const negocio = await prisma.negocio.update({
    where: { id: 1 },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono?.trim() || null } : {}),
      ...(data.direccion !== undefined ? { direccion: data.direccion?.trim() || null } : {}),
      ...(data.logo !== undefined ? { logo: data.logo?.trim() || null } : {}),
      ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl?.trim() || null } : {}),
      ...(data.colorPrimario !== undefined ? { colorPrimario: data.colorPrimario } : {}),
      ...(data.colorSecundario !== undefined ? { colorSecundario: data.colorSecundario } : {})
    },
    select: NEGOCIO_SELECT
  });

  if (data.nombre !== undefined) {
    await prisma.configuracion.upsert({
      where: { clave: 'nombre_negocio' },
      update: { valor: negocio.nombre },
      create: { clave: 'nombre_negocio', valor: negocio.nombre }
    });
  }

  return {
    negocio,
    message: 'Datos actualizados correctamente'
  };
};

const subirLogo = async (prisma, file) => {
  if (!file) {
    throw createHttpError.badRequest('No se subio ninguna imagen');
  }

  const logoUrl = `/uploads/${file.filename}`;

  await prisma.negocio.update({
    where: { id: 1 },
    data: {
      logo: logoUrl
    },
    select: NEGOCIO_SELECT
  });

  return {
    url: logoUrl,
    message: 'Logo subido correctamente'
  };
};

module.exports = {
  obtenerNegocio,
  actualizarNegocio,
  subirLogo
};
