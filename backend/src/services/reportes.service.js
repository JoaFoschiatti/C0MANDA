/**
 * Servicio de reportes y estadisticas para Comanda.
 *
 * Este servicio genera reportes analíticos del restaurante:
 * - Dashboard con métricas en tiempo real
 * - Reporte de ventas por período
 * - Productos más vendidos (con soporte para variantes)
 * - Ventas por mozo/empleado
 * - Estado del inventario
 * - Consumo de insumos/ingredientes
 *
 * Todos los reportes operan sobre la instalacion unica del restaurante.
 *
 * @module reportes.service
 */

const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const { buildExpiredLotsWhere } = require('./lotes-stock.service');
const { buildIngredienteStockSnapshot } = require('./ingrediente-stock.service');
const { isPagoApproved } = require('./payment-state.service');

/**
 * Construye un rango de fechas para filtros de Prisma.
 *
 * @private
 * @param {string} fechaDesde - Fecha inicio formato YYYY-MM-DD
 * @param {string} fechaHasta - Fecha fin formato YYYY-MM-DD (inclusive)
 * @returns {Object|null} Objeto { gte, lt } para Prisma o null si no hay fechas
 *
 * @example
 * // Retorna rango que incluye todo el 15 y 16 de enero
 * buildDateRange('2024-01-15', '2024-01-16')
 * // { gte: Date(2024-01-15 00:00), lt: Date(2024-01-17 00:00) }
 */
const buildDateRange = (fechaDesde, fechaHasta) => {
  if (!fechaDesde || !fechaHasta) return null;

  const start = new Date(`${fechaDesde}T00:00:00`);
  const endExclusive = new Date(`${fechaHasta}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return { gte: start, lt: endExclusive };
};

const TASK_PRIORITY_ORDER = {
  ALTA: 0,
  MEDIA: 1,
  BAJA: 2
};

const UPCOMING_EXPIRY_WINDOW_DAYS = 7;
const ACTIVE_PEDIDO_STATES = ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO'];
const NON_FINAL_PEDIDO_STATES = ['CANCELADO', 'CERRADO'];
const HISTORICAL_VENTA_PEDIDO_WHERE = {
  estadoPago: 'APROBADO',
  estado: { in: ['COBRADO', 'CERRADO'] }
};

const addDays = (value, days) => {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const formatTaskDate = (value) => (
  value
    ? new Date(value).toISOString().slice(0, 10)
    : null
);

const buildUpcomingLotsWhere = (referenceDate = new Date()) => ({
  activo: true,
  stockActual: { gt: 0 },
  fechaVencimiento: {
    gte: referenceDate,
    lte: addDays(referenceDate, UPCOMING_EXPIRY_WINDOW_DAYS)
  }
});

const compareTaskPriority = (left, right) => (
  TASK_PRIORITY_ORDER[left.prioridad] - TASK_PRIORITY_ORDER[right.prioridad]
);

const compareTaskReferenceDate = (left, right) => {
  const leftValue = left.fechaReferencia ? new Date(left.fechaReferencia).getTime() : 0;
  const rightValue = right.fechaReferencia ? new Date(right.fechaReferencia).getTime() : 0;

  if (leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  return left.id.localeCompare(right.id);
};

const sortTaskItems = (items) => [...items].sort((left, right) => {
  const byPriority = compareTaskPriority(left, right);
  if (byPriority !== 0) {
    return byPriority;
  }

  return compareTaskReferenceDate(left, right);
});

const countTaskType = (items, type) => items.filter((item) => item.tipo === type).length;

const buildSucursalEntity = (item) => ({
  sucursalId: item?.sucursalId ?? item?.sucursal?.id ?? null,
  sucursalNombre: item?.sucursal?.nombre ?? null
});

const buildIngredienteStocksSnapshot = async (prisma) => {
  const [sucursales, ingredientes] = await prisma.$transaction([
    prisma.sucursal.findMany({
      where: { activa: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nombre: true,
        codigo: true
      }
    }),
    prisma.ingrediente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        stocks: {
          where: { activo: true },
          include: {
            sucursal: {
              select: {
                id: true,
                nombre: true,
                codigo: true
              }
            }
          }
        }
      }
    })
  ]);

  return ingredientes.flatMap((ingrediente) => sucursales.map((sucursal) => {
    const stock = ingrediente.stocks.find((item) => item.sucursalId === sucursal.id) || null;
    return buildIngredienteStockSnapshot(ingrediente, {
      sucursalId: sucursal.id,
      sucursal,
      stock,
      useLegacyFallback: false
    });
  }));
};

const buildTaskSummary = (caja, stock) => {
  const total = caja.length + stock.length;
  const altaPrioridad = [...caja, ...stock]
    .filter((item) => item.prioridad === 'ALTA')
    .length;

  return {
    total,
    altaPrioridad,
    caja: caja.length,
    stock: stock.length,
    mesasEsperandoCuenta: countTaskType(caja, 'MESA_ESPERANDO_CUENTA'),
    qrPendientes: countTaskType(caja, 'QR_PRESENCIAL_PENDIENTE'),
    pedidosPorCerrar: countTaskType(caja, 'PEDIDO_COBRADO_PENDIENTE_CIERRE'),
    mesasPorLiberar: countTaskType(caja, 'MESA_CERRADA_PENDIENTE_LIBERACION'),
    stockBajo: countTaskType(stock, 'INGREDIENTE_STOCK_BAJO'),
    lotesPorVencer: countTaskType(stock, 'LOTE_PROXIMO_A_VENCER'),
    lotesVencidosPendientes: countTaskType(stock, 'LOTE_VENCIDO_PENDIENTE_DESCARTE')
  };
};

const buildMesaEsperandoCuentaTask = (mesa) => {
  const pedidoActivo = mesa.pedidos?.[0] || null;

  return {
    id: `caja:mesa-esperando-cuenta:${mesa.id}`,
    categoria: 'CAJA',
    tipo: 'MESA_ESPERANDO_CUENTA',
    prioridad: 'ALTA',
    fechaReferencia: mesa.updatedAt.toISOString(),
    titulo: `Mesa ${mesa.numero} esperando cuenta`,
    descripcion: pedidoActivo
      ? `Mesa ${mesa.numero} solicito precuenta para el pedido #${pedidoActivo.id}.`
      : `Mesa ${mesa.numero} solicito precuenta y no tiene pedido activo resoluble.`,
    entidad: {
      mesaId: mesa.id,
      pedidoId: pedidoActivo?.id ?? null
    }
  };
};

