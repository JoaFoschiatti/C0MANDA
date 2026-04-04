const { z } = require('zod');

const booleanFromString = (defaultValue) => z.preprocess((val) => {
  if (val === undefined) return defaultValue;
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return val;
}, z.boolean());

const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), 'Fecha invalida');

const dateRangeRequiredFields = {
  fechaDesde: dateOnlySchema,
  fechaHasta: dateOnlySchema
};

const dateRangeOptionalFields = {
  fechaDesde: dateOnlySchema.optional(),
  fechaHasta: dateOnlySchema.optional()
};

const requireBothOrNone = (data) =>
  (data.fechaDesde && data.fechaHasta) || (!data.fechaDesde && !data.fechaHasta);

const ventasReporteQuerySchema = z.object({
  ...dateRangeRequiredFields,
  agrupacion: z.string().optional(),
  fechaDesdeComp: dateOnlySchema.optional(),
  fechaHastaComp: dateOnlySchema.optional()
}).strip().refine(
  (data) => (data.fechaDesdeComp && data.fechaHastaComp) || (!data.fechaDesdeComp && !data.fechaHastaComp),
  { message: 'Ambas fechas de comparacion son requeridas', path: ['fechaDesdeComp'] }
);

const productosMasVendidosQuerySchema = z.object({
  ...dateRangeOptionalFields,
  limite: z.coerce.number().int().positive().optional(),
  agruparPorBase: booleanFromString(false)
}).strip().refine(requireBothOrNone, {
  message: 'Fechas requeridas',
  path: ['fechaDesde']
});

const ventasPorMozoQuerySchema = z.object({
  ...dateRangeOptionalFields
}).strip().refine(requireBothOrNone, {
  message: 'Fechas requeridas',
  path: ['fechaDesde']
});

const ventasPorProductoBaseQuerySchema = z.object({
  ...dateRangeOptionalFields,
  limite: z.coerce.number().int().positive().optional()
}).strip().refine(requireBothOrNone, {
  message: 'Fechas requeridas',
  path: ['fechaDesde']
});

const consumoInsumosQuerySchema = z.object({
  ...dateRangeOptionalFields
}).strip().refine(requireBothOrNone, {
  message: 'Fechas requeridas',
  path: ['fechaDesde']
});

module.exports = {
  ventasReporteQuerySchema,
  productosMasVendidosQuerySchema,
  ventasPorMozoQuerySchema,
  ventasPorProductoBaseQuerySchema,
  consumoInsumosQuerySchema
};
