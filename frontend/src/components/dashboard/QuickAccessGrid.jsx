import { Link } from 'react-router-dom'

export default function QuickAccessGrid({ links }) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-heading-3">Accesos Rapidos</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {links.map((item) => (
          <Link key={item.label} to={item.to} className="quick-link-card card card-hover">
            <item.icon className="h-6 w-6 shrink-0 text-primary-500" />
            <div className="min-w-0">
              <p className="font-medium text-text-primary">{item.label}</p>
              <p className="mt-1 text-xs text-text-tertiary">Abrir modulo</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