const buildQrPendienteTask = (pago) => {
  const mesaNumero = pago.pedido?.mesa?.numero;
  const monto = decimalToNumber(pago.monto);
  const propinaMonto = decimalToNumber(pago.propinaMonto);
  const total = monto + propinaMonto;

  return {
    id: `caja:qr-presencial-pendiente:${pago.id}`,
    categoria: 'CAJA',
    tipo: 'QR_PRESENCIAL_PENDIENTE',
    prioridad: 'MEDIA',
    fechaReferencia: pago.updatedAt.toISOString(),
    titulo: `QR presencial pendiente para pedido #${pago.pedido.id}`,
    descripcion: mesaNumero
      ? `Pedido #${pago.pedido.id} en mesa ${mesaNumero} mantiene un cobro QR pendiente por $${total.toFixed(2)}.`
      : `Pedido #${pago.pedido.id} mantiene un cobro QR pendiente por $${total.toFixed(2)}.`,
    entidad: {
      pagoId: pago.id,
      pedidoId: pago.pedido.id,
      mesaId: pago.pedido.mesaId ?? null
    }
  };
};

const buildPedidoPorCerrarTask = (pedido) => ({
  id: `caja:pedido-cobrado-pendiente-cierre:${pedido.id}`,
  categoria: 'CAJA',
  tipo: 'PEDIDO_COBRADO_PENDIENTE_CIERRE',
  prioridad: 'ALTA',
  fechaReferencia: pedido.updatedAt.toISOString(),
  titulo: `Pedido #${pedido.id} pendiente de cierre`,
  descripcion: pedido.mesa?.numero
    ? `Pedido #${pedido.id} ya esta cobrado en mesa ${pedido.mesa.numero} y debe cerrarse.`
    : `Pedido #${pedido.id} ya esta cobrado y debe cerrarse.`,
  entidad: {
    pedidoId: pedido.id,
    mesaId: pedido.mesaId ?? null
  }
});

const buildMesaPorLiberarTask = (mesa) => {
  const pedidoCerrado = mesa.pedidos?.find((pedido) => pedido.estado === 'CERRADO') || null;

  return {
    id: `caja:mesa-cerrada-pendiente-liberacion:${mesa.id}`,
    categoria: 'CAJA',
    tipo: 'MESA_CERRADA_PENDIENTE_LIBERACION',
    prioridad: 'MEDIA',
    fechaReferencia: mesa.updatedAt.toISOString(),
    titulo: `Mesa ${mesa.numero} pendiente de liberacion`,
    descripcion: pedidoCerrado
      ? `Mesa ${mesa.numero} ya cerro el pedido #${pedidoCerrado.id} y espera liberacion.`
      : `Mesa ${mesa.numero} esta cerrada y espera liberacion.`,
    entidad: {
      mesaId: mesa.id,
      pedidoId: pedidoCerrado?.id ?? null
    }
  };
};

