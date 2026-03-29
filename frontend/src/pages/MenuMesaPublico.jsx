import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircleIcon, QrCodeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'

import PublicCategoryTabs from '../components/public/PublicCategoryTabs'
import {
  PublicErrorState,
  PublicLoadingState
} from '../components/public/PublicOrderState'
import PublicProductCard from '../components/public/PublicProductCard'
import { Alert, Button, Card, Drawer, EmptyState, Input, Textarea } from '../components/ui'
import { fetchJson, PUBLIC_API_URL, PUBLIC_BACKEND_URL } from '../utils/public-fetch'

const PUBLIC_API_BASE = `${PUBLIC_API_URL}/publico`

function getSelectedVariant(product, selectedVariantId) {
  if (!product.variantes?.length) {
    return null
  }

  return product.variantes.find((variant) => variant.id === selectedVariantId)
    || product.variantes.find((variant) => variant.esVariantePredeterminada)
    || product.variantes[0]
}

function normalizeCartProduct(product, selectedVariantId) {
  const selectedVariant = getSelectedVariant(product, selectedVariantId)
  const source = selectedVariant || product

  return {
    id: source.id,
    nombre: selectedVariant ? `${product.nombre} ${selectedVariant.nombreVariante}` : product.nombre,
    precio: source.precio
  }
}

