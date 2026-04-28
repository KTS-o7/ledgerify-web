'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

const COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']

interface Props {
  data: { name: string; value: number }[]
  currency: string
}

export function CategoryPieChart({ data, currency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
