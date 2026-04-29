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
      <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v) => formatCurrency(Number(v ?? 0), currency)}
          contentStyle={{ borderRadius: 16, borderColor: 'var(--border)' }}
        />
        <Legend />
        <Bar dataKey="Income" fill="oklch(0.58 0.15 148)" radius={[8, 8, 0, 0]} />
        <Bar dataKey="Expense" fill="oklch(0.58 0.19 25)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
