'use client'
import { eachDayOfInterval, subDays, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  dailySpend: Record<string, number>  // 'yyyy-MM-dd' → total spent
  currency: string
  days?: number
}

export function SpendingHeatmap({ dailySpend, currency, days = 84 }: Props) {
  const today = new Date()
  const start = subDays(today, days - 1)
  const allDays = eachDayOfInterval({ start, end: today })
  const values = allDays.map(d => dailySpend[format(d, 'yyyy-MM-dd')] ?? 0)
  const max = Math.max(...values, 1)

  // Group into weeks
  const weeks: Date[][] = []
  let week: Date[] = []
  for (let i = 0; i < allDays.length; i++) {
    week.push(allDays[i])
    if (allDays[i].getDay() === 6 || i === allDays.length - 1) {
      weeks.push(week)
      week = []
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Spending heatmap — last {days} days</h3>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((wk, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {wk.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const val = dailySpend[key] ?? 0
              const intensity = val === 0 ? 0 : Math.max(0.15, val / max)
              const isToday = key === format(today, 'yyyy-MM-dd')
              return (
                <div
                  key={key}
                  title={`${key}: ${formatCurrency(val, currency)}`}
                  className={cn('size-3 rounded-sm', isToday && 'ring-1 ring-primary ring-offset-1')}
                  style={{ background: val === 0 ? 'var(--muted)' : `rgba(34, 197, 94, ${intensity})` }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
