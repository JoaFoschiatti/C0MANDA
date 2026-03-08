export default function TaskSummaryCards({ cards }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="task-summary-card card flex items-center gap-3">
          <div className={`rounded-xl p-2.5 ${card.accent}`}>
            <card.icon className="h-6 w-6" />
          </div>
          <div>
            <p className="stat-label">{card.label}</p>
            <p className="stat-value">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
