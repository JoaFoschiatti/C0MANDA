const { z } = require('zod');

const intIdSchema = z.coerce.number().int().positive();

const pedidoIdParamSchema = z.object({
  pedidoId: intIdSchema
}).strip();

const jobIdParamSchema = z.object({
  id: intIdSchema
}).strip();

const anchoMmSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  return val;
}, z.coerce.number().int().optional()).refine((val) => {
  if (val === undefined) return true;
  return val === 58 || val === 80;
}, { message: 'anchoMm inválido' });

const tipoComandaSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  return String(val).toUpperCase();
}, z.enum(['COCINA', 'CAJA', 'CLIENTE']).optional());

const rondaIdSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  return val;
}, z.coerce.number().int().positive().optional());

const imprimirComandaBodySchema = z.object({
  anchoMm: anchoMmSchema,
  tipo: tipoComandaSchema,
  rondaId: rondaIdSchema
}).strip();

const previewComandaQuerySchema = z.object({
  tipo: tipoComandaSchema.default('CLIENTE'),
  anchoMm: anchoMmSchema,
  rondaId: rondaIdSchema
}).strip();

const bridgeClaimBodySchema = z.object({
  bridgeId: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().min(1).optional()),
  limit: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.number().int().min(1).max(10).optional()),
  printerName: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().min(1).optional()),
  adapter: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().min(1).optional())
}).strip();

const bridgeAckBodySchema = z.object({
  bridgeId: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().min(1).optional())
}).strip();

const bridgeFailBodySchema = bridgeAckBodySchema.extend({
  error: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().min(1).optional())
}).strip();

module.exports = {
  pedidoIdParamSchema,
  jobIdParamSchema,
  imprimirComandaBodySchema,
  previewComandaQuerySchema,
  bridgeClaimBodySchema,
  bridgeAckBodySchema,
  bridgeFailBodySchema
};

