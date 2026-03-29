const { EventEmitter } = require('events');
const { prisma } = require('../db/prisma');
const { withAdvisoryLock } = require('./distributed-lock.service');
const { logger } = require('../utils/logger');

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

const POLL_INTERVAL_MS = Number.parseInt(process.env.OPERATIONAL_EVENTS_POLL_MS || '1000', 10);
const INSTANCE_ID = process.env.INSTANCE_ID || `${process.env.HOSTNAME || 'local'}-${process.pid}`;
const RETENTION_HOURS = Number.parseInt(process.env.OPERATIONAL_EVENTS_RETENTION_HOURS || '72', 10);
const CLEANUP_INTERVAL_MS = Number.parseInt(process.env.OPERATIONAL_EVENTS_CLEANUP_MS || '300000', 10);

let pollerId = null;
let subscriberCount = 0;
let lastSeenEventId = null;
let initializingCursorPromise = null;
let cleanupPromise = null;
let lastCleanupStartedAt = 0;

const emitEvent = (event) => {
  emitter.emit('event', event);
};

const ensureCursorInitialized = async () => {
  if (lastSeenEventId !== null) {
    return lastSeenEventId;
  }

  if (!initializingCursorPromise) {
    initializingCursorPromise = prisma.operationalEvent.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    })
      .then((latest) => {
        lastSeenEventId = latest?.id || 0;
        return lastSeenEventId;
      })
      .catch((error) => {
        logger.error('No se pudo inicializar el cursor del event bus', error);
        lastSeenEventId = 0;
        return lastSeenEventId;
      })
      .finally(() => {
        initializingCursorPromise = null;
      });
  }

  return initializingCursorPromise;
};

const scheduleRetentionCleanup = () => {
  if (RETENTION_HOURS <= 0 || cleanupPromise) {
    return;
  }

  const now = Date.now();
  if (now - lastCleanupStartedAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupStartedAt = now;
  const cutoff = new Date(now - (RETENTION_HOURS * 60 * 60 * 1000));

  cleanupPromise = withAdvisoryLock(prisma, 'operational-events-retention', async (tx) => {
    const result = await tx.operationalEvent.deleteMany({
      where: {
        createdAt: { lt: cutoff }
      }
    });

    return result.count;
  })
    .catch((error) => {
      logger.error('No se pudo limpiar retention de operational_events', {
        error: error.message
      });
    })
    .finally(() => {
      cleanupPromise = null;
    });
};

const pollEvents = async () => {
  await ensureCursorInitialized();

  const events = await prisma.operationalEvent.findMany({
    where: {
      id: { gt: lastSeenEventId || 0 }
    },
    orderBy: { id: 'asc' },
    take: 100
  });

  if (events.length === 0) {
    return;
  }

  lastSeenEventId = events[events.length - 1].id;

  events
    .filter((event) => event.sourceInstance !== INSTANCE_ID)
    .forEach((event) => {
      emitEvent({
        type: event.type,
        payload: event.payload
      });
    });

  scheduleRetentionCleanup();
};

const ensurePoller = () => {
  if (pollerId || subscriberCount <= 0) {
    return;
  }

  void pollEvents().catch((error) => {
    logger.error('No se pudo ejecutar el poll inicial del event bus', error);
  });

  pollerId = setInterval(() => {
    void pollEvents().catch((error) => {
      logger.error('No se pudo sincronizar el event bus distribuido', error);
    });
  }, POLL_INTERVAL_MS);
};

const stopPoller = () => {
  if (!pollerId) {
    return;
  }

  clearInterval(pollerId);
  pollerId = null;
};

const publish = (type, payload) => {
  const event = { type, payload };
  emitEvent(event);
  scheduleRetentionCleanup();

  void prisma.operationalEvent.create({
    data: {
      type,
      payload,
      sourceInstance: INSTANCE_ID
    }
  })
    .then((createdEvent) => {
      lastSeenEventId = Math.max(lastSeenEventId || 0, createdEvent.id);
    })
    .catch((error) => {
      logger.error('No se pudo persistir el evento operacional', {
        type,
        error: error.message
      });
    });
};

const subscribe = (handler) => {
  subscriberCount += 1;
  emitter.on('event', handler);
  ensurePoller();

  return () => {
    emitter.off('event', handler);
    subscriberCount = Math.max(0, subscriberCount - 1);

    if (subscriberCount === 0) {
      stopPoller();
    }
  };
};

module.exports = {
  publish,
  subscribe
};
