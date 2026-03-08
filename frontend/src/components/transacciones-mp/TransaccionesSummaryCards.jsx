import {
  BanknotesIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline'

const cards = [
  {
    key: 'bruto',
    label: 'Total Bruto',
    icon: BanknotesIcon,
    accent: 'bg-info-500',
  },
  {
    key: 'comisiones',
    label: 'Comisiones MP',
    icon: ReceiptPercentIcon,
    accent: 'bg-error-500',
  },
  {
    key: 'neto',
    label: 'Neto Recibido',
    icon: CurrencyDollarIcon,
    accent: 'bg-success-500',
  },
  {
    key: 'cantidadAprobadas',
    label: 'Tx Aprobadas',
    icon: CheckCircleIcon,
    accent: 'bg-primary-500',
  },
]

export default function TransaccionesSummaryCards({ formatMoney, totales }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="card">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-3 ${card.accent}`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">{card.label}</p>
              <p className="text-xl font-bold text-text-primary">
                {card.key === 'cantidadAprobadas' ? totales[card.key] : formatMoney(totales[card.key])}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
