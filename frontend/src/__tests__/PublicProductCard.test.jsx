import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import PublicProductCard from '../components/public/PublicProductCard'

describe('PublicProductCard', () => {
  it('muestra la imagen base del producto', () => {
    render(
      <PublicProductCard
        product={{
          id: 1,
          nombre: 'Hamburguesa',
          descripcion: 'Clásica',
          precio: 1500,
          imagen: '/uploads/hamburguesa.png',
          variantes: []
        }}
        backendUrl="/api"
        onSelectVariant={vi.fn()}
        onAdd={vi.fn()}
      />
    )

    expect(screen.getByRole('img', { name: 'Hamburguesa' })).toHaveAttribute(
      'src',
      '/api/uploads/hamburguesa.png'
    )
  })

  it('muestra fallback cuando no hay imagen', () => {
    const { container } = render(
      <PublicProductCard
        product={{
          id: 2,
          nombre: 'Pizza',
          descripcion: 'Muzzarella',
          precio: 1200,
          variantes: []
        }}
        backendUrl="/api"
        onSelectVariant={vi.fn()}
        onAdd={vi.fn()}
      />
    )

    expect(screen.queryByRole('img', { name: 'Pizza' })).not.toBeInTheDocument()
    expect(container.querySelector('.public-product-card__image-fallback')).toBeInTheDocument()
    expect(container.querySelector('.public-product-card__media')).toHaveClass('is-fallback')
  })

  it('prioriza la imagen de la variante seleccionada sobre la del producto base', () => {
    render(
      <PublicProductCard
        product={{
          id: 3,
          nombre: 'Pizza',
          descripcion: 'Con variantes',
          precio: 1800,
          imagen: '/uploads/pizza-base.png',
          variantes: [
            {
              id: 31,
              nombreVariante: 'Grande',
              precio: 2200,
              imagen: '/uploads/pizza-grande.png',
              esVariantePredeterminada: true
            }
          ]
        }}
        backendUrl="/api"
        selectedVariantId={31}
        onSelectVariant={vi.fn()}
        onAdd={vi.fn()}
      />
    )

    expect(screen.getByRole('img', { name: 'Pizza' })).toHaveAttribute(
      'src',
      '/api/uploads/pizza-grande.png'
    )
  })
})