const buildLoteVencidoTask = (lote) => ({
  id: `stock:lote-vencido:${lote.id}`,
  categoria: 'STOCK',
  tipo: 'LOTE_VENCIDO_PENDIENTE_DESCARTE',
  prioridad: 'ALTA',
  fechaReferencia: lote.fechaVencimiento.toISOString(),
  titulo: `Lote ${lote.codigoLote} vencido`,
  descripcion: `El lote ${lote.codigoLote} de ${lote.ingrediente.nombre} (${lote.sucursal?.nombre || 'Sucursal sin definir'}) vencio el ${formatTaskDate(lote.fechaVencimiento)} y mantiene ${decimalToNumber(lote.stockActual).toFixed(2)} ${lote.ingrediente.unidad}.`,
  entidad: {
    ingredienteId: lote.ingredienteId,
    loteId: lote.id,
    ...buildSucursalEntity(lote)
  }
});

const buildIngredienteStockBajoTask = (ingredienteStock) => {
  const stockActual = decimalToNumber(ingredienteStock.stockActual);
  const stockMinimo = decimalToNumber(ingredienteStock.stockMinimo);

  return {
    id: `stock:ingrediente-stock-bajo:${ingredienteStock.ingredienteId}:${ingredienteStock.sucursalId}`,
    categoria: 'STOCK',
    tipo: 'INGREDIENTE_STOCK_BAJO',
    prioridad: stockActual <= 0 ? 'ALTA' : 'MEDIA',
    fechaReferencia: ingredienteStock.updatedAt.toISOString(),
    titulo: `Stock bajo de ${ingredienteStock.ingrediente.nombre}`,
    descripcion: `${ingredienteStock.ingrediente.nombre} en ${ingredienteStock.sucursal?.nombre || 'Sucursal sin definir'} quedo en ${stockActual.toFixed(2)} ${ingredienteStock.ingrediente.unidad} sobre un minimo de ${stockMinimo.toFixed(2)} ${ingredienteStock.ingrediente.unidad}.`,
    entidad: {
      ingredienteId: ingredienteStock.ingredienteId,
      ...buildSucursalEntity(ingredienteStock)
    }
  };
};

const buildLotePorVencerTask = (lote) => ({
  id: `stock:lote-proximo-a-vencer:${lote.id}`,
  categoria: 'STOCK',
  tipo: 'LOTE_PROXIMO_A_VENCER',
  prioridad: 'BAJA',
  fechaReferencia: lote.fechaVencimiento.toISOString(),
  titulo: `Lote ${lote.codigoLote} proximo a vencer`,
  descripcion: `El lote ${lote.codigoLote} de ${lote.ingrediente.nombre} (${lote.sucursal?.nombre || 'Sucursal sin definir'}) vence el ${formatTaskDate(lote.fechaVencimiento)} y conserva ${decimalToNumber(lote.stockActual).toFixed(2)} ${lote.ingrediente.unidad}.`,
  entidad: {
    ingredienteId: lote.ingredienteId,
    loteId: lote.id,
    ...buildSucursalEntity(lote)
  }
});

