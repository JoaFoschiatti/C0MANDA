const fs = require('fs');
const path = require('path');
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

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const pngMinimal = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bf0a0000000049454e44ae426082',
  'hex'
);

const deleteUploadedFile = (url) => {
  if (!url) {
    return;
  }

  const filename = String(url).replace('/uploads/', '');
  const filePath = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

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

  it('POST /api/productos sube imagen y la devuelve en la respuesta', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-image')}`, orden: 1, activa: true }
    });

    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', authHeader(token))
      .field('nombre', `Prod-${uniqueId('prod-image')}`)
      .field('descripcion', 'Producto con imagen')
      .field('precio', '123')
      .field('categoriaId', String(categoria.id))
      .field('disponible', 'true')
      .field('destacado', 'false')
      .attach('imagen', pngMinimal, { filename: 'producto.png', contentType: 'image/png' })
      .expect(201);

    expect(response.body.imagen).toMatch(/^\/uploads\/producto-/);
    expect(response.body.categoriaId).toBe(categoria.id);

    const filename = response.body.imagen.replace('/uploads/', '');
    const filePath = path.join(UPLOADS_DIR, filename);

    expect(fs.existsSync(filePath)).toBe(true);
    deleteUploadedFile(response.body.imagen);
  });

  it('POST /api/productos rechaza archivos no imagen', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-invalid')}`, orden: 1, activa: true }
    });

    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', authHeader(token))
      .field('nombre', `Prod-${uniqueId('prod-invalid')}`)
      .field('descripcion', 'Producto invalido')
      .field('precio', '123')
      .field('categoriaId', String(categoria.id))
      .field('disponible', 'true')
      .field('destacado', 'false')
      .attach('imagen', Buffer.from('hola'), { filename: 'producto.txt', contentType: 'text/plain' })
      .expect(400);

    expect(response.body.error.message).toMatch(/Solo se permiten/i);
  });

  it('GET /api/productos lista productos disponibles con imagen', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-list')}`, orden: 1, activa: true }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod-list')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true,
        imagen: '/uploads/prod-list.png'
      }
    });

    const response = await request(app)
      .get('/api/productos')
      .set('Authorization', authHeader(token))
      .expect(200);

    const encontrado = response.body.find((item) => item.id === producto.id);
    expect(encontrado).toEqual(expect.objectContaining({
      id: producto.id,
      imagen: '/uploads/prod-list.png'
    }));
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
        disponible: true,
        imagen: '/uploads/base-variante.png'
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
    expect(baseEnRespuesta.imagen).toBe('/uploads/base-variante.png');
    expect(baseEnRespuesta.variantes[0].imagen).toBe('/uploads/base-variante.png');
    expect(baseEnRespuesta.variantes.some((variante) => variante.id === response.body.id)).toBe(true);
  });

  it('PUT /api/productos/:id reemplaza la imagen al actualizar', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-update')}`, orden: 1, activa: true }
    });

    const createResponse = await request(app)
      .post('/api/productos')
      .set('Authorization', authHeader(token))
      .field('nombre', `Prod-${uniqueId('prod-update')}`)
      .field('descripcion', 'Producto original')
      .field('precio', '100')
      .field('categoriaId', String(categoria.id))
      .field('disponible', 'true')
      .field('destacado', 'false')
      .attach('imagen', pngMinimal, { filename: 'producto-original.png', contentType: 'image/png' })
      .expect(201);

    const firstImageUrl = createResponse.body.imagen;

    const updateResponse = await request(app)
      .put(`/api/productos/${createResponse.body.id}`)
      .set('Authorization', authHeader(token))
      .field('nombre', `Prod-${uniqueId('prod-update')}-editado`)
      .field('descripcion', 'Producto actualizado')
      .field('precio', '150')
      .field('categoriaId', String(categoria.id))
      .field('disponible', 'true')
      .field('destacado', 'true')
      .attach('imagen', pngMinimal, { filename: 'producto-nuevo.png', contentType: 'image/png' })
      .expect(200);

    expect(updateResponse.body.imagen).toMatch(/^\/uploads\/producto-/);
    expect(updateResponse.body.imagen).not.toBe(firstImageUrl);

    deleteUploadedFile(firstImageUrl);
    deleteUploadedFile(updateResponse.body.imagen);
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
