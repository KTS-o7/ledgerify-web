'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DataPoint {
  name: string
  budget: number
  spent: number
}

interface Props {
  data: DataPoint[]
  currency: string
}

export function BudgetActualChart({ data, currency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
        <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency)} />
        <Legend />
        <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        <Bar dataKey="spent" name="Spent" fill="#ef4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
