const bcrypt = require('bcryptjs');
const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');
const { normalizeEmail } = require('../utils/email');

// Campos que nunca se exponen al cliente
const selectSinPassword = {
  id: true, email: true, nombre: true, apellido: true, dni: true,
  telefono: true, direccion: true, rol: true, tarifaHora: true,
  activo: true, createdAt: true, updatedAt: true
};

const baseCrud = createCrudService('usuario', {
  uniqueFields: { email: 'Email', dni: 'DNI' },
  defaultOrderBy: { nombre: 'asc' },
  softDelete: true,
  softDeleteField: 'activo',
  entityName: 'usuario',
  gender: 'm',

  allowedFilterFields: ['activo', 'rol'],
  allowedCreateFields: ['nombre', 'apellido', 'email', 'password', 'rol', 'dni', 'telefono', 'direccion', 'tarifaHora'],
  allowedUpdateFields: ['nombre', 'apellido', 'email', 'rol', 'activo', 'dni', 'telefono', 'direccion', 'tarifaHora'],

  // Hashear password antes de crear
  beforeCreate: async (_prisma, data) => {
    if (data.email !== undefined) {
      data.email = normalizeEmail(data.email);
    }
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return data;
  },
  beforeUpdate: async (_prisma, _id, data) => {
    if (data.email !== undefined) {
      data.email = normalizeEmail(data.email);
    }
    return data;
  }
});

// Override listar para excluir password
const listar = async (prisma, query) => {
  const result = await baseCrud.listar(prisma, query);
  return result.map(({ password: _, ...u }) => u);
};

// Override obtener para excluir password e incluir relaciones
const obtener = async (prisma, id) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      ...selectSinPassword,
      fichajes: { orderBy: { fecha: 'desc' }, take: 10 },
      liquidaciones: { orderBy: { createdAt: 'desc' }, take: 5 }
    }
  });

  if (!usuario) {
    throw createHttpError.notFound('Usuario no encontrado');
  }

  return usuario;
};

// Override crear para excluir password del response
const crear = async (prisma, data) => {
  const usuario = await baseCrud.crear(prisma, data);
  const { password: _, ...sinPassword } = usuario;
  return sinPassword;
};

// Override actualizar para excluir password del response
const actualizar = async (prisma, id, data) => {
  const usuario = await baseCrud.actualizar(prisma, id, data);
  const { password: _, ...sinPassword } = usuario;
  return sinPassword;
};

module.exports = {
  ...baseCrud,
  listar,
  obtener,
  crear,
  actualizar
};
