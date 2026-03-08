import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

export default function DonutChart({ data, colors, formatValue }) {
  if (!data || data.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos</p>
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
      return (
        <div className="bg-surface px-3 py-2 shadow-lg rounded-lg border border-border-default">
          <p className="font-medium text-text-primary">{item.name}</p>
          <p className="text-sm text-text-secondary">
            {formatValue ? formatValue(item.value) : item.value} ({percentage}%)
          </p>
        </div>
      )
    }

    return null
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-sm text-text-primary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
