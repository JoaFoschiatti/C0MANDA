const { procesarReservas } = require('../jobs/reservas.job');
const eventBus = require('../services/event-bus');
const {
  prisma,
  cleanupOperationalData,
  ensureNegocio,
  uniqueId
} = require('./helpers/test-helpers');

describe('reservas.job', () => {
  let mesa;
  let mesaVencida;

  beforeAll(async () => {
    await cleanupOperationalData();
    await ensureNegocio();

    mesa = await prisma.mesa.create({
      data: {
        numero: 1,
        capacidad: 4,
        estado: 'LIBRE'
      }
    });

    mesaVencida = await prisma.mesa.create({
      data: {
        numero: 2,
        capacidad: 4,
        estado: 'RESERVADA'
      }
    });
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('marca mesas reservadas y reservas vencidas', async () => {
    const ahora = Date.now();

    const reservaProxima = await prisma.reserva.create({
      data: {
        mesaId: mesa.id,
        clienteNombre: `Cliente ${uniqueId('cliente')}`,
        clienteTelefono: '123',
        cantidadPersonas: 2,
        estado: 'CONFIRMADA',
        fechaHora: new Date(ahora + 10 * 60 * 1000)
      }
    });

    const reservaVencida = await prisma.reserva.create({
      data: {
        mesaId: mesaVencida.id,
        clienteNombre: `Cliente ${uniqueId('cliente')}`,
        clienteTelefono: '321',
        cantidadPersonas: 2,
        estado: 'CONFIRMADA',
        fechaHora: new Date(ahora - 40 * 60 * 1000)
      }
    });

    const publishSpy = jest.spyOn(eventBus, 'publish');

    await procesarReservas();

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    const mesaLiberada = await prisma.mesa.findUnique({ where: { id: mesaVencida.id } });
    const reservaActualizada = await prisma.reserva.findUnique({ where: { id: reservaVencida.id } });

    expect(mesaActualizada.estado).toBe('RESERVADA');
    expect(mesaLiberada.estado).toBe('LIBRE');
    expect(reservaActualizada.estado).toBe('NO_LLEGO');

    expect(
      publishSpy.mock.calls.some(([type, payload]) =>
        type === 'mesa.updated' && payload.mesaId === mesa.id
      )
    ).toBe(true);

    expect(
      publishSpy.mock.calls.some(([type, payload]) =>
        type === 'reserva.updated' && payload.id === reservaVencida.id
      )
    ).toBe(true);

    publishSpy.mockRestore();
  });

  it('procesa reservas dentro de un transaction client real', async () => {
    const ahora = Date.now();

    const mesaTx = await prisma.mesa.create({
      data: {
        numero: 101,
        capacidad: 4,
        estado: 'LIBRE'
      }
    });

    const mesaVencidaTx = await prisma.mesa.create({
      data: {
        numero: 102,
        capacidad: 4,
        estado: 'RESERVADA'
      }
    });

    const reservaProxima = await prisma.reserva.create({
      data: {
        mesaId: mesaTx.id,
        clienteNombre: `Cliente ${uniqueId('cliente-tx')}`,
        clienteTelefono: '555',
        cantidadPersonas: 2,
        estado: 'CONFIRMADA',
        fechaHora: new Date(ahora + 10 * 60 * 1000)
      }
    });

    const reservaVencida = await prisma.reserva.create({
      data: {
        mesaId: mesaVencidaTx.id,
        clienteNombre: `Cliente ${uniqueId('cliente-tx')}`,
        clienteTelefono: '777',
        cantidadPersonas: 2,
        estado: 'CONFIRMADA',
        fechaHora: new Date(ahora - 40 * 60 * 1000)
      }
    });

    await prisma.$transaction(async (tx) => {
      await procesarReservas(tx);
    });

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesaTx.id } });
    const mesaLiberada = await prisma.mesa.findUnique({ where: { id: mesaVencidaTx.id } });
    const reservaActualizada = await prisma.reserva.findUnique({ where: { id: reservaVencida.id } });
    const reservaProximaActualizada = await prisma.reserva.findUnique({ where: { id: reservaProxima.id } });

    expect(mesaActualizada.estado).toBe('RESERVADA');
    expect(mesaLiberada.estado).toBe('LIBRE');
    expect(reservaActualizada.estado).toBe('NO_LLEGO');
    expect(reservaProximaActualizada.estado).toBe('CONFIRMADA');
  });
});
