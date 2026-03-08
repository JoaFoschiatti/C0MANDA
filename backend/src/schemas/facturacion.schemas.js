const { z } = require('zod');

const clienteFiscalSchema = z.object({
  nombre: z.string().min(2).max(150),
  tipoDocumento: z.string().max(40).optional(),
  numeroDocumento: z.string().max(40).optional(),
  cuit: z.string().max(20).optional(),
  condicionIva: z.string().max(80).optional(),
  email: z.string().email().max(150).optional(),
  domicilioFiscal: z.string().max(250).optional()
}).strip();

const comprobanteBodySchema = z.object({
  pedidoId: z.coerce.number().int().positive(),
  tipoComprobante: z.string().min(1).max(40),
  observaciones: z.string().max(500).optional(),
  clienteFiscal: clienteFiscalSchema.optional()
}).strip();

const comprobanteIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
}).strip();

const configuracionFacturacionBodySchema = z.object({
  puntoVenta: z.coerce.number().int().positive(),
  descripcion: z.string().max(120).optional(),
  ambiente: z.enum(['homologacion', 'produccion']).optional(),
  cuitEmisor: z.string().max(20).optional(),
  alicuotaIva: z.coerce.number().positive().optional(),
  activo: z.boolean().optional(),
  habilitada: z.boolean().optional()
}).strip();

module.exports = {
  comprobanteBodySchema,
  comprobanteIdParamSchema,
  configuracionFacturacionBodySchema
};