const tareasCentro = async (prisma, referenceDate = new Date()) => {
  const [
    mesasEsperandoCuenta,
    pagosQrPendientes,
    pedidosPorCerrar,
    mesasCerradas,
    lotesVencidos,
    lotesPorVencer
  ] = await prisma.$transaction([
    prisma.mesa.findMany({
      where: {
        activa: true,
        estado: 'ESPERANDO_CUENTA'
      },
      select: {
        id: true,
        numero: true,
        updatedAt: true,
        pedidos: {
          where: {
            estado: { in: ACTIVE_PEDIDO_STATES }
          },
          orderBy: [
            { updatedAt: 'desc' },
            { id: 'desc' }
          ],
          take: 1,
          select: {
            id: true
          }
        }
      }
    }),
    prisma.pago.findMany({
      where: {
        canalCobro: 'QR_PRESENCIAL',
        estado: 'PENDIENTE',
        pedido: {
          estado: {
            notIn: NON_FINAL_PEDIDO_STATES
          }
        }
      },
      select: {
        id: true,
        monto: true,
        propinaMonto: true,
        updatedAt: true,
        pedido: {
          select: {
            id: true,
            mesaId: true,
            mesa: {
              select: {
                numero: true
              }
            }
          }
        }
      }
    }),
    prisma.pedido.findMany({
      where: {
        estado: 'COBRADO'
      },
      select: {
        id: true,
        mesaId: true,
        updatedAt: true,
        mesa: {
          select: {
            numero: true
          }
        }
      }
    }),
    prisma.mesa.findMany({
      where: {
        activa: true,
        estado: 'CERRADA'
      },
      select: {
        id: true,
        numero: true,
        updatedAt: true,
        pedidos: {
          where: {
            estado: {
              in: ['COBRADO', 'CERRADO']
            }
          },
          orderBy: [
            { updatedAt: 'desc' },
            { id: 'desc' }
          ],
          select: {
            id: true,
            estado: true
          }
        }
      }
    }),
    prisma.loteStock.findMany({
      where: {
        ...buildExpiredLotsWhere(referenceDate)
      },
      select: {
        id: true,
        ingredienteId: true,
        codigoLote: true,
        stockActual: true,
        fechaVencimiento: true,
        sucursalId: true,
        ingrediente: {
          select: {
            id: true,
            nombre: true,
            unidad: true
          }
        },
        sucursal: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    }),
    prisma.loteStock.findMany({
      where: {
        ...buildUpcomingLotsWhere(referenceDate)
      },
      select: {
        id: true,
        ingredienteId: true,
        codigoLote: true,
        stockActual: true,
        fechaVencimiento: true,
        sucursalId: true,
        ingrediente: {
          select: {
            id: true,
            nombre: true,
            unidad: true
          }
        },
        sucursal: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    })
  ]);

  const ingredientesStock = await buildIngredienteStocksSnapshot(prisma);

  const caja = sortTaskItems([
    ...mesasEsperandoCuenta.map(buildMesaEsperandoCuentaTask),
    ...pagosQrPendientes.map(buildQrPendienteTask),
    ...pedidosPorCerrar.map(buildPedidoPorCerrarTask),
    ...mesasCerradas
      .filter((mesa) => !mesa.pedidos.some((pedido) => pedido.estado === 'COBRADO'))
      .map(buildMesaPorLiberarTask)
  ]);

  const stock = sortTaskItems([
    ...ingredientesStock
      .filter((ingredienteStock) => decimalToNumber(ingredienteStock.stockActual) <= decimalToNumber(ingredienteStock.stockMinimo))
      .map(buildIngredienteStockBajoTask),
    ...lotesVencidos.map(buildLoteVencidoTask),
    ...lotesPorVencer.map(buildLotePorVencerTask)
  ]);

  return {
    actualizadoEn: referenceDate.toISOString(),
    resumen: buildTaskSummary(caja, stock),
    caja,
    stock
  };
};

/**
 * Obtiene métricas del dashboard en tiempo real.
 *
 * Ejecuta múltiples consultas en una transacción para obtener
 * el estado actual del restaurante de forma eficiente.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 *
 * @returns {Promise<Object>} Métricas del dashboard
 * @returns {number} returns.ventasHoy - Total vendido hoy (solo pedidos COBRADO)
 * @returns {number} returns.pedidosHoy - Cantidad de pedidos hoy (excluye CANCELADO)
 * @returns {number} returns.pedidosPendientes - Pedidos PENDIENTE o EN_PREPARACION
 * @returns {number} returns.mesasOcupadas - Mesas con estado OCUPADA
 * @returns {number} returns.mesasTotal - Total de mesas activas
 * @returns {number} returns.alertasStock - Ingredientes con stock <= mínimo
 * @returns {number} returns.lotesVencidosPendientes - Lotes vencidos con descarte pendiente
 * @returns {number} returns.empleadosTrabajando - Fichajes abiertos (sin salida)
 *
 * @example
 * const stats = await dashboard(prisma, 1);
 * // {
 * //   ventasHoy: 45000,
 * //   pedidosHoy: 25,
 * //   pedidosPendientes: 3,
 * //   mesasOcupadas: 8,
 * //   mesasTotal: 15,
 * //   alertasStock: 2,
 * //   lotesVencidosPendientes: 1,
 * //   empleadosTrabajando: 5
 * // }
 */
const dashboard = async (prisma) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const [
    ventasHoyAgg,
    pedidosHoyCount,
    pedidosPendientes,
    mesasOcupadas,
    mesasTotal,
    empleadosTrabajando
  ] = await prisma.$transaction([
    prisma.pedido.aggregate({
      where: {
        createdAt: { gte: hoy, lt: manana },
        ...HISTORICAL_VENTA_PEDIDO_WHERE
      },
      _sum: { total: true },
      _count: { id: true }
    }),
    prisma.pedido.count({
      where: {
        createdAt: { gte: hoy, lt: manana },
        estado: { not: 'CANCELADO' }
      }
    }),
    prisma.pedido.count({
      where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION'] } }
    }),
    prisma.mesa.count({
      where: { estado: 'OCUPADA' }
    }),
    prisma.mesa.count({
      where: { activa: true }
    }),
    prisma.fichaje.count({
      where: { salida: null }
    })
  ]);

  const centroTareas = await tareasCentro(prisma);

  const ventasHoy = decimalToNumber(ventasHoyAgg._sum.total);
  const pedidosHoy = pedidosHoyCount;

  return {
    ventasHoy,
    pedidosHoy,
    pedidosPendientes,
    mesasOcupadas,
    mesasTotal,
    alertasStock: centroTareas.resumen.stockBajo,
    lotesVencidosPendientes: centroTareas.resumen.lotesVencidosPendientes,
    empleadosTrabajando,
    tareasPendientes: centroTareas.resumen.total,
    tareasCaja: centroTareas.resumen.caja,
    tareasStock: centroTareas.resumen.stock,
    tareasAltaPrioridad: centroTareas.resumen.altaPrioridad
  };
};

/**
 * Genera reporte detallado de ventas por período.
 *
 * Incluye solo pedidos COBRADOS y agrupa por método de pago y tipo de pedido.
 * Retorna también los pedidos individuales para análisis detallado.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {Object} query - Parámetros del reporte
 * @param {string} query.fechaDesde - Fecha inicio formato YYYY-MM-DD (requerido)
 * @param {string} query.fechaHasta - Fecha fin formato YYYY-MM-DD (requerido)
 *
 * @returns {Promise<Object>} Reporte de ventas
 * @returns {Object} returns.periodo - { desde, hasta }
 * @returns {number} returns.totalVentas - Suma total de ventas
 * @returns {number} returns.totalPedidos - Cantidad de pedidos cobrados
 * @returns {number} returns.ticketPromedio - totalVentas / totalPedidos
 * @returns {Object} returns.ventasPorMetodo - { EFECTIVO: 10000, MERCADOPAGO: 5000, ... }
 * @returns {Object} returns.ventasPorTipo - { MESA: { cantidad, total }, DELIVERY: {...}, ... }
 * @returns {Array} returns.pedidos - Lista de pedidos con items, usuario y pagos
 *
 * @throws {HttpError} 400 - Si no se proporcionan las fechas
 *
 * @example
 * const reporte = await ventasReporte(prisma, 1, {
 *   fechaDesde: '2024-01-01',
 *   fechaHasta: '2024-01-31'
 * });
 * // {
 * //   periodo: { desde: '2024-01-01', hasta: '2024-01-31' },
 * //   totalVentas: 250000,
 * //   totalPedidos: 150,
 * //   ticketPromedio: 1666.67,
 * //   ventasPorMetodo: { EFECTIVO: 150000, MERCADOPAGO: 100000 },
 * //   ventasPorTipo: { MESA: { cantidad: 100, total: 180000 }, DELIVERY: {...} },
 * //   pedidos: [...]
 * // }
 */
const ventasReporte = async (prisma, query) => {
  const { fechaDesde, fechaHasta } = query;

  if (!fechaDesde || !fechaHasta) {
    throw createHttpError.badRequest('Fechas requeridas');
  }

  const range = buildDateRange(fechaDesde, fechaHasta);

  const pedidos = await prisma.pedido.findMany({
    where: {
      createdAt: range,
      ...HISTORICAL_VENTA_PEDIDO_WHERE
    },
    include: {
      items: { include: { producto: { select: { nombre: true, categoriaId: true } } } },
      usuario: { select: { nombre: true } },
      pagos: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const totalVentas = pedidos.reduce((sum, p) => sum + decimalToNumber(p.total), 0);
  const totalPedidos = pedidos.length;

  const ventasPorMetodo = {};
  for (const pedido of pedidos) {
    for (const pago of pedido.pagos) {
      if (!isPagoApproved(pago)) {
        continue;
      }
      if (!ventasPorMetodo[pago.metodo]) {
        ventasPorMetodo[pago.metodo] = 0;
      }
      ventasPorMetodo[pago.metodo] += decimalToNumber(pago.monto);
    }
  }

  const ventasPorTipo = pedidos.reduce((acc, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = { cantidad: 0, total: 0 };
    acc[p.tipo].cantidad++;
    acc[p.tipo].total += decimalToNumber(p.total);
    return acc;
  }, {});

  return {
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    totalVentas,
    totalPedidos,
    ticketPromedio: totalPedidos > 0 ? totalVentas / totalPedidos : 0,
    ventasPorMetodo,
    ventasPorTipo,
    pedidos
  };
};

/**
 * Obtiene ranking de productos más vendidos.
 *
 * Puede agrupar variantes bajo su producto base o mostrarlas separadas.
 * Solo cuenta items de pedidos COBRADOS.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 * @param {number} [query.limite=10] - Máximo de productos a retornar
 * @param {boolean} [query.agruparPorBase=false] - Si true, agrupa variantes bajo producto base
 *
 * @returns {Promise<Array>} Lista de productos ordenados por ventas
 *
 * @example
 * // Sin agrupar variantes
 * const top = await productosMasVendidos(prisma, 1, { limite: 5 });
 * // [
 * //   { producto: 'Hamburguesa Clásica', categoria: 'Hamburguesas',
 * //     cantidadVendida: 150, totalVentas: 225000,
 * //     esVariante: false, productoBase: null },
 * //   { producto: 'Hamburguesa Doble', categoria: 'Hamburguesas',
 * //     cantidadVendida: 120, totalVentas: 240000,
 * //     esVariante: true, productoBase: 'Hamburguesa' },
 * //   ...
 * // ]
 *
 * @example
 * // Agrupando variantes
 * const topAgrupado = await productosMasVendidos(prisma, 1, {
 *   agruparPorBase: true,
 *   limite: 5
 * });
 * // [
 * //   { productoBaseId: 1, producto: 'Hamburguesa', categoria: 'Hamburguesas',
 * //     cantidadVendida: 270, totalVentas: 465000,
 * //     variantes: [
 * //       { nombre: 'Hamburguesa Clásica', nombreVariante: 'Clásica', ... },
 * //       { nombre: 'Hamburguesa Doble', nombreVariante: 'Doble', ... }
 * //     ] },
 * //   ...
 * // ]
 */
const productosMasVendidos = async (prisma, query) => {
  const { fechaDesde, fechaHasta, limite, agruparPorBase } = query;

  const where = {
    pedido: HISTORICAL_VENTA_PEDIDO_WHERE
  };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.pedido.createdAt = range;
  }

  const take = agruparPorBase ? undefined : (limite || 10);

  const items = await prisma.pedidoItem.groupBy({
    by: ['productoId'],
    _sum: { cantidad: true, subtotal: true },
    where,
    orderBy: { _sum: { subtotal: 'desc' } },
    take
  });

  const productosIds = items.map(i => i.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productosIds } },
    include: {
      categoria: { select: { nombre: true } },
      productoBase: { select: { id: true, nombre: true } }
    }
  });

  const productosById = new Map(productos.map(p => [p.id, p]));

  if (agruparPorBase) {
    const agrupado = {};

    items.forEach(item => {
      const producto = productosById.get(item.productoId);
      if (!producto) return;

      const baseId = producto.productoBase?.id || producto.id;
      const baseName = producto.productoBase?.nombre || producto.nombre;

      if (!agrupado[baseId]) {
        agrupado[baseId] = {
          productoBaseId: baseId,
          producto: baseName,
          categoria: producto.categoria?.nombre || '-',
          cantidadVendida: 0,
          totalVentas: 0,
          variantes: []
        };
      }

      agrupado[baseId].cantidadVendida += item._sum.cantidad || 0;
      agrupado[baseId].totalVentas += decimalToNumber(item._sum.subtotal);

      if (producto.productoBase) {
        agrupado[baseId].variantes.push({
          nombre: producto.nombre,
          nombreVariante: producto.nombreVariante,
          cantidadVendida: item._sum.cantidad,
          totalVentas: item._sum.subtotal
        });
      }
    });

    return Object.values(agrupado)
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, limite || 10);
  }

  return items.map(item => {
    const producto = productosById.get(item.productoId);
    return {
      producto: producto?.nombre || 'Producto eliminado',
      categoria: producto?.categoria?.nombre || '-',
      cantidadVendida: item._sum.cantidad,
      totalVentas: item._sum.subtotal,
      esVariante: producto ? producto.productoBaseId !== null : false,
      productoBase: producto?.productoBase?.nombre || null
    };
  });
};

