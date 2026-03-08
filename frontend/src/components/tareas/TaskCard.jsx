import { Link } from 'react-router-dom'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

import { Badge, Button } from '../ui'
import { getTaskLink } from './task-links'

const PRIORIDAD_VARIANTS = {
  ALTA: 'error',
  MEDIA: 'warning',
  BAJA: 'info',
}

const formatFecha = (value) =>
  value
    ? new Date(value).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sin fecha'

export default function TaskCard({
  task,
  esAdmin,
  processingTaskId,
  onCerrarPedido,
  onLiberarMesa,
}) {
  const link = getTaskLink(task, esAdmin)
  const isProcessing = processingTaskId === task.id

  return (
    <div className="task-card card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PRIORIDAD_VARIANTS[task.prioridad] || 'default'}>
              {task.prioridad}
            </Badge>
            <Badge variant={task.categoria === 'CAJA' ? 'info' : 'warning'}>
              {task.categoria === 'CAJA' ? 'Caja' : 'Stock'}
            </Badge>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary sm:text-base">{task.titulo}</h3>
            <p className="mt-1 text-sm text-text-secondary">{task.descripcion}</p>
          </div>
        </div>
        <span className="whitespace-nowrap text-xs text-text-tertiary">
          {formatFecha(task.fechaReferencia)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {task.tipo === 'PEDIDO_COBRADO_PENDIENTE_CIERRE' && (
          <Button
            type="button"
            size="sm"
            variant="success"
            icon={CheckCircleIcon}
            loading={isProcessing}
            onClick={() => onCerrarPedido(task)}
          >
            Cerrar pedido
          </Button>
        )}

        {task.tipo === 'MESA_CERRADA_PENDIENTE_LIBERACION' && (
          <Button
            type="button"
            size="sm"
            variant="success"
            icon={CheckCircleIcon}
            loading={isProcessing}
            onClick={() => onLiberarMesa(task)}
          >
            Liberar mesa
          </Button>
        )}

        {link && (
          <Link to={link} className="btn btn-outline btn-sm">
            Abrir
          </Link>
        )}

        {!link && task.categoria === 'STOCK' && !esAdmin && (
          <button type="button" className="btn btn-outline btn-sm" disabled>
            Requiere ADMIN
          </button>
        )}
      </div>
    </div>
  )
}
