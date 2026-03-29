const { z } = require('zod');
const { booleanOptionalFromString, idParamSchema, positiveIntSchema } = require('./common.schemas');

const UNIDADES_VALIDAS = ['kg', 'g', 'l', 'ml', 'unidad'];

const listarQuerySchema = z.object({
  activo: booleanOptionalFromString,
  stockBajo: booleanOptionalFromString,
  sucursalId: positiveIntSchema.optional()
}).strip();

const sucursalQuerySchema = z.object({
  sucursalId: positiveIntSchema.optional()
}).strip();

const crearIngredienteBodySchema = z.object({
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  unidad: z.enum(UNIDADES_VALIDAS, { required_error: 'Unidad es requerida' }),
  stockActual: z.coerce.number().min(0),
  stockMinimo: z.coerce.number().min(0),
  costo: z.preprocess((val) => (val === '' ? null : val), z.coerce.number().min(0).nullable().optional()),
  activo: booleanOptionalFromString,
  sucursalId: positiveIntSchema.optional()
}).strip();

const actualizarIngredienteBodySchema = z.object({
  nombre: z.string().min(1).optional(),
  unidad: z.enum(UNIDADES_VALIDAS).optional(),
  stockMinimo: z.coerce.number().min(0).optional(),
  costo: z.preprocess((val) => (val === '' ? null : val), z.coerce.number().min(0).nullable().optional()),
  activo: booleanOptionalFromString,
  sucursalId: positiveIntSchema.optional()
}).strip();

const registrarMovimientoBodySchema = z.object({
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  cantidad: z.coerce.number().positive(),
  motivo: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional()),
  codigoLote: z.preprocess((val) => (val === '' ? null : val), z.union([z.string().max(120), z.null()]).optional()),
  fechaVencimiento: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.date().nullable().optional()
  ),
  costoUnitario: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.number().min(0).nullable().optional()
  ),
  sucursalId: positiveIntSchema.optional()
}).strip();

const ajustarStockBodySchema = z.object({
  stockReal: z.coerce.number().min(0),
  motivo: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional()),
  sucursalId: positiveIntSchema.optional()
}).strip();

const descartarLoteBodySchema = z.object({
  cantidad: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.number().positive().nullable().optional()
  ),
  motivo: z.string({ required_error: 'Motivo es requerido' }).min(1, 'Motivo es requerido')
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  sucursalQuerySchema,
  crearIngredienteBodySchema,
  actualizarIngredienteBodySchema,
  registrarMovimientoBodySchema,
  ajustarStockBodySchema,
  descartarLoteBodySchema
};
