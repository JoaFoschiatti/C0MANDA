jest.mock('../services/arca.service', () => {
  class MockArcaServiceError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'ArcaServiceError';
      this.code = options.code || 'ARCA_ERROR';
      this.status = options.status || 502;
      this.details = options.details || [];
      this.events = options.events || [];
      this.responseXml = options.responseXml || null;
      this.requestPayload = options.requestPayload || null;
    }
  }

  return {
    ArcaServiceError: MockArcaServiceError,
    hasArcaRuntimeConfig: jest.fn(),
    emitirComprobanteArca: jest.fn()
  };
});

const request = require('supertest');
const app = require('../app');
const arcaService = require('../services/arca.service');
const {
  prisma,
  uniqueId,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

describe('Facturacion Endpoints', () => {
  let token;

  beforeAll(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('fact-admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('PUT /api/facturacion/configuracion guarda punto de venta y alicuota', async () => {
    arcaService.hasArcaRuntimeConfig.mockReturnValue(false);

    const response = await request(app)
      .put('/api/facturacion/configuracion')
      .set('Authorization', authHeader(token))
      .send({
        puntoVenta: 3,
        descripcion: 'Caja fiscal',
        ambiente: 'homologacion',
        cuitEmisor: '30712345678',
        alicuotaIva: 10.5,
        habilitada: true
      })
      .expect(200);

    expect(response.body.puntoVentaFiscal.puntoVenta).toBe(3);

    const alicuota = await prisma.configuracion.findUnique({
      where: { clave: 'facturacion_alicuota_iva' }
    });

    expect(alicuota.valor).toBe('10.5');
  });

  it('POST /api/facturacion/comprobantes deja pendiente si faltan credenciales ARCA', async () => {
    arcaService.hasArcaRuntimeConfig.mockReturnValue(false);

    await prisma.puntoVentaFiscal.updateMany({
      where: {},
      data: { activo: false }
    });

    const puntoVenta = await prisma.puntoVentaFiscal.create({
      data: {
        puntoVenta: 5,
        descripcion: 'Caja principal',
        ambiente: 'homologacion',
        activo: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 121,
        total: 121,
        estado: 'COBRADO',
        estadoPago: 'APROBADO'
      }
    });

    const response = await request(app)
      .post('/api/facturacion/comprobantes')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: pedido.id,
        tipoComprobante: 'CONSUMIDOR_FINAL'
      })
      .expect(201);

    expect(response.body.emitido).toBe(false);
    expect(response.body.comprobante.estado).toBe('PENDIENTE_CONFIGURACION_ARCA');
    expect(response.body.comprobante.puntoVentaFiscalId).toBe(puntoVenta.id);
    expect(arcaService.emitirComprobanteArca).not.toHaveBeenCalled();
  });

  it('POST /api/facturacion/comprobantes emite CAE cuando ARCA responde aprobado', async () => {
    arcaService.hasArcaRuntimeConfig.mockReturnValue(true);
    arcaService.emitirComprobanteArca.mockResolvedValueOnce({
      cae: '12345678901234',
      caeExpirationDate: new Date('2026-03-31T00:00:00.000Z'),
      numeroComprobante: '00001-00000042',
      observations: [],
      events: [],
      requestPayload: {
        pointOfSale: 1,
        voucherType: 6
      },
      responseSummary: {
        resultado: 'A',
        cae: '12345678901234',
        caeExpirationRaw: '20260331',
        events: [],
        observations: []
      },
      responseXml: '<soap />'
    });

    await prisma.puntoVentaFiscal.create({
      data: {
        puntoVenta: 1,
        descripcion: 'Caja principal',
        ambiente: 'homologacion',
        activo: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 242,
        total: 242,
        estado: 'COBRADO',
        estadoPago: 'APROBADO'
      }
    });

    const response = await request(app)
      .post('/api/facturacion/comprobantes')
      .set('Authorization', authHeader(token))
      .send({
        pedidoId: pedido.id,
        tipoComprobante: 'FACTURA_B',
        clienteFiscal: {
          nombre: 'Cliente B',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          condicionIva: 'Consumidor Final'
        }
      })
      .expect(201);

    expect(response.body.emitido).toBe(true);
    expect(response.body.comprobante.estado).toBe('AUTORIZADO');
    expect(response.body.comprobante.cae).toBe('12345678901234');
    expect(response.body.comprobante.numeroComprobante).toBe('00001-00000042');
    expect(arcaService.emitirComprobanteArca).toHaveBeenCalledWith(expect.objectContaining({
      pointOfSale: 1,
      tipoComprobante: 'FACTURA_B'
    }));
  });
});
