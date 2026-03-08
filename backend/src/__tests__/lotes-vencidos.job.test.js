const { procesarLotesVencidos } = require('../jobs/lotes-vencidos.job');
const eventBus = require('../services/event-bus');
const {
  prisma,
  cleanupOperationalData,
  ensureNegocio,
  uniqueId
} = require('./helpers/test-helpers');

describe('lotes-vencidos.job', () => {
  beforeAll(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('notifica una vez por dia los lotes vencidos pendientes de descarte', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('job')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 1,
        activo: true
      }
    });

    const lote = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('job')}`,
        stockInicial: 3,
        stockActual: 3,
        fechaIngreso: new Date('2026-01-01T10:00:00.000Z'),
        fechaVencimiento: new Date('2026-02-01T23:59:59.999Z')
      }
    });

    const publishSpy = jest.spyOn(eventBus, 'publish');

    const firstRun = await procesarLotesVencidos(new Date('2026-03-06T10:00:00.000Z'));
    expect(firstRun).toHaveLength(1);
    expect(firstRun[0].totalLotes).toBe(1);
    expect(firstRun[0].items[0].loteId).toBe(lote.id);

    const loteNotificado = await prisma.loteStock.findUnique({ where: { id: lote.id } });
    expect(loteNotificado.ultimaNotificacionVencimiento).toBeTruthy();

    const secondRun = await procesarLotesVencidos(new Date('2026-03-06T18:00:00.000Z'));
    expect(secondRun).toHaveLength(0);

    expect(
      publishSpy.mock.calls.filter(([type]) => type === 'stock.lotes_vencidos')
    ).toHaveLength(1);

    publishSpy.mockRestore();
  });
});
