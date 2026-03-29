const { z } = require('zod');
const { positiveIntSchema } = require('./common.schemas');

const optionalTrimmedString = (max) => z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().max(max).optional()
);

const publicOrderItemSchema = z.object({
  productoId: positiveIntSchema,
  cantidad: positiveIntSchema,
  observaciones: optionalTrimmedString(500)
}).strip();

const pedidoIdParamSchema = z.object({
  id: positiveIntSchema
}).strip();

const qrTokenParamSchema = z.object({
  qrToken: z.string({ required_error: 'Token QR requerido' }).trim().min(1).max(255)
}).strip();

const publicOrderAccessQuerySchema = z.object({
  token: z.string({ required_error: 'Token requerido' }).trim().min(1, 'Token requerido')
}).strip();

const publicOrderPaymentBodySchema = z.object({
  token: z.string({ required_error: 'Token requerido' }).trim().min(1, 'Token requerido')
}).strip();

const createPublicOrderBodySchema = z.object({
  items: z.array(publicOrderItemSchema).min(1, 'El pedido debe tener al menos un producto'),
  clienteNombre: z.string({ required_error: 'Nombre requerido' }).trim().min(1).max(150),
  clienteTelefono: z.string({ required_error: 'Telefono requerido' }).trim().min(1).max(60),
  clienteDireccion: optionalTrimmedString(250),
  clienteEmail: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().email('Email invalido').max(150).optional()
  ),
  tipoEntrega: z.enum(['DELIVERY', 'RETIRO']),
  metodoPago: z.enum(['EFECTIVO', 'MERCADOPAGO']),
  montoAbonado: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().positive().optional()
  ),
  clientRequestId: optionalTrimmedString(120),
  observaciones: optionalTrimmedString(500)
}).strip();

const createPublicTableOrderBodySchema = z.object({
  sessionToken: z.string({ required_error: 'Sesion de mesa requerida' }).trim().min(1).max(255),
  items: z.array(publicOrderItemSchema).min(1, 'El pedido debe tener al menos un producto'),
  clienteNombre: z.string({ required_error: 'Nombre requerido' }).trim().min(1).max(150),
  observaciones: optionalTrimmedString(500)
}).strip();

module.exports = {
  pedidoIdParamSchema,
  qrTokenParamSchema,
  publicOrderAccessQuerySchema,
  publicOrderPaymentBodySchema,
  createPublicOrderBodySchema,
  createPublicTableOrderBodySchema
};
