const loadModule = () => {
  jest.resetModules();
  const basePrisma = { marker: 'base' };
  jest.doMock('../db/prisma', () => ({ prisma: basePrisma }));
  const { getPrisma } = require('../utils/get-prisma');
  return { getPrisma, basePrisma };
};

describe('getPrisma', () => {
  it('retorna siempre el prisma base de la instalacion unica', () => {
    const { getPrisma, basePrisma } = loadModule();

    expect(getPrisma({ prisma: { marker: 'req' } })).toBe(basePrisma);
    expect(getPrisma({})).toBe(basePrisma);
  });
});