/**
 * Obtiene ventas agrupadas por mozo/empleado.
 *
 * Útil para evaluar rendimiento de empleados y calcular comisiones.
 * Incluye pedidos sin usuario (Menú Público).
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 *
 * @returns {Promise<Array>} Lista de mozos con sus ventas, ordenados por total
 *
 * @example
 * const ventasMozos = await ventasPorMozo(prisma, 1, {
 *   fechaDesde: '2024-01-01',
 *   fechaHasta: '2024-01-31'
 * });
 * // [
 * //   { mozo: 'Juan Pérez', pedidos: 45, totalVentas: 67500 },
 * //   { mozo: 'María García', pedidos: 38, totalVentas: 57000 },
 * //   { mozo: 'Menú Público', pedidos: 20, totalVentas: 30000 },
 * //   ...
 * // ]
 */
const ventasPorMozo = async (prisma, query) => {
  const { fechaDesde, fechaHasta } = query;

  const where = { ...HISTORICAL_VENTA_PEDIDO_WHERE };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.createdAt = range;
  }

  const pedidos = await prisma.pedido.groupBy({
    by: ['usuarioId'],
    _count: { id: true },
    _sum: { total: true },
    where,
    orderBy: { _sum: { total: 'desc' } }
  });

  const usuariosIds = pedidos.map(p => p.usuarioId).filter(id => id !== null);
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: usuariosIds } },
    select: { id: true, nombre: true }
  });

  const usuariosById = new Map(usuarios.map(u => [u.id, u]));

  return pedidos.map(p => {
    const usuario = p.usuarioId !== null ? usuariosById.get(p.usuarioId) : null;
    return {
      mozo: usuario?.nombre || (p.usuarioId === null ? 'Menú Público' : 'Usuario eliminado'),
      pedidos: p._count.id,
      totalVentas: p._sum.total
    };
  });
};

