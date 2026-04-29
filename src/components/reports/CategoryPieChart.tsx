'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

const COLORS = [
  'oklch(0.58 0.13 245)',
  'oklch(0.72 0.16 78)',
  'oklch(0.58 0.19 25)',
  'oklch(0.58 0.15 148)',
  'oklch(0.55 0.13 185)',
  'oklch(0.5 0.16 285)',
  'oklch(0.55 0.17 18)',
  'oklch(0.66 0.15 72)',
]

interface Props {
  data: { name: string; value: number }[]
  currency: string
}

export function CategoryPieChart({ data, currency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={52} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          formatter={(v) => formatCurrency(Number(v ?? 0), currency)}
          contentStyle={{ borderRadius: 16, borderColor: 'var(--border)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
