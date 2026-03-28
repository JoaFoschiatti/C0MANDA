const express = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const eventBus = require('../services/event-bus');
const { logger } = require('../utils/logger');

const router = express.Router();

router.get('/', verificarToken, (req, res) => {
  logger.info(`[SSE] Cliente conectado - Usuario: ${req.usuario?.email}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event) => {
    logger.info(`[SSE] Enviando evento: ${event.type}`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  };

  const unsubscribe = eventBus.subscribe(sendEvent);
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    logger.info('[SSE] Cliente desconectado');
    clearInterval(keepAlive);
    unsubscribe();
  });
});

module.exports = router;