/**
 * Genera reporte del estado actual del inventario.
 *
 * Lista todos los ingredientes activos con su stock, estado
 * y valor estimado basado en el costo unitario.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 *
 * @returns {Promise<Object>} Reporte de inventario
 * @returns {Object} returns.resumen - Totales agregados
 * @returns {number} returns.resumen.totalItems - Cantidad de ingredientes
 * @returns {number} returns.resumen.itemsBajoStock - Items con stock <= mínimo
 * @returns {number} returns.resumen.valorTotalEstimado - Suma de valorEstimado de todos
 * @returns {Array} returns.ingredientes - Lista de ingredientes con estado
 *
 * @example
 * const inventario = await inventarioReporte(prisma, 1);
 * // {
 * //   resumen: { totalItems: 25, itemsBajoStock: 3, valorTotalEstimado: 45000 },
 * //   ingredientes: [
 * //     { id: 1, nombre: 'Harina', unidad: 'kg',
 * //       stockActual: 5, stockMinimo: 10, estado: 'BAJO', valorEstimado: 2500 },
 * //     { id: 2, nombre: 'Tomate', unidad: 'kg',
 * //       stockActual: 20, stockMinimo: 5, estado: 'OK', valorEstimado: 8000 },
 * //     ...
 * //   ]
 * // }
 */
