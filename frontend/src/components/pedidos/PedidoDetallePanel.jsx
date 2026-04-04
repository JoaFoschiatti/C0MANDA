import toast from 'react-hot-toast'
import api from '../../services/api'
import { estadoBadges, calcularPendientePedido, FLOAT_EPSILON } from '../../hooks/usePedidosPage'

export default function PedidoDetallePanel({
  pedidoSeleccionado,
  esSoloMozo,
  puedeFacturar,
  puedeCerrarPedido,
  puedeLiberarMesa,
  setShowModal,
  verDetalle,
  cambiarEstado,
  cerrarPedido,
  liberarMesa,
  abrirFacturacion,
  abrirCambiarMesa,
  setDescuentoForm,
  setShowDescuentoModal,
  cargarPedidosAsync
}) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-heading-3">Pedido #{pedidoSeleccionado.id}</h2>
          <span className={`badge ${estadoBadges[pedidoSeleccionado.estado]}`}>
            {pedidoSeleccionado.estado.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1">
          <div className="text-sm text-text-secondary">
            <p><strong className="text-text-primary">Tipo:</strong> {pedidoSeleccionado.tipo}</p>
            <p><strong className="text-text-primary">Sucursal:</strong> {pedidoSeleccionado.sucursal?.nombre || '-'}</p>
            {pedidoSeleccionado.mesa && (
              <p>
                <strong className="text-text-primary">Mesa:</strong> {pedidoSeleccionado.mesa.numero}
                {pedidoSeleccionado.tipo === 'MESA' && !['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
                  <button onClick={abrirCambiarMesa} className="ml-2 text-xs text-primary-600 hover:text-primary-700 underline">Cambiar mesa</button>
                )}
              </p>
            )}
            {pedidoSeleccionado.clienteNombre && <p><strong className="text-text-primary">Cliente:</strong> {pedidoSeleccionado.clienteNombre}</p>}
            <p><strong className="text-text-primary">Mozo:</strong> {pedidoSeleccionado.usuario?.nombre}</p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-2">
              {pedidoSeleccionado.rondas?.length ? 'Rondas' : 'Items'}
            </h3>
            {pedidoSeleccionado.rondas?.length ? (
              <div className="space-y-3">
                {pedidoSeleccionado.rondas.map((ronda) => (
                  <div key={ronda.id} className="rounded-2xl border border-border-default bg-surface-hover p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text-primary">Ronda {ronda.numero}</p>
                      <p className="text-xs text-text-tertiary">
                        {new Date(ronda.createdAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {ronda.items?.map((item) => (
                        <div key={item.id} className="rounded-xl bg-surface px-3 py-2">
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-text-primary">
                              {item.cantidad}x {item.producto?.nombre}
                              {item.observaciones && (
                                <span className="ml-1 text-text-tertiary">({item.observaciones})</span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 text-text-primary">
                              ${parseFloat(item.subtotal).toLocaleString('es-AR')}
                              {!ronda.enviadaCocinaAt && !['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
                                <button
                                  onClick={() => {
                                    if (confirm('Anular este item?')) {
                                      api.post(`/pedidos/${pedidoSeleccionado.id}/items/${item.id}/anular`, {})
                                        .then(() => {
                                          toast.success('Item anulado')
                                          verDetalle(pedidoSeleccionado.id)
                                          cargarPedidosAsync().catch(() => {})
                                        })
                                        .catch((err) => console.error('Error al anular:', err))
                                    }
                                  }}
                                  className="text-error-500 hover:text-error-700 text-xs font-bold leading-none"
                                  title="Anular item"
                                >
                                  X
                                </button>
                              )}
                            </span>
                          </div>
                          {item.modificadores?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.modificadores.map((modificador) => (
                                <span
                                  key={modificador.id}
                                  className="rounded-full bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700"
                                >
                                  {modificador.modificador?.tipo === 'EXCLUSION' ? 'Sin' : 'Extra'} {modificador.modificador?.nombre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {pedidoSeleccionado.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-text-primary">
                      {item.cantidad}x {item.producto?.nombre}
                      {item.observaciones && <span className="text-text-tertiary ml-1">({item.observaciones})</span>}
                    </span>
                    <span className="text-text-primary">${parseFloat(item.subtotal).toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border-default pt-3 space-y-1">
            {(parseFloat(pedidoSeleccionado.descuento) > 0 || parseFloat(pedidoSeleccionado.costoEnvio) > 0) && (
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Subtotal:</span>
                <span>${parseFloat(pedidoSeleccionado.subtotal).toLocaleString('es-AR')}</span>
              </div>
            )}
            {parseFloat(pedidoSeleccionado.descuento) > 0 && (
              <div className="flex justify-between text-sm text-success-600">
                <span>Descuento:</span>
                <span>-${parseFloat(pedidoSeleccionado.descuento).toLocaleString('es-AR')}</span>
              </div>
            )}
            {parseFloat(pedidoSeleccionado.costoEnvio) > 0 && (
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Costo envio:</span>
                <span>${parseFloat(pedidoSeleccionado.costoEnvio).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-text-primary">
              <span>Total:</span>
              <span>${parseFloat(pedidoSeleccionado.total).toLocaleString('es-AR')}</span>
            </div>
            {!['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && !esSoloMozo && (
              <button
                onClick={() => {
                  setDescuentoForm({
                    descuento: parseFloat(pedidoSeleccionado.descuento) > 0 ? String(parseFloat(pedidoSeleccionado.descuento)) : '',
                    motivo: ''
                  })
                  setShowDescuentoModal(true)
                }}
                className="text-xs text-primary-600 hover:text-primary-700 underline"
              >
                {parseFloat(pedidoSeleccionado.descuento) > 0 ? 'Modificar descuento' : 'Aplicar descuento'}
              </button>
            )}
          </div>

          {/* Cambiar estado */}
          {!['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
            <div className="border-t border-border-default pt-3">
              <p className="text-sm font-medium text-text-primary mb-2">Cambiar estado:</p>
              <div className="flex flex-wrap gap-2">
                {!esSoloMozo && pedidoSeleccionado.estado === 'PENDIENTE' && (
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'EN_PREPARACION')}
                    className="btn btn-primary text-sm"
                  >
                    Iniciar preparacion
                  </button>
                )}
                {!esSoloMozo && pedidoSeleccionado.estado === 'EN_PREPARACION' && (
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'LISTO')}
                    className="btn btn-success text-sm"
                  >
                    Marcar listo
                  </button>
                )}
                {pedidoSeleccionado.estado === 'LISTO' && (
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'ENTREGADO')}
                    className="btn btn-primary text-sm"
                  >
                    Marcar entregado
                  </button>
                )}
              </div>
            </div>
          )}

          {['ENTREGADO', 'COBRADO'].includes(pedidoSeleccionado.estado) &&
            calcularPendientePedido(pedidoSeleccionado) <= FLOAT_EPSILON && (
            <div className="border-t border-border-default pt-3 flex flex-wrap gap-2">
              {puedeCerrarPedido && (
                <button
                  onClick={() => cerrarPedido(pedidoSeleccionado)}
                  className="btn btn-primary text-sm"
                >
                  Cerrar pedido
                </button>
              )}
              {pedidoSeleccionado.estado === 'COBRADO' && !pedidoSeleccionado.comprobanteFiscal && puedeFacturar && (
                <button
                  onClick={() => abrirFacturacion(pedidoSeleccionado)}
                  className="btn btn-secondary text-sm"
                >
                  Facturar
                </button>
              )}
            </div>
          )}

          {pedidoSeleccionado.estado === 'CERRADO' && !pedidoSeleccionado.comprobanteFiscal && puedeFacturar && (
            <div className="border-t border-border-default pt-3">
              <button
                onClick={() => abrirFacturacion(pedidoSeleccionado)}
                className="btn btn-secondary text-sm"
              >
                Facturar
              </button>
            </div>
          )}

          {pedidoSeleccionado.estado === 'CERRADO' && pedidoSeleccionado.mesaId && puedeLiberarMesa && (
            <div className="border-t border-border-default pt-3">
              <button
                onClick={() => liberarMesa(pedidoSeleccionado.mesaId)}
                className="btn btn-success text-sm"
              >
                Liberar mesa
              </button>
            </div>
          )}
        </div>

        <button onClick={() => setShowModal(false)} className="btn btn-secondary w-full mt-6">
          Cerrar
        </button>
      </div>
    </div>
  )
}
