const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
  ensureNegocio,
  cleanupOperationalData
} = require('./helpers/test-helpers');

describe('Publico Endpoints', () => {
  beforeEach(async () => {
    await cleanupOperationalData();
    await ensureNegocio();
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('GET /api/publico/config devuelve defaults y datos del negocio', async () => {
    await prisma.negocio.update({
      where: { id: 1 },
      data: {
        nombre: 'Comanda Test',
        telefono: '3415550000',
        direccion: 'Calle Falsa 123'
      }
    });

    const response = await request(app)
      .get('/api/publico/config')
      .expect(200);

    expect(response.body.negocio).toEqual(expect.objectContaining({
      nombre: 'Comanda Test',
      telefono: '3415550000',
      direccion: 'Calle Falsa 123'
    }));
    expect(response.body.config.tienda_abierta).toBe(true);
    expect(response.body.config.efectivo_enabled).toBe(true);
    expect(response.body.config.mercadopago_enabled).toBe(false);
  });

  it('GET /api/publico/menu filtra categorias y productos y expone variantes', async () => {
    const categoriaActiva = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('activa')}`,
        orden: 1,
        activa: true
      }
    });

    const categoriaInactiva = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('inactiva')}`,
        orden: 2,
        activa: false
      }
    });

    const productoBase = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoriaActiva.id,
        disponible: true
      }
    });

    const productoNoDisponible = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('nodisp')}`,
        precio: 50,
        categoriaId: categoriaActiva.id,
        disponible: false
      }
    });

    const varianteDisponible = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('var')}`,
        nombreVariante: 'Doble',
        precio: 150,
        categoriaId: categoriaActiva.id,
        disponible: true,
        productoBaseId: productoBase.id,
        ordenVariante: 1
      }
    });

    await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('var-no')}`,
        nombreVariante: 'Triple',
        precio: 200,
        categoriaId: categoriaActiva.id,
        disponible: false,
        productoBaseId: productoBase.id,
        ordenVariante: 2
      }
    });

    await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('cat-inactiva')}`,
        precio: 10,
        categoriaId: categoriaInactiva.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get('/api/publico/menu')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    const categoria = response.body.find((item) => item.id === categoriaActiva.id);
    expect(categoria).toBeDefined();
    expect(response.body.some((item) => item.id === categoriaInactiva.id)).toBe(false);

    const idsProductos = categoria.productos.map((producto) => producto.id);
    expect(idsProductos).toContain(productoBase.id);
    expect(idsProductos).not.toContain(productoNoDisponible.id);
    expect(idsProductos).not.toContain(varianteDisponible.id);

    const baseEnRespuesta = categoria.productos.find((producto) => producto.id === productoBase.id);
    const idsVariantes = baseEnRespuesta.variantes.map((variante) => variante.id);
    expect(idsVariantes).toContain(varianteDisponible.id);
  });

  it('POST /api/publico/pedido crea pedido y permite items duplicados', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('pedido')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('pedido')}`,
        precio: 123,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [
          { productoId: producto.id, cantidad: 1 },
          { productoId: producto.id, cantidad: 2 }
        ],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'EFECTIVO'
      })
      .expect(201);

    expect(response.body.message).toBe('Pedido creado correctamente');
    expect(response.body.initPoint).toBeNull();
    expect(response.body.pedido.origen).toBe('MENU_PUBLICO');
    expect(response.body.pedido.items).toHaveLength(2);
    expect(response.body.pedido.clienteNombre).toBe('Cliente Test');
  });

  it('POST /api/publico/pedido rechaza delivery si esta deshabilitado', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('delivery')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('delivery')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.configuracion.create({
      data: {
        clave: 'delivery_habilitado',
        valor: 'false'
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        clienteDireccion: 'Calle 123',
        tipoEntrega: 'DELIVERY',
        metodoPago: 'EFECTIVO'
      })
      .expect(400);

    expect(response.body.error.message).toBe('El delivery no esta disponible en este momento');
  });

  it('POST /api/publico/pedido rechaza efectivo si esta deshabilitado', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('efectivo')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('efectivo')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.configuracion.create({
      data: {
        clave: 'efectivo_enabled',
        valor: 'false'
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'EFECTIVO'
      })
      .expect(400);

    expect(response.body.error.message).toBe('El pago en efectivo no esta disponible en este momento');
  });
});
