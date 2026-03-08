import { CubeIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

function getDisplayedVariant(product, selectedVariantId) {
  if (!product.variantes?.length) {
    return null
  }

  return product.variantes.find((variant) => variant.id === selectedVariantId)
    || product.variantes.find((variant) => variant.esVariantePredeterminada)
    || product.variantes[0]
}

export default function PublicProductCard({
  product,
  backendUrl,
  selectedVariantId,
  onSelectVariant,
  onAdd
}) {
  const selectedVariant = getDisplayedVariant(product, selectedVariantId)
  const displayPrice = Number(selectedVariant?.precio ?? product.precio ?? 0)
  const imageUrl = product.imagen
    ? (product.imagen.startsWith('http') ? product.imagen : `${backendUrl}${product.imagen}`)
    : null

  return (
    <article className="public-product-card">
      <div className={clsx('public-product-card__media', !imageUrl && 'is-fallback')}>
        {imageUrl ? (
          <img src={imageUrl} alt={product.nombre} className="public-product-card__image" />
        ) : (
          <div className="public-product-card__image-fallback">
            <CubeIcon className="w-14 h-14" />
          </div>
        )}
      </div>

      <div className="public-product-card__body">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="public-product-card__title">{product.nombre}</h3>
              <p className="public-product-card__description">
                {product.descripcion || 'Disponible para pedir ahora.'}
              </p>
            </div>
            <div className="public-product-card__price">
              ${displayPrice.toLocaleString('es-AR')}
            </div>
          </div>

          {product.variantes?.length > 0 && (
            <div className="public-variant-list">
              {product.variantes.map((variant) => {
                const selected = selectedVariant?.id === variant.id
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => onSelectVariant(product.id, variant.id)}
                    className={clsx('public-variant-pill', selected && 'is-active')}
                  >
                    <span>{variant.nombreVariante}</span>
                    <span>${Number(variant.precio || 0).toLocaleString('es-AR')}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button type="button" className="btn btn-primary" onClick={() => onAdd(product)}>
          <PlusIcon className="w-4 h-4" />
          Agregar
        </button>
      </div>
    </article>
  )
}
