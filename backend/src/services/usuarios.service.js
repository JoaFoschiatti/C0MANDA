const bcrypt = require('bcryptjs');
const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');
const { normalizeEmail } = require('../utils/email');
const { resetUserMfa } = require('./mfa.service');

// Campos que nunca se exponen al cliente
const selectSinPassword = {
  id: true, email: true, nombre: true, apellido: true, dni: true,
  telefono: true, direccion: true, rol: true, tarifaHora: true,
  activo: true, createdAt: true, updatedAt: true,
  mfaCredential: {
    select: {
      enabledAt: true
    }
  }
};

const normalizeUsuarioResponse = (usuario) => {
  const { password: _, mfaCredential, ...rest } = usuario;
  return {
    ...rest,
    mfaEnabled: Boolean(mfaCredential?.enabledAt)
  };
};

const baseCrud = createCrudService('usuario', {
  uniqueFields: { email: 'Email', dni: 'DNI' },
  defaultOrderBy: { nombre: 'asc' },
  defaultInclude: {
    mfaCredential: {
      select: {
        enabledAt: true
      }
    }
  },
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
  return result.map(normalizeUsuarioResponse);
};

// Override obtener para excluir password e incluir relaciones
const obtener = async (prisma, id) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      ...selectSinPassword,
      fichajes: { orderBy: { fecha: 'desc' }, take: 10 }
    }
  });

  if (!usuario) {
    throw createHttpError.notFound('Usuario no encontrado');
  }

  return normalizeUsuarioResponse(usuario);
};

// Override crear para excluir password del response
const crear = async (prisma, data) => {
  const usuario = await baseCrud.crear(prisma, data);
  return normalizeUsuarioResponse(usuario);
};

// Override actualizar para excluir password del response
const actualizar = async (prisma, id, data) => {
  const usuario = await baseCrud.actualizar(prisma, id, data);
  return normalizeUsuarioResponse(usuario);
};

const resetMfa = async (prisma, id) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true
    }
  });

  if (!usuario) {
    throw createHttpError.notFound('Usuario no encontrado');
  }

  await resetUserMfa(prisma, id);

  return {
    message: 'MFA reiniciado correctamente',
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email
    }
  };
};

module.exports = {
  ...baseCrud,
  listar,
  obtener,
  crear,
  actualizar,
  resetMfa
};
