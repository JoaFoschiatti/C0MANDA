import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

import api from '../../services/api'
import useAsync from '../../hooks/useAsync'
import usePedidoConModificadores from '../../hooks/usePedidoConModificadores'
import { SUCURSAL_IDS, SUCURSALES } from '../../constants/sucursales'
import { Button, Drawer, Spinner } from '../ui'
import PedidoSummaryPanel from './PedidoSummaryPanel'

const TIPO_META = {
  MESA: {
    icon: TableCellsIcon,
    label: 'Mesa',
  },
  DELIVERY: {
    icon: TruckIcon,
    label: 'Delivery',
  },
  MOSTRADOR: {
    icon: BuildingStorefrontIcon,
    label: 'Mostrador',
  },
}

const buildSearchIndex = (producto) =>
  `${producto.nombre || ''} ${producto.descripcion || ''}`.toLowerCase()

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`

const getDefaultSucursalId = (tipo) =>
  tipo === 'DELIVERY' ? SUCURSAL_IDS.DELIVERY : SUCURSAL_IDS.SALON

function PedidoTypeSwitcher({ availableTipos, tipo, onChange }) {
  return (
    <div className="inline-flex rounded-2xl border border-border-default bg-surface p-1 shadow-sm">
      {availableTipos.map((tipoOption) => {
        const meta = TIPO_META[tipoOption]
        const Icon = meta.icon
        const isActive = tipo === tipoOption

        return (
          <button
            key={tipoOption}
            type="button"
            onClick={() => onChange(tipoOption)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all',
              isActive
                ? 'bg-primary-500 text-primary-950 shadow-sm'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            )}
          >
            <Icon className="h-4 w-4" />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

function PedidoProductCard({ producto, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(producto)}
      disabled={!producto.disponible}
      className={clsx(
        'group flex h-full flex-col rounded-3xl border p-4 text-left transition-all',
        producto.disponible
          ? 'border-border-default bg-surface shadow-sm hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card'
          : 'cursor-not-allowed border-border-subtle bg-surface/75 opacity-55'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-tight text-text-primary">
          {producto.nombre}
        </h3>
        <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
          {formatCurrency(producto.precio)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">
        {producto.descripcion || 'Disponible para agregar al pedido.'}
      </p>

      <div className="mt-auto flex items-center justify-between pt-5">
        <span
          className={clsx(
            'text-xs font-medium',
            producto.disponible ? 'text-text-tertiary' : 'text-error-500'
          )}
        >
          {producto.disponible ? 'Tocar para agregar' : 'No disponible'}
        </span>
        <span
          className={clsx(
            'flex h-9 w-9 items-center justify-center rounded-full border transition-all',
            producto.disponible
              ? 'border-border-default bg-surface-hover text-primary-700 group-hover:border-primary-300 group-hover:bg-primary-50'
              : 'border-border-subtle bg-surface text-text-disabled'
          )}
        >
          <PlusIcon className="h-4 w-4" />
        </span>
      </div>
    </button>
  )
}

function PedidoModifiersDialog({
  agregarSinModificar,
  closeModModal,
  confirmarProductoConModificadores,
  modificadoresProducto,
  modificadoresSeleccionados,
  productoSeleccionado,
  toggleModificador,
}) {
  if (!productoSeleccionado) {
    return null
  }

  const costoSeleccionado = modificadoresSeleccionados
    .reduce((sum, mod) => sum + parseFloat(mod.precio), 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Personalizar producto
            </p>
            <h3 className="text-heading-3">{productoSeleccionado.nombre}</h3>
            <p className="font-semibold text-primary-700">
              {formatCurrency(productoSeleccionado.precio)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar modificadores"
            onClick={closeModModal}
            className="rounded-full p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-text-secondary">Elige extras o exclusiones para este producto.</p>

          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1 cart-scroll">
            {modificadoresProducto.map((mod) => {
              const selected = modificadoresSeleccionados.some((item) => item.id === mod.id)

              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggleModificador(mod)}
                  className={clsx(
                    'w-full rounded-2xl border p-3 text-left transition-colors',
                    selected
                      ? mod.tipo === 'EXCLUSION'
                        ? 'border-error-300 bg-error-50'
                        : 'border-success-300 bg-success-50'
                      : 'border-border-default bg-surface hover:border-border-strong'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p
                        className={clsx(
                          'font-medium',
                          selected
                            ? mod.tipo === 'EXCLUSION'
                              ? 'text-error-700'
                              : 'text-success-700'
                            : 'text-text-primary'
                        )}
                      >
                        {mod.tipo === 'EXCLUSION' ? `Sin ${mod.nombre}` : `Extra ${mod.nombre}`}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {mod.tipo === 'EXCLUSION'
                          ? 'Quita este ingrediente del producto.'
                          : 'Se suma al producto como adicional.'}
                      </p>
                    </div>

                    {parseFloat(mod.precio) > 0 && (
                      <span className="text-sm font-semibold text-primary-700">
                        +{formatCurrency(mod.precio)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="secondary" className="flex-1" onClick={agregarSinModificar}>
            Sin modificar
          </Button>
          <Button type="button" variant="primary" className="flex-1" onClick={confirmarProductoConModificadores}>
            Agregar{costoSeleccionado > 0 ? ` (+${formatCurrency(costoSeleccionado)})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function PedidoComposer({
  availableTipos,
  fixedMesaId = null,
  initialTipo,
  mode = 'create',
  existingPedidoId = null,
  onCancel,
  onSubmitSuccess,
  requireDeliveryCustomerName = false,
  showCustomerNameForTipos = [],
  showDeliveryContactFields = false,
  showGeneralObservaciones = true,
  showMesaSelector = false,
  showSucursalSelector = false,
  submitLabel,
  submittingLabel,
  successMessageBuilder,
  surface = 'page',
}) {
  const [categorias, setCategorias] = useState([])
  const [mesas, setMesas] = useState([])
  const [mesaContexto, setMesaContexto] = useState(null)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState(fixedMesaId ? 'MESA' : initialTipo)
  const [mesaId, setMesaId] = useState('')
  const [sucursalId, setSucursalId] = useState(String(getDefaultSucursalId(initialTipo)))
  const [clienteData, setClienteData] = useState({ nombre: '', telefono: '', direccion: '' })
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [showCartDrawer, setShowCartDrawer] = useState(false)
  const [expandedItemNotes, setExpandedItemNotes] = useState({})
  const {
    carrito,
    showModModal,
    productoSeleccionado,
    modificadoresProducto,
    modificadoresSeleccionados,
    handleClickProducto,
    toggleModificador,
    confirmarProductoConModificadores,
    agregarAlCarrito,
    actualizarCantidad,
    eliminarDelCarrito,
    actualizarObservacionItem,
    closeModModal,
  } = usePedidoConModificadores({
    onItemAdded: (producto) => toast.success(`${producto.nombre} agregado`),
  })

  const cargarDatos = useCallback(async () => {
    const requests = [api.get('/categorias/publicas', { skipToast: true })]

    if (showMesaSelector) {
      requests.push(api.get('/mesas', { skipToast: true }))
    } else {
      requests.push(Promise.resolve({ data: [] }))
    }

    if (fixedMesaId) {
      requests.push(api.get(`/mesas/${fixedMesaId}`, { skipToast: true }))
    } else {
      requests.push(Promise.resolve({ data: null }))
    }

    const [categoriasResponse, mesasResponse, mesaResponse] = await Promise.all(requests)

    setCategorias(categoriasResponse.data)
    setCategoriaActiva((current) => {
      if (!categoriasResponse.data.length) {
        return null
      }

      return categoriasResponse.data.some((categoria) => categoria.id === current)
        ? current
        : categoriasResponse.data[0].id
    })

    if (showMesaSelector) {
      setMesas(
        mesasResponse.data.filter(
          (mesa) => mesa.activa !== false && (mesa.estado === 'LIBRE' || mesa.estado === 'OCUPADA')
        )
      )
    }

    if (mesaResponse.data) {
      setMesaContexto(mesaResponse.data)
    }

    return {
      categorias: categoriasResponse.data,
      mesas: mesasResponse.data,
      mesa: mesaResponse.data,
    }
  }, [fixedMesaId, showMesaSelector])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    toast.error(error.response?.data?.error?.message || 'Error al cargar datos')
  }, [])

  const cargarDatosRequest = useCallback(async (_ctx) => cargarDatos(), [cargarDatos])

  const { loading } = useAsync(cargarDatosRequest, { onError: handleLoadError })

  useEffect(() => {
    if (carrito.length === 0 && showCartDrawer) {
      setShowCartDrawer(false)
    }
  }, [carrito.length, showCartDrawer])

  const totalItems = useMemo(
    () => carrito.reduce((sum, item) => sum + item.cantidad, 0),
    [carrito]
  )

  const total = useMemo(
    () => carrito.reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0),
    [carrito]
  )

  const mesaSeleccionada = useMemo(
    () => mesas.find((mesa) => String(mesa.id) === mesaId) || null,
    [mesaId, mesas]
  )

  const showCustomerName = showCustomerNameForTipos.includes(tipo)

  const productosFiltrados = useMemo(() => {
    const categoriasBase = busqueda.trim()
      ? categorias.flatMap((categoria) => categoria.productos || [])
      : categorias.find((categoria) => categoria.id === categoriaActiva)?.productos || []

    const query = busqueda.trim().toLowerCase()
    if (!query) {
      return categoriasBase
    }

    return categoriasBase.filter((producto) => buildSearchIndex(producto).includes(query))
  }, [busqueda, categoriaActiva, categorias])

  const effectiveMesaId = fixedMesaId
    ? Number.parseInt(String(fixedMesaId), 10)
    : mesaId
      ? Number.parseInt(mesaId, 10)
      : null
  const isAppendMode = mode === 'append' &&
    existingPedidoId !== null &&
    existingPedidoId !== undefined &&
    Number.isInteger(Number(existingPedidoId))

  const formatContextBadge = useCallback((currentTipo) => {
    if (currentTipo === 'MESA') {
      const numeroMesa = mesaContexto?.numero ?? mesaSeleccionada?.numero ?? effectiveMesaId
      return numeroMesa ? `Mesa ${numeroMesa}` : 'Mesa'
    }

    if (currentTipo === 'DELIVERY') {
      return 'Delivery'
    }

    return 'Mostrador'
  }, [effectiveMesaId, mesaContexto?.numero, mesaSeleccionada?.numero])

  const handleTipoChange = useCallback((nextTipo) => {
    setTipo(nextTipo)

    if (nextTipo !== 'MESA') {
      setMesaId('')
      if (showSucursalSelector) {
        setSucursalId(String(getDefaultSucursalId(nextTipo)))
      }
    }
  }, [showSucursalSelector])

  const handleClienteDataChange = useCallback((field, value) => {
    setClienteData((current) => ({
      ...current,
      [field]: value,
    }))
  }, [])

  const toggleItemNote = useCallback((itemId) => {
    setExpandedItemNotes((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }))
  }, [])

  const submitPedido = useCallback(async () => {
    if (carrito.length === 0) {
      toast.error('Agrega productos al pedido')
      return
    }

    if (tipo === 'MESA' && !effectiveMesaId) {
      toast.error('Selecciona una mesa')
      return
    }

    if (tipo === 'DELIVERY' && requireDeliveryCustomerName && !clienteData.nombre.trim()) {
      toast.error('Ingresa el nombre del cliente')
      return
    }

    setEnviando(true)
    try {
      const itemsPayload = carrito.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        observaciones: item.observaciones || undefined,
        modificadores: item.modificadores.map((modificador) => modificador.id),
      }))

      const response = isAppendMode
        ? await api.post(`/pedidos/${existingPedidoId}/items`, {
          items: itemsPayload,
        }, { skipToast: true })
        : await api.post('/pedidos', {
          tipo,
          mesaId: tipo === 'MESA' ? effectiveMesaId : null,
          items: itemsPayload,
          observaciones: observaciones || undefined,
          ...(showSucursalSelector && tipo !== 'MESA'
            ? { sucursalId: Number.parseInt(sucursalId, 10) }
            : {}),
          ...(showCustomerName && clienteData.nombre.trim()
            ? { clienteNombre: clienteData.nombre.trim() }
            : {}),
          ...(showDeliveryContactFields && tipo === 'DELIVERY'
            ? {
                clienteTelefono: clienteData.telefono || undefined,
                clienteDireccion: clienteData.direccion || undefined,
              }
            : {}),
        }, { skipToast: true })

      const pedidoResponse = isAppendMode ? (response.data?.pedido || null) : response.data
      toast.success(
        successMessageBuilder
          ? successMessageBuilder(pedidoResponse, {
            tipo,
            mode,
            ronda: response.data?.ronda || null,
          })
          : isAppendMode
            ? `Se agrego consumo al pedido #${pedidoResponse?.id}!`
            : `Pedido #${pedidoResponse?.id} creado!`
      )
      onSubmitSuccess?.(pedidoResponse, {
        tipo,
        mode,
        pedidoId: isAppendMode ? Number(existingPedidoId) : pedidoResponse?.id,
        ronda: response.data?.ronda || null,
        impresion: response.data?.impresion || null,
      })
    } catch (error) {
      console.error('Error:', error)
      toast.error(
        error.response?.data?.error?.message ||
        (isAppendMode ? 'Error al agregar consumo' : 'Error al crear pedido')
      )
    } finally {
      setEnviando(false)
    }
  }, [
    carrito,
    clienteData.direccion,
    clienteData.nombre,
    clienteData.telefono,
    effectiveMesaId,
    existingPedidoId,
    isAppendMode,
    mode,
    observaciones,
    onSubmitSuccess,
    requireDeliveryCustomerName,
    showCustomerName,
    showDeliveryContactFields,
    showSucursalSelector,
    sucursalId,
    successMessageBuilder,
    tipo,
  ])

  const contextTitle = fixedMesaId
    ? `Mesa ${mesaContexto?.numero ?? fixedMesaId}`
    : 'Pedido manual'

  const renderSummary = (
    <PedidoSummaryPanel
      carrito={carrito}
      clienteData={clienteData}
      expandedItemNotes={expandedItemNotes}
      formatContextBadge={formatContextBadge}
      onCancel={onCancel}
      onClienteDataChange={handleClienteDataChange}
      onEliminarItem={eliminarDelCarrito}
      onSubmit={submitPedido}
      onToggleItemNote={toggleItemNote}
      onUpdateItemNote={actualizarObservacionItem}
      onUpdateQty={actualizarCantidad}
      observaciones={observaciones}
      setObservaciones={setObservaciones}
      showCustomerName={showCustomerName}
      showDeliveryContactFields={showDeliveryContactFields && tipo === 'DELIVERY'}
      showGeneralObservaciones={showGeneralObservaciones}
      submitLabel={submitLabel}
      submittingLabel={submittingLabel}
      submitting={enviando}
      tipo={tipo}
      total={total}
      totalItems={totalItems}
    />
  )

  if (loading && categorias.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <div
        className={clsx(
          'flex min-h-0 flex-1 flex-col',
          surface === 'page' && 'pb-[calc(6.75rem+env(safe-area-inset-bottom))] lg:pb-0'
        )}
      >
        <div
          className={clsx(
            'grid min-h-0 flex-1 gap-5',
            surface === 'page'
              ? 'lg:grid-cols-[minmax(0,1fr)_24rem]'
              : 'xl:grid-cols-[minmax(0,1fr)_24rem]'
          )}
        >
          <section className="flex min-h-0 flex-col rounded-[2rem] border border-primary-100 bg-primary-50/70 p-4 shadow-sm sm:p-5">
            <div className="sticky top-0 z-10 -mx-2 mb-4 space-y-4 bg-primary-50/95 px-2 pb-3 backdrop-blur">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {fixedMesaId ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-primary-200 bg-surface px-4 py-2 shadow-sm">
                        <TableCellsIcon className="h-4 w-4 text-primary-600" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                            Contexto
                          </p>
                          <p className="text-sm font-semibold text-text-primary">{contextTitle}</p>
                        </div>
                      </div>
                    ) : (
                      <PedidoTypeSwitcher
                        availableTipos={availableTipos}
                        tipo={tipo}
                        onChange={handleTipoChange}
                      />
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {showMesaSelector && tipo === 'MESA' && (
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                          Mesa
                        </span>
                        <select
                          className="input"
                          value={mesaId}
                          onChange={(event) => setMesaId(event.target.value)}
                        >
                          <option value="">Seleccionar mesa...</option>
                          {mesas.map((mesa) => (
                            <option key={mesa.id} value={mesa.id}>
                              Mesa {mesa.numero} {mesa.zona ? `(${mesa.zona})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {showSucursalSelector && tipo !== 'MESA' && (
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                          Sucursal
                        </span>
                        <select
                          className="input"
                          value={sucursalId}
                          onChange={(event) => setSucursalId(event.target.value)}
                        >
                          {SUCURSALES.map((sucursal) => (
                            <option key={sucursal.id} value={sucursal.id}>
                              {sucursal.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {showCustomerName && !showDeliveryContactFields && (
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                          Cliente
                        </span>
                        <input
                          type="text"
                          className="input"
                          placeholder="Nombre del cliente"
                          value={clienteData.nombre}
                          onChange={(event) => handleClienteDataChange('nombre', event.target.value)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <label className="block xl:w-80">
                  <span className="sr-only">Buscar productos</span>
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      className="input input-with-icon"
                      placeholder="Buscar productos"
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="inline-flex gap-2">
                  {categorias.map((categoria) => (
                    <button
                      key={categoria.id}
                      type="button"
                      onClick={() => setCategoriaActiva(categoria.id)}
                      className={clsx(
                        'rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all',
                        categoriaActiva === categoria.id && !busqueda
                          ? 'border-transparent bg-primary-600 text-white shadow-sm'
                          : 'border-border-default bg-surface text-text-secondary hover:border-primary-200 hover:text-text-primary'
                      )}
                    >
                      {categoria.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {busqueda ? `Resultados para "${busqueda}"` : 'Catalogo de productos'}
                </p>
                <p className="text-xs text-text-tertiary">
                  {busqueda
                    ? 'La busqueda se aplica por nombre y descripcion.'
                    : 'Toca una card para agregar el producto al pedido.'}
                </p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm">
                {productosFiltrados.length} producto{productosFiltrados.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 cart-scroll">
              {productosFiltrados.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[1.75rem] border border-dashed border-border-default bg-surface px-6 py-12 text-center">
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-text-primary">No encontramos productos</p>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      Ajusta la busqueda o cambia de categoria para seguir agregando items.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {productosFiltrados.map((producto) => (
                    <PedidoProductCard
                      key={`${producto.id}-${producto.nombre}`}
                      producto={producto}
                      onClick={handleClickProducto}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className={clsx(surface === 'page' ? 'hidden lg:block' : 'block')}>
            {renderSummary}
          </aside>
        </div>
      </div>

      {surface === 'page' && totalItems > 0 && (
        <button
          type="button"
          onClick={() => setShowCartDrawer(true)}
          className="floating-cart-btn lg:hidden"
          data-testid="pedido-composer-cart-toggle"
        >
          <ShoppingCartIcon className="h-5 w-5" />
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.18em]">Pedido</span>
            <span className="text-sm font-semibold">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </span>
          </div>
          <span className="ml-auto text-base font-semibold">{formatCurrency(total)}</span>
        </button>
      )}

      {surface === 'page' && (
        <Drawer
          open={showCartDrawer}
          onClose={() => setShowCartDrawer(false)}
          title="Pedido actual"
          placement="bottom"
        >
          {renderSummary}
        </Drawer>
      )}

      {showModModal && (
        <PedidoModifiersDialog
          agregarSinModificar={() => {
            agregarAlCarrito(productoSeleccionado, [])
            closeModModal()
          }}
          closeModModal={closeModModal}
          confirmarProductoConModificadores={confirmarProductoConModificadores}
          modificadoresProducto={modificadoresProducto}
          modificadoresSeleccionados={modificadoresSeleccionados}
          productoSeleccionado={productoSeleccionado}
          toggleModificador={toggleModificador}
        />
      )}
    </>
  )
}
