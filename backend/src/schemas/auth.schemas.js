const { z } = require('zod');
const { booleanOptionalFromString } = require('./common.schemas');

const loginBodySchema = z.object({
  email: z.string({ required_error: 'Email es requerido' }).trim().toLowerCase().min(1, 'Email es requerido').email('Email invalido'),
  password: z.string({ required_error: 'Password es requerido' }).min(1, 'Password es requerido')
}).strict();

const registrarBodySchema = z.object({
  email: z.string({ required_error: 'Email es requerido' }).trim().toLowerCase().min(1, 'Email es requerido').email('Email invalido'),
  password: z.string({ required_error: 'Password es requerido' }).min(8, 'Password debe tener al menos 8 caracteres'),
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  rol: z.enum(['ADMIN', 'MOZO', 'COCINERO', 'CAJERO', 'DELIVERY']).optional()
}).strip();

const cambiarPasswordBodySchema = z.object({
  passwordActual: z.string({ required_error: 'Password actual es requerido' }).min(1, 'Password actual es requerido'),
  passwordNuevo: z.string({ required_error: 'Password nuevo es requerido' }).min(6, 'Password nuevo debe tener al menos 6 caracteres')
}).strip();

const trustDeviceSchema = booleanOptionalFromString.default(false);

const mfaCodeBodySchema = z.object({
  code: z.string({ required_error: 'Codigo requerido' }).trim().min(6, 'Codigo invalido').max(12, 'Codigo invalido'),
  trustDevice: trustDeviceSchema
}).strip();

const mfaRecoveryBodySchema = z.object({
  recoveryCode: z.string({ required_error: 'Codigo de recuperacion requerido' }).trim().min(4, 'Codigo invalido').max(20, 'Codigo invalido'),
  trustDevice: trustDeviceSchema
}).strip();

module.exports = {
  loginBodySchema,
  registrarBodySchema,
  cambiarPasswordBodySchema,
  mfaCodeBodySchema,
  mfaRecoveryBodySchema
};
