import TaskCard from './TaskCard'

export default function TaskSection({
  title,
  description,
  tasks,
  esAdmin,
  processingTaskId,
  onCerrarPedido,
  onLiberarMesa,
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-heading-3">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>

      {tasks.length === 0 ? (
        <div className="card py-5">
          <p className="text-sm text-text-secondary">No hay tareas pendientes en esta cola.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              esAdmin={esAdmin}
              processingTaskId={processingTaskId}
              onCerrarPedido={onCerrarPedido}
              onLiberarMesa={onLiberarMesa}
            />
          ))}
        </div>
      )}
    </section>
  )
}
