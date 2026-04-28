'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DataPoint { month: string; income: string; expense: string }
interface Props { data: DataPoint[]; currency: string }

export function CashFlowChart({ data, currency }: Props) {
  const formatted = data.map(d => ({
    month: d.month,
    Income: Number(d.income),
    Expense: Number(d.expense),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency)} />
        <Legend />
        <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
