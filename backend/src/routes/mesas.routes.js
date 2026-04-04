const express = require('express');
const router = express.Router();
const mesasController = require('../controllers/mesas.controller');
const { verificarToken, esAdmin, esMozo, verificarRol } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearMesaBodySchema,
  actualizarMesaBodySchema,
  cambiarEstadoBodySchema
} = require('../schemas/mesas.schemas');
const { z } = require('zod');
const { getPrisma } = require('../utils/get-prisma');
const eventBus = require('../services/event-bus');

router.use(verificarToken);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(mesasController.listar));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(mesasController.obtener));
router.post('/', esAdmin, validate({ body: crearMesaBodySchema }), asyncHandler(mesasController.crear));
router.put('/:id', esAdmin, validate({ params: idParamSchema, body: actualizarMesaBodySchema }), asyncHandler(mesasController.actualizar));
router.patch('/:id/estado', esMozo, validate({ params: idParamSchema, body: cambiarEstadoBodySchema }), asyncHandler(mesasController.cambiarEstado));
router.post('/:id/precuenta', verificarRol('ADMIN', 'MOZO', 'CAJERO'), validate({ params: idParamSchema }), asyncHandler(mesasController.precuenta));
router.post('/:id/liberar', verificarRol('ADMIN', 'CAJERO'), validate({ params: idParamSchema }), asyncHandler(mesasController.liberar));
router.delete('/:id', esAdmin, validate({ params: idParamSchema }), asyncHandler(mesasController.eliminar));

// PATCH /mesas/posiciones - actualizar posiciones en el plano
const posicionesBodySchema = z.object({
  posiciones: z.array(z.object({
    id: z.number().int().positive(),
    posX: z.number().int().min(0).max(2000),
    posY: z.number().int().min(0).max(2000),
    rotacion: z.number().int().min(0).max(360).optional(),
    zona: z.string().optional()
  })).min(1).max(100)
}).strip();

router.patch('/posiciones', esAdmin, validate({ body: posicionesBodySchema }), asyncHandler(async (req, res) => {
  const prisma = getPrisma(req);
  const { posiciones } = req.body;

  await prisma.$transaction(
    posiciones.map(({ id, posX, posY, rotacion, zona }) =>
      prisma.mesa.update({
        where: { id },
        data: {
          posX,
          posY,
          ...(rotacion !== undefined && { rotacion }),
          ...(zona !== undefined && { zona })
        }
      })
    )
  );

  eventBus.publish('mesa.updated', { updatedAt: new Date().toISOString() });
  res.json({ message: 'Posiciones actualizadas' });
}));

// POST /mesas/grupos - agrupar mesas
router.post('/grupos', esAdmin, asyncHandler(async (req, res) => {
  const prisma = getPrisma(req);
  const { mesaIds } = req.body;

  if (!Array.isArray(mesaIds) || mesaIds.length < 2) {
    return res.status(400).json({ error: { message: 'Se necesitan al menos 2 mesas para agrupar' } });
  }

  const grupoId = await prisma.$transaction(async (tx) => {
    const { _max } = await tx.mesa.aggregate({
      _max: { grupoMesaId: true }
    });

    const nextGroupId = (_max.grupoMesaId || 0) + 1;

    await Promise.all(
      mesaIds.map((id) =>
        tx.mesa.update({
          where: { id },
          data: { grupoMesaId: nextGroupId }
        })
      )
    );

    return nextGroupId;
  });

  eventBus.publish('mesa.updated', { updatedAt: new Date().toISOString() });
  res.json({ message: 'Mesas agrupadas', grupoMesaId: grupoId });
}));

// DELETE /mesas/grupos/:id - desagrupar mesas
router.delete('/grupos/:id', esAdmin, asyncHandler(async (req, res) => {
  const prisma = getPrisma(req);
  const grupoId = parseInt(req.params.id);

  await prisma.mesa.updateMany({
    where: { grupoMesaId: grupoId },
    data: { grupoMesaId: null }
  });

  eventBus.publish('mesa.updated', { updatedAt: new Date().toISOString() });
  res.json({ message: 'Grupo eliminado' });
}));

module.exports = router;

