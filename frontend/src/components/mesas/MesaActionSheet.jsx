import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  DocumentTextIcon,
  EyeIcon,
  ClockIcon,
  BanknotesIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

import api from '../../services/api'
import { Drawer, Button } from '../ui'
import { getMesaStatusUi } from '../../utils/mesa-status-ui'

export default function MesaActionSheet({ mesa, open, onClose, onRefresh }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [transferConfig, setTransferConfig] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api.get('/pagos/mercadopago/transferencia-config', { skipToast: true })
      .then((res) => { if (!cancelled) setTransferConfig(res.data) })
      .catch(() => { /* ignore — transfer info is optional */ })
    return () => { cancelled = true }
  }, [open])

  if (!mesa) return null

  const statusUi = getMesaStatusUi(mesa.estado)

  const handlePedirCuenta = async () => {
    setLoading(true)
    try {
      await api.post(`/mesas/${mesa.id}/precuenta`, {}, { skipToast: true })
      toast.success(`Precuenta solicitada — Mesa ${mesa.numero}`)
      onRefresh?.()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al solicitar precuenta')
    } finally {
      setLoading(false)
    }
  }

  const handleVerPedido = () => {
    onClose()
    navigate(`/pedidos?mesaId=${mesa.id}`)
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Mesa ${mesa.numero}`}
      placement="bottom"
    >
      <div className="space-y-4">
        {/* Status info */}
        <div className={statusUi.themeClass}>
          <div className="flex items-center gap-3">
            <span className="mesa-status-pill">{statusUi.label}</span>
            {mesa.pedidos?.[0] && (
              <span className="text-sm text-text-secondary">
                Pedido #{mesa.pedidos[0].id}
              </span>
            )}
          </div>
        </div>

        {/* Actions per state */}
        {mesa.estado === 'OCUPADA' && (
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={handlePedirCuenta}
              loading={loading}
              icon={DocumentTextIcon}
            >
              Pedir cuenta
            </Button>
            {mesa.pedidos?.[0] && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleVerPedido}
                icon={EyeIcon}
              >
                Ver pedido
              </Button>
            )}
          </div>
        )}

        {mesa.estado === 'ESPERANDO_CUENTA' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-hover rounded-lg px-3 py-2">
              <ClockIcon className="w-5 h-5 text-warning-500 shrink-0" />
              <span>La cuenta ya fue solicitada</span>
            </div>
            {transferConfig?.alias && (
              <div className="rounded-lg border border-border-default bg-surface p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-2">
                  <BanknotesIcon className="w-4 h-4" />
                  <span>Datos de transferencia</span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => {
                    navigator.clipboard?.writeText(transferConfig.alias)
                    toast.success('Alias copiado')
                  }}
                >
                  <span className="text-sm font-semibold text-text-primary">{transferConfig.alias}</span>
                  <ClipboardDocumentIcon className="w-4 h-4 text-text-tertiary shrink-0" />
                </button>
                {transferConfig.titular && (
                  <p className="text-xs text-text-secondary mt-1">{transferConfig.titular}</p>
                )}
              </div>
            )}
            {mesa.pedidos?.[0] && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleVerPedido}
                icon={EyeIcon}
              >
                Ver pedido
              </Button>
            )}
          </div>
        )}

        {mesa.estado === 'CERRADA' && mesa.pedidos?.[0] && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleVerPedido}
            icon={EyeIcon}
          >
            Ver pedido
          </Button>
        )}
      </div>
    </Drawer>
  )
}
