const { z } = require('zod');
const { booleanOptionalFromString, idParamSchema } = require('./common.schemas');

const rolSchema = z.enum(['ADMIN', 'MOZO', 'COCINERO', 'CAJERO', 'DELIVERY']);

const listarQuerySchema = z.object({
  activo: booleanOptionalFromString,
  rol: rolSchema.optional()
}).strip();

const crearUsuarioBodySchema = z.object({
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  apellido: z.string().optional(),
  email: z.string({ required_error: 'Email es requerido' }).email('Email invalido'),
  password: z.string({ required_error: 'Password es requerido' }).min(6, 'Password debe tener al menos 6 caracteres'),
  rol: rolSchema,
  dni: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  tarifaHora: z.coerce.number().min(0).optional()
}).strip();

const actualizarUsuarioBodySchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().optional(),
  email: z.string().email('Email invalido').optional(),
  rol: rolSchema.optional(),
  activo: booleanOptionalFromString,
  dni: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  tarifaHora: z.coerce.number().min(0).optional()
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearUsuarioBodySchema,
  actualizarUsuarioBodySchema
};
