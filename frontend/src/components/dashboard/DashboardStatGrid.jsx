import { Link } from 'react-router-dom'

export default function DashboardStatGrid({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Card = stat.link ? Link : 'div'

        return (
          <Card
            key={stat.name}
            to={stat.link}
            className={`stat-card card-hover flex min-h-[5.8rem] items-center gap-3 ${stat.link ? 'cursor-pointer' : ''}`}
          >
            <div
              className={`rounded-xl p-2.5 ${
                stat.isWarning ? 'bg-warning-100' : stat.highlight ? 'bg-primary-100' : 'bg-primary-50'
              }`}
            >
              <stat.icon className={`h-5 w-5 ${stat.isWarning ? 'text-warning-600' : 'text-primary-500'}`} />
            </div>
            <div className="min-w-0">
              <p className="stat-label">{stat.name}</p>
              <p className="stat-value">{stat.value}</p>
              {stat.link && (
                <p className="mt-1 text-xs font-medium text-primary-700">
                  Abrir modulo
                </p>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