const inventarioReporte = async (prisma) => {
  const ingredientes = await buildIngredienteStocksSnapshot(prisma);

  const reporte = ingredientes.map(ing => {
    const stockActual = decimalToNumber(ing.stockActual);
    const stockMinimo = decimalToNumber(ing.stockMinimo);

    return {
      id: ing.ingredienteId,
      ingredienteStockId: ing.id,
      nombre: ing.ingrediente.nombre,
      unidad: ing.ingrediente.unidad,
      stockActual: ing.stockActual,
      stockMinimo: ing.stockMinimo,
      sucursalId: ing.sucursalId,
      sucursalNombre: ing.sucursal?.nombre || null,
      estado: stockActual <= stockMinimo ? 'BAJO' : 'OK',
      valorEstimado: ing.ingrediente.costo ? stockActual * decimalToNumber(ing.ingrediente.costo) : null
    };
  });

  const resumen = {
    totalItems: reporte.length,
    itemsBajoStock: reporte.filter(r => r.estado === 'BAJO').length,
    valorTotalEstimado: reporte.reduce((sum, r) => sum + (r.valorEstimado || 0), 0)
  };

  return { resumen, ingredientes: reporte };
};
/**
 * Obtiene ventas agrupadas por producto base con desglose de variantes.
 *
 * Similar a productosMasVendidos con agruparPorBase=true, pero siempre
 * incluye el desglose de variantes con más detalle.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 * @param {number} [query.limite=20] - Máximo de productos base a retornar
 *
 * @returns {Promise<Array>} Lista de productos base con variantes
 *
 * @example
 * const ventas = await ventasPorProductoBase(prisma, 1, { limite: 5 });
 * // [
 * //   {
 * //     productoBaseId: 1,
 * //     nombreBase: 'Pizza',
 * //     categoria: 'Pizzas',
 * //     cantidadTotal: 200,
 * //     totalVentas: 400000,
 * //     variantes: [
 * //       { nombre: 'Pizza Grande', nombreVariante: 'Grande', cantidad: 120, ventas: 280000 },
 * //       { nombre: 'Pizza Chica', nombreVariante: 'Chica', cantidad: 80, ventas: 120000 }
 * //     ]
 * //   },
 * //   ...
 * // ]
 */
const ventasPorProductoBase = async (prisma, query) => {
  const { fechaDesde, fechaHasta, limite } = query;

  const where = {
    pedido: HISTORICAL_VENTA_PEDIDO_WHERE
  };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.pedido.createdAt = range;
  }

  const items = await prisma.pedidoItem.findMany({
    where,
    include: {
      producto: {
        include: {
          productoBase: { select: { id: true, nombre: true } },
          categoria: { select: { nombre: true } }
        }
      }
    }
  });

  const agrupado = {};

  items.forEach(item => {
    const producto = item.producto;
    if (!producto) return;

    const baseId = producto.productoBase?.id || producto.id;
    const baseName = producto.productoBase?.nombre || producto.nombre;

    if (!agrupado[baseId]) {
      agrupado[baseId] = {
        productoBaseId: baseId,
        nombreBase: baseName,
        categoria: producto.categoria?.nombre || '-',
        cantidadTotal: 0,
        totalVentas: 0,
        variantes: {}
      };
    }

    agrupado[baseId].cantidadTotal += item.cantidad;
    agrupado[baseId].totalVentas += decimalToNumber(item.subtotal);

    const varianteKey = producto.nombreVariante || 'Base';
    if (!agrupado[baseId].variantes[varianteKey]) {
      agrupado[baseId].variantes[varianteKey] = {
        nombre: producto.nombre,
        nombreVariante: producto.nombreVariante,
        cantidad: 0,
        ventas: 0
      };
    }

    agrupado[baseId].variantes[varianteKey].cantidad += item.cantidad;
    agrupado[baseId].variantes[varianteKey].ventas += decimalToNumber(item.subtotal);
  });

  return Object.values(agrupado)
    .map(item => ({
      ...item,
      variantes: Object.values(item.variantes)
    }))
    .sort((a, b) => b.cantidadTotal - a.cantidadTotal)
    .slice(0, limite || 20);
};

