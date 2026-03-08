const { z } = require('zod');

const pedidoIdParamSchema = z.object({
  pedidoId: z.coerce.number().int().positive()
});

const registrarPagoBodySchema = z.object({
  pedidoId: z.coerce.number().int().positive(),
  monto: z.coerce.number().positive(),
  metodo: z.enum(['EFECTIVO', 'MERCADOPAGO', 'TARJETA']),
  canalCobro: z.enum(['CAJA', 'CHECKOUT_WEB', 'QR_PRESENCIAL']).optional(),
  propinaMonto: z.coerce.number().min(0).optional(),
  propinaMetodo: z.enum(['EFECTIVO', 'MERCADOPAGO', 'TARJETA']).nullable().optional(),
  referencia: z.string().max(200).nullable().optional(),
  comprobante: z.string().max(500).nullable().optional(),
  montoAbonado: z.coerce.number().positive().nullable().optional()
}).strip();

const crearPreferenciaBodySchema = z.object({
  pedidoId: z.coerce.number().int().positive()
}).strip();

const crearQrOrdenBodySchema = z.object({
  pedidoId: z.coerce.number().int().positive(),
  propinaMonto: z.coerce.number().min(0).optional(),
  propinaMetodo: z.enum(['EFECTIVO', 'MERCADOPAGO', 'TARJETA']).nullable().optional()
}).strip();

module.exports = {
  pedidoIdParamSchema,
  registrarPagoBodySchema,
  crearPreferenciaBodySchema,
  crearQrOrdenBodySchema
};