function MesaOrderPanel({
  carrito,
  clienteNombre,
  observaciones,
  onActualizarCantidad,
  onClienteNombreChange,
  onObservacionesChange,
  onEnviarPedido,
  submitting,
  total,
  totalItems
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-heading-3">Enviar a mesa</h2>
          <span className="badge badge-info">
            {totalItems} item{totalItems === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-body-sm">
          El pedido entra directo a operacion. El cobro se resuelve despues desde caja o QR presencial.
        </p>
      </div>

      <div className="rounded-2xl border border-border-default bg-canvas-subtle p-4 space-y-3">
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Productos</span>
          <span>{carrito.length}</span>
        </div>
        <div className="flex items-center justify-between text-base font-semibold text-text-primary">
          <span>Total</span>
          <span>${total.toLocaleString('es-AR')}</span>
        </div>
      </div>

      <Input
        label="Nombre"
        value={clienteNombre}
        onChange={(event) => onClienteNombreChange(event.target.value)}
        placeholder="Como te identificamos en la mesa"
      />

      <Textarea
        label="Observaciones"
        rows={3}
        value={observaciones}
        onChange={(event) => onObservacionesChange(event.target.value)}
        placeholder="Notas para cocina o servicio"
      />

      <div className="space-y-3">
        {carrito.length === 0 ? (
          <EmptyState
            title="Sin productos"
            description="Agrega productos para enviar el pedido."
            className="py-6"
          />
        ) : (
          carrito.map((item) => (
            <div key={item.id} className="public-cart-line">
              <div>
                <p className="font-medium text-text-primary">{item.nombre}</p>
                <p className="text-xs text-text-tertiary">
                  ${Number(item.precio || 0).toLocaleString('es-AR')} c/u
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => onActualizarCantidad(item.id, -1)}>
                  -
                </Button>
                <span className="w-6 text-center">{item.cantidad}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => onActualizarCantidad(item.id, 1)}>
                  +
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button
        type="button"
        className="w-full"
        loading={submitting}
        disabled={carrito.length === 0}
        onClick={onEnviarPedido}
      >
        Enviar a mesa
      </Button>
    </div>
  )
}

export default function MenuMesaPublico() {
  const { qrToken } = useParams()

  const [config, setConfig] = useState(null)
  const [mesa, setMesa] = useState(null)
  const [mesaSession, setMesaSession] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('all')
  const [variantesSeleccionadas, setVariantesSeleccionadas] = useState({})
  const [carrito, setCarrito] = useState([])
  const [showResumenPedido, setShowResumenPedido] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const cargarMesa = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchJson(
        `${PUBLIC_API_BASE}/mesa/${encodeURIComponent(qrToken)}`,
        {},
        'Error al cargar la mesa'
      )

      setMesa(data.mesa)
      setMesaSession(data.mesaSession || null)
      setConfig({ ...data.negocio, ...data.config })
      setCategorias(data.categorias)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [qrToken])

  useEffect(() => {
    cargarMesa().catch(() => {})
  }, [cargarMesa])

  const productosFiltrados = useMemo(() => {
    if (categoriaActiva === 'all') {
      return categorias.flatMap((categoria) => categoria.productos || [])
    }

    return categorias.find((categoria) => categoria.id === categoriaActiva)?.productos || []
  }, [categoriaActiva, categorias])

  const total = carrito.reduce((sum, item) => sum + Number(item.precio || 0) * item.cantidad, 0)
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  const seleccionarVariante = useCallback((productoId, varianteId) => {
    setVariantesSeleccionadas((current) => ({
      ...current,
      [productoId]: varianteId
    }))
  }, [])

  const agregarAlCarrito = useCallback((producto) => {
    const normalizedProduct = normalizeCartProduct(producto, variantesSeleccionadas[producto.id])

    setCarrito((current) => {
      const existingItem = current.find((item) => item.id === normalizedProduct.id)
      if (existingItem) {
        return current.map((item) => (
          item.id === normalizedProduct.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        ))
      }

      return [...current, { ...normalizedProduct, cantidad: 1 }]
    })
  }, [variantesSeleccionadas])

  const actualizarCantidad = useCallback((productoId, delta) => {
    setCarrito((current) => current
      .map((item) => (
        item.id === productoId
          ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
          : item
      ))
      .filter((item) => item.cantidad > 0))
  }, [])

  const enviarPedido = useCallback(async () => {
    if (!mesaSession?.token) {
      setError('La sesion del QR expiro. Vuelve a cargar la mesa.')
      return false
    }

    if (!clienteNombre.trim()) {
      setError('Ingresa tu nombre para identificar el pedido')
      return false
    }

    if (carrito.length === 0) {
      setError('Agrega al menos un producto')
      return false
    }

    setSubmitting(true)
    setError(null)

    try {
      const data = await fetchJson(
        `${PUBLIC_API_BASE}/mesa/${encodeURIComponent(qrToken)}/pedido`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: mesaSession.token,
            clienteNombre,
            observaciones,
            items: carrito.map((item) => ({
              productoId: item.id,
              cantidad: item.cantidad
            }))
          })
        },
        'Error al enviar el pedido'
      )

      setSuccess(data.pedido)
      setCarrito([])
      setObservaciones('')
      return true
    } catch (submitError) {
      setError(submitError.message)
      return false
    } finally {
      setSubmitting(false)
    }
  }, [carrito, clienteNombre, mesaSession?.token, observaciones, qrToken])

  if (loading) {
    return <PublicLoadingState label="Cargando menu de mesa..." />
  }

  if (error && !config) {
    return (
      <PublicErrorState
        title="No pudimos cargar la mesa"
        message={error}
        actionLabel="Reintentar"
        onAction={() => cargarMesa().catch(() => {})}
      />
    )
  }

  return (
    <div className="public-page">
      <div className="public-page__content pt-8">
        <Card className="public-table-hero">
          <div className="public-table-hero__icon">
            <QrCodeIcon className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <p className="text-label">Pedido desde QR</p>
            <h1 className="text-heading-2">
              {config?.nombre_negocio || config?.nombre || 'Pedido a mesa'}
            </h1>
            <p className="text-body-sm">
              Mesa {mesa?.numero}{mesa?.zona ? ` - ${mesa.zona}` : ''}
            </p>
          </div>
        </Card>

        {success && (
          <Alert variant="success" className="mt-6">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              <span>Pedido #{success.id} enviado correctamente a la mesa.</span>
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] items-start">
          <main className="space-y-5">
            <PublicCategoryTabs
              categories={categorias}
              activeCategory={categoriaActiva}
              onSelectCategory={setCategoriaActiva}
            />

            {productosFiltrados.length === 0 ? (
              <Card>
                <EmptyState
                  title="No hay productos disponibles"
                  description="La carta de esta mesa esta vacia por el momento."
                />
              </Card>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {productosFiltrados.map((producto) => (
                  <PublicProductCard
                    key={producto.id}
                    product={producto}
                    backendUrl={PUBLIC_BACKEND_URL}
                    selectedVariantId={variantesSeleccionadas[producto.id]}
                    onSelectVariant={seleccionarVariante}
                    onAdd={agregarAlCarrito}
                  />
                ))}
              </div>
            )}
          </main>

          <aside className="hidden lg:block lg:sticky lg:top-24">
            <Card>
              <MesaOrderPanel
                carrito={carrito}
                clienteNombre={clienteNombre}
                observaciones={observaciones}
                onActualizarCantidad={actualizarCantidad}
                onClienteNombreChange={setClienteNombre}
                onObservacionesChange={setObservaciones}
                onEnviarPedido={enviarPedido}
                submitting={submitting}
                total={total}
                totalItems={totalItems}
              />
            </Card>
          </aside>
        </div>
      </div>

      {carrito.length > 0 && (
        <button
          type="button"
          onClick={() => setShowResumenPedido(true)}
          className="floating-cart-btn lg:hidden"
        >
          <ShoppingCartIcon className="w-5 h-5" />
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.18em]">Mesa {mesa?.numero}</span>
            <span className="text-sm font-semibold">{totalItems} item{totalItems === 1 ? '' : 's'}</span>
          </div>
          <span className="ml-auto text-base font-semibold">
            ${total.toLocaleString('es-AR')}
          </span>
        </button>
      )}

      <Drawer
        open={showResumenPedido}
        onClose={() => setShowResumenPedido(false)}
        title="Enviar a mesa"
        placement="bottom"
      >
        <MesaOrderPanel
          carrito={carrito}
          clienteNombre={clienteNombre}
          observaciones={observaciones}
          onActualizarCantidad={actualizarCantidad}
          onClienteNombreChange={setClienteNombre}
          onObservacionesChange={setObservaciones}
          onEnviarPedido={async () => {
            const enviado = await enviarPedido()
            if (enviado) {
              setShowResumenPedido(false)
            }
          }}
          submitting={submitting}
          total={total}
          totalItems={totalItems}
        />
      </Drawer>
    </div>
  )
}