/**
 * Calcula consumo de insumos/ingredientes por período.
 *
 * Analiza los items de pedidos COBRADOS y calcula cuánto de cada
 * ingrediente se consumió basándose en las recetas de productos.
 * Considera el multiplicadorInsumos de cada producto.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 *
 * @returns {Promise<Object>} Reporte de consumo de insumos
 * @returns {Object} returns.resumen - Totales agregados
 * @returns {number} returns.resumen.totalIngredientes - Ingredientes únicos consumidos
 * @returns {number} returns.resumen.ingredientesBajoStock - Items con stock <= mínimo
 * @returns {number} returns.resumen.costoTotalEstimado - Costo total del consumo
 * @returns {Array} returns.ingredientes - Lista de ingredientes consumidos
 *
 * @example
 * const consumo = await consumoInsumos(prisma, 1, {
 *   fechaDesde: '2024-01-01',
 *   fechaHasta: '2024-01-31'
 * });
 * // {
 * //   resumen: {
 * //     totalIngredientes: 15,
 * //     ingredientesBajoStock: 2,
 * //     costoTotalEstimado: 125000
 * //   },
 * //   ingredientes: [
 * //     {
 * //       ingredienteId: 1,
 * //       nombre: 'Harina',
 * //       unidad: 'kg',
 * //       consumoTotal: 50,
 * //       stockActual: 10,
 * //       stockMinimo: 15,
 * //       costo: 500,
 * //       costoTotal: 25000,
 * //       estado: 'BAJO',
 * //       detalleProductos: [
 * //         { producto: 'Pizza Grande', multiplicador: 1.2, cantidad: 100, consumo: 30 },
 * //         { producto: 'Pan', multiplicador: 1.0, cantidad: 50, consumo: 20 }
 * //       ]
 * //     },
 * //     ...
 * //   ]
 * // }
 */
const consumoInsumos = async (prisma, query) => {
  const { fechaDesde, fechaHasta } = query;

  const where = {
    pedido: HISTORICAL_VENTA_PEDIDO_WHERE
  };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.pedido.createdAt = range;
  }

  const items = await prisma.pedidoItem.findMany({
    where,
    include: {
      producto: {
        include: {
          ingredientes: {
            include: {
              ingrediente: true
            }
          }
        }
      }
    }
  });

  const consumoPorIngrediente = {};

  items.forEach(item => {
    const producto = item.producto;
    if (!producto || !producto.ingredientes) return;

    const multiplicador = decimalToNumber(producto.multiplicadorInsumos) || 1.0;

    producto.ingredientes.forEach(pi => {
      const ingrediente = pi.ingrediente;
      if (!ingrediente) return;

      const consumo = decimalToNumber(pi.cantidad) * item.cantidad * multiplicador;

      if (!consumoPorIngrediente[ingrediente.id]) {
        consumoPorIngrediente[ingrediente.id] = {
          ingredienteId: ingrediente.id,
          nombre: ingrediente.nombre,
          unidad: ingrediente.unidad,
          consumoTotal: 0,
          stockActual: decimalToNumber(ingrediente.stockActual),
          stockMinimo: decimalToNumber(ingrediente.stockMinimo),
          costo: ingrediente.costo ? decimalToNumber(ingrediente.costo) : null,
          detalleProductos: {}
        };
      }

      consumoPorIngrediente[ingrediente.id].consumoTotal += consumo;

      const productoKey = producto.nombre;
      if (!consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey]) {
        consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey] = {
          producto: producto.nombre,
          multiplicador,
          cantidad: 0,
          consumo: 0
        };
      }
      consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey].cantidad += item.cantidad;
      consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey].consumo += consumo;
    });
  });

  const resultado = Object.values(consumoPorIngrediente)
    .map(item => ({
      ...item,
      costoTotal: item.costo ? item.consumoTotal * item.costo : null,
      estado: item.stockActual <= item.stockMinimo ? 'BAJO' : 'OK',
      detalleProductos: Object.values(item.detalleProductos)
    }))
    .sort((a, b) => b.consumoTotal - a.consumoTotal);

  const resumen = {
    totalIngredientes: resultado.length,
    ingredientesBajoStock: resultado.filter(r => r.estado === 'BAJO').length,
    costoTotalEstimado: resultado.reduce((sum, r) => sum + (r.costoTotal || 0), 0)
  };

  return { resumen, ingredientes: resultado };
};

module.exports = {
  dashboard,
  tareasCentro,
  ventasReporte,
  productosMasVendidos,
  ventasPorMozo,
  inventarioReporte,
  ventasPorProductoBase,
  consumoInsumos
};
