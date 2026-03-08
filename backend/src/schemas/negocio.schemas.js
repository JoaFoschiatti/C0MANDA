const { z } = require('zod');

const emailSchema = z.string().trim().email('Email invalido');

const actualizarNegocioBodySchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: emailSchema.optional(),
  telefono: z.preprocess((value) => (value === '' ? null : value), z.union([z.string(), z.null()]).optional()),
  direccion: z.preprocess((value) => (value === '' ? null : value), z.union([z.string(), z.null()]).optional()),
  logo: z.preprocess((value) => (value === '' ? null : value), z.union([z.string(), z.null()]).optional()),
  bannerUrl: z.preprocess((value) => (value === '' ? null : value), z.union([z.string(), z.null()]).optional()),
  colorPrimario: z.string().optional(),
  colorSecundario: z.string().optional()
}).strip();

module.exports = {
  actualizarNegocioBodySchema
};
