'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

export interface DonutSlice {
  name: string
  value: number
  color: string
}

interface Props {
  slices: DonutSlice[]
  currency: string
  centerLabel?: string
  centerValue?: string
}

export function SpendingDonut({ slices, currency, centerLabel, centerValue }: Props) {
  const total = slices.reduce((s, d) => s + d.value, 0)

  if (total === 0) return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      No spending yet this period
    </div>
  )

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {slices.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [typeof value === 'number' ? formatCurrency(value, currency) : String(value), '']}
            contentStyle={{
              borderRadius: '1rem',
              border: '1px solid var(--border)',
              fontSize: 12,
              background: 'var(--card)',
              color: 'var(--card-foreground)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
          <span className="text-lg font-bold">{centerValue}</span>
        </div>
      )}
    </div>
  )
}
