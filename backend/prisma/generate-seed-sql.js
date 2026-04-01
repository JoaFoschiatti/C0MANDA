// generate-seed-sql.js — Generates seed-data.sql with 1 year of realistic test data
// Usage: node prisma/generate-seed-sql.js > prisma/seed-data.sql
const fs = require('fs');
const path = require('path');

// ── Seeded PRNG (mulberry32) ──
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── Date helpers ──
const TODAY = new Date('2026-03-09');
const ONE_YEAR_AGO = new Date('2025-03-10');

function isWorkDay(d) {
  const dow = d.getDay();
  return dow >= 1 && dow <= 6; // Mon-Sat
}

function getWorkDays(from, to) {
  const days = [];
  const d = new Date(from);
  while (d <= to) {
    if (isWorkDay(d)) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmt(d) {
  return d.toISOString().replace('T', ' ').replace('Z', '+00');
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function addHours(d, h, m = 0) {
  const r = new Date(d);
  r.setUTCHours(h, m, 0, 0);
  return r;
}

function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// ── SQL output ──
const lines = [];
const sql = (s) => lines.push(s);

// ── BEGIN ──
sql('BEGIN;');
sql('');

// Truncate everything
sql('-- Truncate all tables');
const tables = [
  'transacciones_mercadopago', 'comprobantes_fiscales', 'clientes_fiscales',
  'puntos_venta_fiscales', 'print_jobs', 'pedido_item_modificadores',
  'pedido_auditorias', 'movimientos_stock', 'lotes_stock', 'pagos',
  'pedido_items', 'pedidos', 'producto_modificadores', 'modificadores',
  'producto_ingredientes', 'ingredientes', 'productos', 'categorias',
  'reservas', 'cierres_caja', 'fichajes', 'liquidaciones',
  'refresh_tokens', 'configuraciones', 'mercadopago_configs',
  'mesas', 'usuarios', 'negocios'
];
sql(`TRUNCATE ${tables.join(', ')} CASCADE;`);
sql('');

// ── 1. Negocio ──
sql('-- Negocio');
sql(`INSERT INTO negocios (id, nombre, email, telefono, direccion, "colorPrimario", "colorSecundario", "createdAt", "updatedAt")
VALUES (1, 'Comanda Demo', 'admin@comanda.local', '11-5555-0000', 'Av. Principal 123', '#3B82F6', '#1E40AF', NOW(), NOW());`);
sql('');

// ── 2. Usuarios ──
sql('-- Usuarios');
// bcrypt hash for known passwords (pre-computed with cost 10)
const HASH_ADMIN = '$2a$10$8KzaNdKIMyOkASCakpLeaO5OB.PJhEMl1yKlYH2k2y7B6hFqnOWy'; // admin123
const HASH_MOZO = '$2a$10$QNZ5oyV1.VIhQGOsNqFBGuABjJSBm.0M8UFBoBxSFdBTeZbeHDBVG';  // mozo123
const HASH_COCINERO = '$2a$10$p.Kcai8RLCf4D0m/iJmcreKUiMDxR9e7uCqfJ3RSPKY.6kCjVavhm'; // cocinero123
const HASH_CAJERO = '$2a$10$bGNVsPL10VPpuSHsMMjKj.J0mXp3Kk6aS9MKpUH1WhRZiU.I8Pjy.'; // cajero123
const HASH_DELIVERY = '$2a$10$K7JpAm7eJKIHkEOIMqftMu0G.ckr6FYAzuwXXJ9LJlS3SVf5p/Ru2'; // delivery123

const usuarios = [
  [1, 'admin@comanda.local', HASH_ADMIN, 'Administrador', null, null, null, null, 'ADMIN', null],
  [2, 'mozo@comanda.local', HASH_MOZO, 'Juan', 'Perez', '30123456', '1155551234', null, 'MOZO', 1500],
  [3, 'mozo2@comanda.local', HASH_MOZO, 'Maria', 'Garcia', '31234567', '1155552345', null, 'MOZO', 1500],
  [4, 'cocinero@comanda.local', HASH_COCINERO, 'Pedro', 'Lopez', '32345678', '1155553456', null, 'COCINERO', 1800],
  [5, 'cajero@comanda.local', HASH_CAJERO, 'Carla', 'Suarez', '33456789', '1155554567', null, 'CAJERO', 1700],
  [6, 'delivery@comanda.local', HASH_DELIVERY, 'Diego', 'Martinez', '34567890', '1155555678', null, 'DELIVERY', 1200],
];

for (const u of usuarios) {
  sql(`INSERT INTO usuarios (id, email, password, nombre, apellido, dni, telefono, direccion, rol, "tarifaHora", activo, "createdAt", "updatedAt")
VALUES (${u[0]}, ${esc(u[1])}, ${esc(u[2])}, ${esc(u[3])}, ${esc(u[4])}, ${esc(u[5])}, ${esc(u[6])}, ${esc(u[7])}, '${u[8]}', ${u[9] === null ? 'NULL' : u[9]}, true, NOW(), NOW());`);
}
sql("SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));");
sql('');

// ── 3. Mesas ──
sql('-- Mesas');
const mesas = [
  [1, 1, 'Interior', 4, 60, 80],
  [2, 2, 'Interior', 4, 200, 80],
  [3, 3, 'Interior', 6, 370, 80],
  [4, 4, 'Interior', 8, 120, 220],
  [5, 5, 'Exterior', 4, 60, 80],
  [6, 6, 'Exterior', 2, 200, 80],
];
for (const m of mesas) {
  sql(`INSERT INTO mesas (id, numero, zona, capacidad, "posX", "posY", rotacion, estado, activa, "createdAt", "updatedAt")
VALUES (${m[0]}, ${m[1]}, ${esc(m[2])}, ${m[3]}, ${m[4]}, ${m[5]}, 0, 'LIBRE', true, NOW(), NOW());`);
}
sql("SELECT setval('mesas_id_seq', (SELECT MAX(id) FROM mesas));");
sql('');

// ── 4. Categorias ──
sql('-- Categorias');
const categorias = [
  [1, 'Hamburguesas', 'Hamburguesas artesanales', 1],
  [2, 'Pizzas', 'Pizzas a la piedra', 2],
  [3, 'Pastas', 'Pastas caseras', 3],
  [4, 'Bebidas', 'Bebidas frias y calientes', 4],
  [5, 'Postres', 'Dulces y cafe', 5],
];
for (const c of categorias) {
  sql(`INSERT INTO categorias (id, nombre, descripcion, orden, activa, "createdAt", "updatedAt")
VALUES (${c[0]}, ${esc(c[1])}, ${esc(c[2])}, ${c[3]}, true, NOW(), NOW());`);
}
sql("SELECT setval('categorias_id_seq', (SELECT MAX(id) FROM categorias));");
sql('');

// ── 5. Ingredientes ──
sql('-- Ingredientes');
const ingredientes = [
  [1, 'Carne de hamburguesa', 'unidades', 200, 20, 800],
  [2, 'Pan de hamburguesa', 'unidades', 300, 30, 200],
  [3, 'Queso cheddar', 'fetas', 400, 50, 100],
  [4, 'Bacon', 'fetas', 200, 25, 150],
  [5, 'Lechuga', 'hojas', 150, 20, 30],
  [6, 'Tomate', 'rodajas', 200, 30, 50],
  [7, 'Harina 000', 'kg', 50, 10, 300],
  [8, 'Mozzarella', 'kg', 30, 5, 1200],
  [9, 'Salsa de tomate', 'litros', 20, 5, 400],
  [10, 'Fideos secos', 'kg', 40, 8, 350],
  [11, 'Coca-Cola 500ml', 'unidades', 96, 24, 400],
  [12, 'Agua mineral 500ml', 'unidades', 96, 24, 200],
  [13, 'Cerveza artesanal', 'unidades', 48, 12, 600],
  [14, 'Helado', 'kg', 15, 3, 1500],
  [15, 'Cafe en grano', 'kg', 5, 1, 2500],
];
for (const i of ingredientes) {
  sql(`INSERT INTO ingredientes (id, nombre, unidad, "stockActual", "stockMinimo", costo, activo, "createdAt", "updatedAt")
VALUES (${i[0]}, ${esc(i[1])}, ${esc(i[2])}, ${i[3]}, ${i[4]}, ${i[5]}, true, NOW(), NOW());`);
}
sql("SELECT setval('ingredientes_id_seq', (SELECT MAX(id) FROM ingredientes));");
sql('');

// ── 6. Productos ──
sql('-- Productos');
const productos = [
  // Hamburguesas (cat 1)
  [1, 'Hamburguesa Clasica', 'Carne, lechuga, tomate y mayonesa', 4500, 1, true],
  [2, 'Hamburguesa con Queso', 'Carne, cheddar, lechuga y tomate', 5000, 1, true],
  [3, 'Hamburguesa Bacon', 'Doble carne, bacon y cheddar', 6500, 1, false],
  // Pizzas (cat 2)
  [4, 'Pizza Mozzarella', 'Salsa de tomate y mozzarella', 5500, 2, true],
  [5, 'Pizza Napolitana', 'Tomate, mozzarella y ajo', 6000, 2, false],
  [6, 'Pizza Fugazzeta', 'Cebolla y mozzarella', 5800, 2, false],
  // Pastas (cat 3)
  [7, 'Fideos con Bolognesa', 'Fideos caseros con salsa bolognesa', 4800, 3, false],
  [8, 'Ravioles de Ricota', 'Con salsa filetto', 5200, 3, false],
  [9, 'Noquis de Papa', 'Con salsa de tomate casera', 4500, 3, false],
  // Bebidas (cat 4)
  [10, 'Coca-Cola 500ml', 'Gaseosa linea Coca-Cola', 1500, 4, false],
  [11, 'Agua Mineral 500ml', 'Agua sin gas', 1000, 4, false],
  [12, 'Cerveza Artesanal', 'Pinta IPA local', 2500, 4, false],
  // Postres (cat 5)
  [13, 'Helado 3 Gustos', 'Chocolate, dulce de leche, frutilla', 3000, 5, false],
  [14, 'Flan con Dulce de Leche', 'Flan casero', 2500, 5, false],
  [15, 'Cafe con Leche', 'Cafe de especialidad', 1800, 5, false],
];
for (const p of productos) {
  sql(`INSERT INTO productos (id, nombre, descripcion, precio, "categoriaId", disponible, destacado, "createdAt", "updatedAt")
VALUES (${p[0]}, ${esc(p[1])}, ${esc(p[2])}, ${p[3]}, ${p[4]}, true, ${p[5]}, NOW(), NOW());`);
}
sql("SELECT setval('productos_id_seq', (SELECT MAX(id) FROM productos));");
sql('');

// ── 7. ProductoIngrediente ──
sql('-- ProductoIngrediente');
const prodIngr = [
  // Hamburguesas
  [1, 1, 1], [1, 2, 1], [1, 5, 2], [1, 6, 2],
  [2, 1, 1], [2, 2, 1], [2, 3, 2], [2, 5, 1],
  [3, 1, 2], [3, 2, 1], [3, 3, 2], [3, 4, 3],
  // Pizzas
  [4, 7, 0.3], [4, 8, 0.25], [4, 9, 0.15],
  [5, 7, 0.3], [5, 8, 0.2], [5, 9, 0.2], [5, 6, 3],
  [6, 7, 0.3], [6, 8, 0.35],
  // Pastas
  [7, 10, 0.2], [7, 1, 0.5], [7, 9, 0.1],
  [8, 7, 0.15], [8, 9, 0.1],
  [9, 9, 0.15],
  // Bebidas
  [10, 11, 1], [11, 12, 1], [12, 13, 1],
  // Postres
  [13, 14, 0.15], [15, 15, 0.02],
];
let piId = 1;
for (const pi of prodIngr) {
  sql(`INSERT INTO producto_ingredientes (id, "productoId", "ingredienteId", cantidad)
VALUES (${piId++}, ${pi[0]}, ${pi[1]}, ${pi[2]});`);
}
sql(`SELECT setval('producto_ingredientes_id_seq', ${piId - 1});`);
sql('');

// ── 8. Modificadores ──
sql('-- Modificadores');
const modificadores = [
  [1, 'Sin lechuga', 0, 'EXCLUSION'],
  [2, 'Sin tomate', 0, 'EXCLUSION'],
  [3, 'Extra queso', 350, 'ADICION'],
  [4, 'Extra bacon', 500, 'ADICION'],
  [5, 'Doble carne', 1200, 'ADICION'],
  [6, 'Salsa especial', 200, 'ADICION'],
];
for (const m of modificadores) {
  sql(`INSERT INTO modificadores (id, nombre, precio, tipo, activo, "createdAt", "updatedAt")
VALUES (${m[0]}, ${esc(m[1])}, ${m[2]}, '${m[3]}', true, NOW(), NOW());`);
}
sql("SELECT setval('modificadores_id_seq', (SELECT MAX(id) FROM modificadores));");
sql('');

// ── 9. ProductoModificador (hamburguesas 1-3 get all modifiers) ──
sql('-- ProductoModificador');
let pmId = 1;
for (let prodId = 1; prodId <= 3; prodId++) {
  for (let modId = 1; modId <= 6; modId++) {
    sql(`INSERT INTO producto_modificadores (id, "productoId", "modificadorId")
VALUES (${pmId++}, ${prodId}, ${modId});`);
  }
}
sql(`SELECT setval('producto_modificadores_id_seq', ${pmId - 1});`);
sql('');

// ── 10. Configuracion ──
sql('-- Configuracion');
const configs = [
  ['tienda_abierta', 'true'],
  ['horario_apertura', '11:00'],
  ['horario_cierre', '23:00'],
  ['costo_delivery', '0'],
  ['delivery_habilitado', 'true'],
  ['efectivo_enabled', 'true'],
  ['mercadopago_enabled', 'false'],
  ['nombre_negocio', 'Comanda Demo'],
  ['tagline_negocio', 'Pedidos, caja y cocina en un solo lugar'],
  ['facturacion_habilitada', 'false'],
  ['facturacion_ambiente', 'homologacion'],
  ['facturacion_punto_venta', '1'],
  ['facturacion_cuit_emisor', ''],
  ['facturacion_descripcion', ''],
  ['facturacion_alicuota_iva', '21'],
  ['plano_paredes_Interior', JSON.stringify([
    { id: 'w_seed_1', x1: 16, y1: 16, x2: 560, y2: 16, grosor: 8 },
    { id: 'w_seed_2', x1: 16, y1: 16, x2: 16, y2: 400, grosor: 8 },
    { id: 'w_seed_3', x1: 560, y1: 16, x2: 560, y2: 400, grosor: 8 },
    { id: 'w_seed_4', x1: 16, y1: 400, x2: 560, y2: 400, grosor: 8 },
  ])],
  ['plano_paredes_Exterior', JSON.stringify([
    { id: 'w_seed_5', x1: 16, y1: 16, x2: 400, y2: 16, grosor: 8 },
    { id: 'w_seed_6', x1: 16, y1: 16, x2: 16, y2: 256, grosor: 8 },
  ])],
];
let cfgId = 1;
for (const c of configs) {
  sql(`INSERT INTO configuraciones (id, clave, valor, "updatedAt")
VALUES (${cfgId++}, ${esc(c[0])}, ${esc(c[1])}, NOW());`);
}
sql(`SELECT setval('configuraciones_id_seq', ${cfgId - 1});`);
sql('');

// ── 11. PuntoVentaFiscal ──
sql('-- PuntoVentaFiscal');
sql(`INSERT INTO puntos_venta_fiscales (id, "puntoVenta", descripcion, ambiente, activo, "createdAt", "updatedAt")
VALUES (1, 1, 'Punto de venta principal', 'homologacion', true, NOW(), NOW());`);
sql("SELECT setval('puntos_venta_fiscales_id_seq', 1);");
sql('');

// ══════════════════════════════════════════
// ── TRANSACTIONAL DATA ──
// ══════════════════════════════════════════

const workDays = getWorkDays(ONE_YEAR_AGO, TODAY);
const mozos = [2, 3]; // usuario IDs
const cajeroId = 5;
const cocineroId = 4;
const deliveryId = 6;
const employeesWithShifts = [2, 3, 4, 5]; // mozos, cocinero, cajero
const mesaIds = [1, 2, 3, 4, 5, 6];
const productoIds = productos.map(p => p[0]);
const productoPrecio = {};
productos.forEach(p => { productoPrecio[p[0]] = p[3]; });
const metodosPago = ['EFECTIVO', 'EFECTIVO', 'EFECTIVO', 'EFECTIVO', 'EFECTIVO', 'EFECTIVO',
                     'MERCADOPAGO', 'MERCADOPAGO', 'MERCADOPAGO', 'MERCADOPAGO', 'MERCADOPAGO'];
const clientesDelivery = [
  ['Carlos Ruiz', '1155559001', 'Av. Libertador 1234'],
  ['Ana Torres', '1155559002', 'Calle Rivadavia 567'],
  ['Lucas Fernandez', '1155559003', 'Av. Corrientes 890'],
  ['Sofia Mendez', '1155559004', 'Belgrano 234'],
  ['Martin Diaz', '1155559005', 'San Martin 456'],
];

let pedidoId = 1;
let pedidoItemId = 1;
let pagoId = 1;
let fichajeId = 1;
let cierreId = 1;
let reservaId = 1;
let movStockId = 1;
let auditoriaId = 1;

sql('-- ══ Pedidos, Items, Pagos, Fichajes, Cierres ══');

for (const day of workDays) {
  const dateStr = fmtDate(day);
  const numPedidos = randInt(8, 15);

  // Fichajes for this day
  for (const empId of employeesWithShifts) {
    const entrada = addHours(day, 10, 0);
    const salida = addHours(day, 18, 0);
    sql(`INSERT INTO fichajes (id, "usuarioId", entrada, salida, fecha, "createdAt")
VALUES (${fichajeId++}, ${empId}, '${fmt(entrada)}', '${fmt(salida)}', '${dateStr}', '${fmt(entrada)}');`);
  }

  let dayEfectivo = 0, dayMP = 0;

  for (let p = 0; p < numPedidos; p++) {
    const tipoRoll = rand();
    let tipo, mesaId = null, clienteNombre = null, clienteTel = null, clienteDir = null, tipoEntrega = null, costoEnvio = 0;
    let usuarioId;

    if (tipoRoll < 0.70) {
      tipo = 'MESA';
      mesaId = pick(mesaIds);
      usuarioId = pick(mozos);
    } else if (tipoRoll < 0.85) {
      tipo = 'MOSTRADOR';
      usuarioId = pick(mozos);
    } else {
      tipo = 'DELIVERY';
      const cli = pick(clientesDelivery);
      clienteNombre = cli[0];
      clienteTel = cli[1];
      clienteDir = cli[2];
      tipoEntrega = 'DELIVERY';
      costoEnvio = 500;
      usuarioId = deliveryId;
    }

    // Random time between 11:00 and 22:30
    const hora = randInt(11, 22);
    const minuto = randInt(0, 59);
    const pedidoTime = addHours(day, hora, minuto);

    // Items
    const numItems = randInt(2, 4);
    const itemProds = shuffle(productoIds).slice(0, numItems);
    let subtotal = 0;
    const itemsData = [];
    for (const prodId of itemProds) {
      const cant = randInt(1, 3);
      const precio = productoPrecio[prodId];
      const itemSub = precio * cant;
      subtotal += itemSub;
      itemsData.push({ prodId, cant, precio, itemSub });
    }
    const total = subtotal + costoEnvio;

    const isToday = fmtDate(day) === fmtDate(TODAY);
    const estado = isToday ? 'COBRADO' : 'CERRADO';
    const estadoPago = 'APROBADO';

    sql(`INSERT INTO pedidos (id, tipo, estado, "mesaId", "usuarioId", "clienteNombre", "clienteTelefono", "clienteDireccion", "tipoEntrega", "costoEnvio", subtotal, descuento, total, "estadoPago", origen, impreso, "createdAt", "updatedAt")
VALUES (${pedidoId}, '${tipo}', '${estado}', ${mesaId || 'NULL'}, ${usuarioId}, ${esc(clienteNombre)}, ${esc(clienteTel)}, ${esc(clienteDir)}, ${tipoEntrega ? `'${tipoEntrega}'` : 'NULL'}, ${costoEnvio}, ${subtotal}, 0, ${total}, '${estadoPago}', 'INTERNO', true, '${fmt(pedidoTime)}', '${fmt(pedidoTime)}');`);

    // Auditoria
    sql(`INSERT INTO pedido_auditorias (id, "pedidoId", "usuarioId", accion, "createdAt")
VALUES (${auditoriaId++}, ${pedidoId}, ${usuarioId}, 'CREAR', '${fmt(pedidoTime)}');`);

    for (const item of itemsData) {
      sql(`INSERT INTO pedido_items (id, "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
VALUES (${pedidoItemId++}, ${pedidoId}, ${item.prodId}, ${item.cant}, ${item.precio}, ${item.itemSub}, '${fmt(pedidoTime)}');`);
    }

    // Pago
    const metodo = pick(metodosPago);
    sql(`INSERT INTO pagos (id, "pedidoId", monto, metodo, "canalCobro", estado, "createdAt", "updatedAt")
VALUES (${pagoId++}, ${pedidoId}, ${total}, '${metodo}', 'CAJA', 'APROBADO', '${fmt(pedidoTime)}', '${fmt(pedidoTime)}');`);

    if (metodo === 'EFECTIVO') dayEfectivo += total;
    else dayMP += total;

    pedidoId++;
  }

  // CierreCaja
  const apertura = addHours(day, 10, 0);
  const cierre = addHours(day, 23, 0);
  sql(`INSERT INTO cierres_caja (id, "usuarioId", fecha, "horaApertura", "horaCierre", "fondoInicial", "totalEfectivo", "totalMP", "efectivoFisico", diferencia, estado, "createdAt", "updatedAt")
VALUES (${cierreId++}, ${cajeroId}, '${dateStr}', '${fmt(apertura)}', '${fmt(cierre)}', 5000, ${dayEfectivo}, ${dayMP}, ${dayEfectivo + 5000}, 0, 'CERRADO', '${fmt(cierre)}', '${fmt(cierre)}');`);

  // Reservas (~2 per week, so roughly every 3 working days)
  if (randInt(1, 3) === 1) {
    const resHora = randInt(19, 21);
    const resTime = addHours(day, resHora, 0);
    const estadosReserva = ['CONFIRMADA', 'CLIENTE_PRESENTE', 'CLIENTE_PRESENTE', 'NO_LLEGO'];
    const estRes = pick(estadosReserva);
    const nombresClientes = ['Roberto Sanchez', 'Laura Gimenez', 'Fernando Vega', 'Patricia Luna', 'Gustavo Rios'];
    sql(`INSERT INTO reservas (id, "mesaId", "clienteNombre", "clienteTelefono", "fechaHora", "cantidadPersonas", estado, "createdAt", "updatedAt")
VALUES (${reservaId++}, ${pick(mesaIds)}, ${esc(pick(nombresClientes))}, ${esc('11555' + randInt(10000, 99999))}, '${fmt(resTime)}', ${randInt(2, 6)}, '${estRes}', '${fmt(resTime)}', '${fmt(resTime)}');`);
  }
}

// Sequences for pedidos, items, pagos, etc.
sql('');
sql('-- Reset sequences');
sql(`SELECT setval('pedidos_id_seq', ${pedidoId - 1});`);
sql(`SELECT setval('pedido_items_id_seq', ${pedidoItemId - 1});`);
sql(`SELECT setval('pagos_id_seq', ${pagoId - 1});`);
sql(`SELECT setval('fichajes_id_seq', ${fichajeId - 1});`);
sql(`SELECT setval('cierres_caja_id_seq', ${cierreId - 1});`);
sql(`SELECT setval('reservas_id_seq', ${reservaId - 1});`);
sql(`SELECT setval('pedido_auditorias_id_seq', ${auditoriaId - 1});`);
sql('');

// ── Liquidaciones (monthly) ──
sql('-- Liquidaciones');
let liqId = 1;
const months = [];
const m = new Date(ONE_YEAR_AGO);
m.setDate(1);
while (m < TODAY) {
  const desde = new Date(m);
  const hasta = new Date(m.getFullYear(), m.getMonth() + 1, 0);
  if (hasta > TODAY) break; // don't generate current incomplete month
  months.push([new Date(desde), new Date(hasta)]);
  m.setMonth(m.getMonth() + 1);
}

for (const [desde, hasta] of months) {
  // Count work days in this month
  let workDaysInMonth = 0;
  const d = new Date(desde);
  while (d <= hasta) {
    if (isWorkDay(d)) workDaysInMonth++;
    d.setDate(d.getDate() + 1);
  }
  const horasTotal = workDaysInMonth * 8;

  for (const empId of employeesWithShifts) {
    const tarifa = empId === 4 ? 1800 : empId === 5 ? 1700 : 1500;
    const subtotal = horasTotal * tarifa;
    sql(`INSERT INTO liquidaciones (id, "usuarioId", "periodoDesde", "periodoHasta", "horasTotales", "tarifaHora", subtotal, descuentos, adicionales, "totalPagar", pagado, "createdAt")
VALUES (${liqId++}, ${empId}, '${fmtDate(desde)}', '${fmtDate(hasta)}', ${horasTotal}, ${tarifa}, ${subtotal}, 0, 0, ${subtotal}, true, '${fmt(hasta)}');`);
  }
}
sql(`SELECT setval('liquidaciones_id_seq', ${liqId - 1});`);
sql('');

sql('COMMIT;');

// ── Write output ──
const output = lines.join('\n') + '\n';
const outPath = path.join(__dirname, 'seed-data.sql');
fs.writeFileSync(outPath, output, 'utf8');

console.error(`Generated ${outPath}`);
console.error(`  Pedidos: ${pedidoId - 1}`);
console.error(`  PedidoItems: ${pedidoItemId - 1}`);
console.error(`  Pagos: ${pagoId - 1}`);
console.error(`  Fichajes: ${fichajeId - 1}`);
console.error(`  Cierres: ${cierreId - 1}`);
console.error(`  Reservas: ${reservaId - 1}`);
console.error(`  Liquidaciones: ${liqId - 1}`);
console.error(`  Work days: ${workDays.length}`);
