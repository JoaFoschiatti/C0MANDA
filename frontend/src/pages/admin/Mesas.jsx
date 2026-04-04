import clsx from 'clsx'
import {
  DndContext,
  DragOverlay,
} from '@dnd-kit/core'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MapIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'

import { EmptyState, PageHeader, Button, Spinner, Modal } from '../../components/ui'
import MesaOperationCard from '../../components/mesas/MesaOperationCard'
import MesaStatusLegend from '../../components/mesas/MesaStatusLegend'
import ShortcutsHelp from '../../components/ui/ShortcutsHelp'
import MesaChip from '../../components/plano/MesaChip'
import ZonaDroppable from '../../components/plano/ZonaDroppable'
import useMesasPage, { getMesaSecondaryText } from '../../hooks/useMesasPage'

export default function Mesas() {
  const {
    esAdmin,
    zonaRef,
    mesas,
    loading,
    mesasActivas,
    mesasSinPosicionar,
    mesasZonaActiva,
    mesasOcupadas,
    mesasEsperandoCuenta,
    mesasPorZona,
    grupoColores,
    mesaEnfocadaId,
    tab,
    setTab,
    showModal,
    editando,
    form,
    setForm,
    abrirModalNuevaMesa,
    cerrarModal,
    handleSubmit,
    handleEdit,
    handleDelete,
    mesaPendienteDesactivacion,
    cerrarConfirmacionDesactivar,
    confirmarDesactivarMesa,
    paredes,
    zonaActiva,
    setZonaActiva,
    modoDibujo,
    setModoDibujo,
    activeMesa,
    posicionesModificadas,
    saving,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleRotar,
    handleQuitar,
    handleAgregarPared,
    handleEliminarPared,
    handleGuardarPosiciones,
    seleccionGrupo,
    setSeleccionGrupo,
    toggleSeleccionGrupo,
    handleAgrupar,
    handleDesagrupar,
    handlePedirCuenta,
    handleLiberarMesa,
    handleMesaClick,
    getReservaProxima,
    formatHora,
    shortcutsList,
    showShortcutsHelp,
    setShowShortcutsHelp,
  } = useMesasPage()

  if (loading && mesas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Mesas"
        eyebrow="Salon"
        description="Operacion del salon, plano interactivo y agrupacion de mesas."
        actions={
          <div className="flex items-center gap-2">
            {tab === 'plano' && posicionesModificadas && (
              <Button variant="primary" onClick={handleGuardarPosiciones} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Posiciones'}
              </Button>
            )}
            {tab === 'plano' && esAdmin && (
              <div className="flex gap-1 p-1 bg-surface-hover rounded-lg">
                <button
                  type="button"
                  onClick={() => setModoDibujo('mesas')}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${modoDibujo === 'mesas'
                      ? 'bg-surface shadow-sm text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                    }
                  `}
                >
                  Mover Mesas
                </button>
                <button
                  type="button"
                  onClick={() => setModoDibujo('paredes')}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${modoDibujo === 'paredes'
                      ? 'bg-surface shadow-sm text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                    }
                  `}
                >
                  Dibujar Paredes
                </button>
              </div>
            )}
            {esAdmin && (
              <Button icon={PlusIcon} onClick={abrirModalNuevaMesa}>
                Nueva Mesa
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="stat-card">
          <p className="stat-label">Mesas activas</p>
          <p className="stat-value">{mesasActivas.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Ocupadas</p>
          <p className="stat-value">{mesasOcupadas}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Esperando cuenta</p>
          <p className="stat-value">{mesasEsperandoCuenta}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border-default">
        <button
          type="button"
          onClick={() => setTab('operacion')}
          className={`tab ${tab === 'operacion' ? 'active' : ''}`}
        >
          <ViewColumnsIcon className="w-4 h-4" />
          Operacion
        </button>
        <button
          type="button"
          onClick={() => setTab('plano')}
          className={`tab ${tab === 'plano' ? 'active' : ''}`}
        >
          <MapIcon className="w-4 h-4" />
          Plano
        </button>
      </div>

      {tab === 'operacion' && (
        <div>
          <MesaStatusLegend className="mb-5" />

          {seleccionGrupo.length > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
              <span className="text-sm text-text-secondary">
                {seleccionGrupo.length} mesas seleccionadas
              </span>
              <Button size="sm" onClick={handleAgrupar}>
                Agrupar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSeleccionGrupo([])}>
                Cancelar
              </Button>
            </div>
          )}

          {mesasActivas.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No hay mesas configuradas"
                description="Crea la primera mesa para habilitar operacion y plano."
                actionLabel="Crear primera mesa"
                onAction={abrirModalNuevaMesa}
              />
            </div>
          ) : (
            Object.entries(mesasPorZona).map(([zona, mesasZona]) => (
              <div key={zona} className="mb-8">
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-heading-3 text-text-secondary">{zona}</h2>
                    <p className="text-body-sm">
                      {mesasZona.length} mesa{mesasZona.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {mesasZona.map((mesa) => {
                    const reservaProxima = getReservaProxima(mesa.id)
                    const isSelected = seleccionGrupo.includes(mesa.id)
                    const secondaryText = getMesaSecondaryText(mesa, reservaProxima, formatHora)
                    const showPrimaryAction = ['OCUPADA', 'CERRADA'].includes(mesa.estado)
                    const showAdminActions = esAdmin
                    const overlay = (showPrimaryAction || showAdminActions) ? (
                      <div className="mesa-status-card-actions">
                        {mesa.estado === 'OCUPADA' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handlePedirCuenta(mesa)
                            }}
                            className="mesa-status-primary-action"
                            title="Solicitar cuenta"
                            aria-label={`Solicitar cuenta de la mesa ${mesa.numero}`}
                          >
                            Cuenta
                          </button>
                        )}

                        {mesa.estado === 'CERRADA' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleLiberarMesa(mesa)
                            }}
                            className="mesa-status-primary-action"
                            title="Liberar mesa"
                            aria-label={`Liberar mesa ${mesa.numero}`}
                          >
                            Liberar mesa
                          </button>
                        )}

                        {mesa.grupoMesaId && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDesagrupar(mesa.grupoMesaId)
                            }}
                            aria-label={`Desagrupar mesa ${mesa.numero}`}
                            title="Desagrupar"
                            className="mesa-status-overlay__ghost-action mesa-status-overlay__ghost-action--danger"
                          >
                            Desagrupar
                          </button>
                        )}

                        {showAdminActions && (
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEdit(mesa)
                              }}
                              aria-label={`Editar mesa ${mesa.numero}`}
                              title="Editar"
                              className="mesa-status-action"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleSeleccionGrupo(mesa.id)
                              }}
                              aria-label={`Seleccionar mesa ${mesa.numero} para agrupar`}
                              title="Seleccionar para agrupar"
                              className={clsx(
                                'mesa-status-action',
                                isSelected && 'border-primary-300 bg-primary-50 text-primary-700'
                              )}
                            >
                              <ViewColumnsIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDelete(mesa)
                              }}
                              aria-label={`Desactivar mesa ${mesa.numero}`}
                              title="Desactivar"
                              className="mesa-status-action mesa-status-action--danger"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null

                    return (
                      <MesaOperationCard
                        key={mesa.id}
                        mesa={mesa}
                        secondaryText={secondaryText}
                        reservaTooltip={reservaProxima
                          ? `Reserva a las ${formatHora(reservaProxima.fechaHora)} - ${reservaProxima.clienteNombre}`
                          : null}
                        overlay={overlay}
                        className={clsx(
                          'transition-all',
                          !mesa.activa && 'opacity-50',
                          isSelected && 'mesa-status-card--selected',
                          mesa.id === mesaEnfocadaId && 'mesa-status-card--focused',
                          grupoColores[mesa.grupoMesaId] && `ring-2 ring-offset-1 ${grupoColores[mesa.grupoMesaId]}`
                        )}
                        forceOverlayVisible={isSelected || mesa.id === mesaEnfocadaId}
                        onClick={() => handleMesaClick(mesa)}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'plano' && (
        <div className="space-y-4">
          {/* Tabs de zonas */}
          <div className="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit">
            {['Interior', 'Exterior'].map(zona => (
              <button
                key={zona}
                type="button"
                onClick={() => setZonaActiva(zona)}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all
                  ${zonaActiva === zona
                    ? 'bg-surface shadow-sm text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                {zona}
                <span className="ml-2 text-xs opacity-60">
                  ({mesasActivas.filter(m => m.zona === zona && m.posX != null).length})
                </span>
              </button>
            ))}
          </div>

          {modoDibujo === 'paredes' && (
            <p className="text-xs text-text-tertiary">
              Click para iniciar una pared, click de nuevo para terminarla. Click derecho o Esc para cancelar. Shift para lineas rectas.
            </p>
          )}

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Mesas sin posicionar */}
            {mesasSinPosicionar.length > 0 && esAdmin && (
              <div className="card p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  Mesas sin posicionar ({mesasSinPosicionar.length})
                </h3>
                <div className="flex flex-wrap gap-4">
                  {mesasSinPosicionar.map(mesa => (
                    <MesaChip
                      key={mesa.id}
                      mesa={mesa}
                      showActions
                      onEditar={handleEdit}
                      enGrupo={mesa.grupoMesaId != null}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Zona activa */}
            <ZonaDroppable
              ref={zonaRef}
              zona={zonaActiva}
              mesas={mesasZonaActiva}
              disabled={!esAdmin}
              onRotar={handleRotar}
              onQuitar={handleQuitar}
              onEditar={handleEdit}
              paredes={paredes[zonaActiva] || []}
              modoPlano={modoDibujo}
              onAgregarPared={handleAgregarPared}
              onEliminarPared={handleEliminarPared}
            />

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
              {activeMesa ? (
                <MesaChip mesa={activeMesa} isDragging disabled enGrupo={activeMesa.grupoMesaId != null} />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="font-medium">Estado:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success-100 border border-success-300" />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-error-100 border border-error-300" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-100 border border-amber-400" />
              <span>Esperando Cuenta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning-100 border border-warning-300" />
              <span>Reservada</span>
            </div>
            <span className="mx-2 text-border-default">|</span>
            <span className="font-medium">Forma:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-surface border border-border-default" />
              <span>4 personas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-3 rounded bg-surface border border-border-default" />
              <span>6+ personas</span>
            </div>
          </div>
        </div>
      )}

      <ShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        shortcuts={shortcutsList}
        pageName="Mesas"
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">{editando ? 'Editar Mesa' : 'Nueva Mesa'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="mesa-numero">
                  Numero de Mesa
                </label>
                <input
                  id="mesa-numero"
                  type="number"
                  className="input"
                  value={form.numero}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      numero: value === '' ? '' : parseInt(value, 10),
                    }))
                  }}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="mesa-zona">
                  Zona
                </label>
                <select
                  id="mesa-zona"
                  className="input"
                  value={form.zona}
                  onChange={(event) => setForm((prev) => ({ ...prev, zona: event.target.value }))}
                >
                  <option value="Interior">Interior</option>
                  <option value="Exterior">Exterior</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="mesa-capacidad">
                  Capacidad
                </label>
                <input
                  id="mesa-capacidad"
                  type="number"
                  className="input"
                  value={form.capacidad}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      capacidad: value === '' ? '' : parseInt(value, 10),
                    }))
                  }}
                  min="1"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={cerrarModal} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(mesaPendienteDesactivacion)}
        onClose={cerrarConfirmacionDesactivar}
        title="Desactivar mesa"
        size="sm"
        footer={(
          <>
            <Button type="button" variant="secondary" className="flex-1" onClick={cerrarConfirmacionDesactivar}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" className="flex-1" onClick={confirmarDesactivarMesa}>
              Desactivar
            </Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            La mesa {mesaPendienteDesactivacion?.numero} dejara de mostrarse en operacion y en el plano.
          </p>
          <p>
            Puedes desactivarla si ya no se usa en el salon.
          </p>
        </div>
      </Modal>
    </div>
  )
}
