const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
    createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

describe('Productos Endpoints', () => {
    let token;

  beforeAll(async () => {
        await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/productos crea producto con ingredientes', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 100,
        stockMinimo: 10,
        costo: 1
      }
    });

    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', authHeader(token))
      .send({
        nombre: `Prod-${uniqueId('prod')}`,
        descripcion: 'Producto test',
        precio: 123,
        categoriaId: categoria.id,
        disponible: true,
        destacado: false,
        ingredientes: [{ ingredienteId: ingrediente.id, cantidad: 2 }]
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.categoriaId).toBe(categoria.id);
    expect(response.body.categoria?.id).toBe(categoria.id);
    expect(response.body.ingredientes).toHaveLength(1);
    expect(response.body.ingredientes[0].ingredienteId).toBe(ingrediente.id);
  });

  it('GET /api/productos lista productos disponibles', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-list')}`, orden: 1, activa: true }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod-list')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get('/api/productos')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.map((item) => item.id);
    expect(ids).toContain(producto.id);
  });

  it('POST /api/productos/:id/variantes crea una variante y copia ingredientes', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-var')}`, orden: 1, activa: true }
    });
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing-var')}`,
        unidad: 'u',
        stockActual: 100,
        stockMinimo: 10,
        costo: 1
      }
    });

    const productoBase = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: productoBase.id,
        ingredienteId: ingrediente.id,
        cantidad: 1
      }
    });

    const response = await request(app)
      .post(`/api/productos/${productoBase.id}/variantes`)
      .set('Authorization', authHeader(token))
      .send({
        nombreVariante: 'Doble',
        precio: 150,
        multiplicadorInsumos: 2,
        ordenVariante: 1,
        esVariantePredeterminada: true
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.productoBaseId).toBe(productoBase.id);
    expect(response.body.ingredientes).toHaveLength(1);
    expect(response.body.ingredientes[0].ingredienteId).toBe(ingrediente.id);

    const listado = await request(app)
      .get('/api/productos/con-variantes')
      .set('Authorization', authHeader(token))
      .expect(200);

    const baseEnRespuesta = listado.body.find((producto) => producto.id === productoBase.id);
    expect(baseEnRespuesta).toBeDefined();
    expect(baseEnRespuesta.variantes.some((variante) => variante.id === response.body.id)).toBe(true);
  });

  it('GET /api/productos/:id devuelve el producto solicitado', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-id')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('single')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get(`/api/productos/${producto.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.id).toBe(producto.id);
  });

  it('POST /api/productos/agrupar-variantes rechaza ids inexistentes', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-group')}`, orden: 1, activa: true }
    });

    const productoBase = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base-group')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post('/api/productos/agrupar-variantes')
      .set('Authorization', authHeader(token))
      .send({
        productoBaseId: productoBase.id,
        variantes: [
          {
            productoId: 999999,
            nombreVariante: 'Otro',
            ordenVariante: 1
          }
        ]
      })
      .expect(400);

    expect(response.body.error.message).toMatch(/Productos no validos|Productos no válidos/);
  });
});
