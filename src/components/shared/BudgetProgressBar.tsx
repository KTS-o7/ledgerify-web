'use client'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { BudgetPeriod } from '@/lib/utils/budgetPeriod'

interface Props {
  spent: number
  total: number
  period: BudgetPeriod
  currency: string
  dailyAllowance: number
  daysRemaining: number
  isOverspent: boolean
  overspentBy: number
  className?: string
}

export function BudgetProgressBar({
  spent, total, period, currency,
  dailyAllowance, daysRemaining, isOverspent, overspentBy, className
}: Props) {
  const spentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const timePct = period.progressPct
  const isBehind = spentPct > timePct + 10  // spending faster than time
  const isOver = spentPct >= 100

  const barColor = isOver
    ? 'bg-rose-500'
    : isBehind
      ? 'bg-amber-400'
      : 'bg-primary'

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main bar */}
      <div className="relative h-5 w-full overflow-visible rounded-full bg-muted">
        {/* Spent fill */}
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${spentPct}%` }}
        />
        {/* Today marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `clamp(0%, ${timePct}%, 100%)` }}
        >
          <div className="h-7 w-0.5 bg-foreground/70 rounded-full" />
          <span className="mt-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background whitespace-nowrap shadow-sm">
            Today
          </span>
        </div>
      </div>

      {/* Percentage label */}
      <p className="text-center text-sm font-semibold text-muted-foreground">
        {spentPct.toFixed(0)}%
      </p>

      {/* Date labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(period.start, 'MMM d')}</span>
        <span>{format(period.end, 'MMM d')}</span>
      </div>

      {/* Daily allowance hint */}
      <p className="text-sm text-muted-foreground text-center italic">
        {isOverspent
          ? `Overspent by ${currency} ${overspentBy.toFixed(0)} — try to reduce`
          : daysRemaining > 0
            ? `You can keep spending ${currency} ${dailyAllowance.toFixed(0)} for ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}`
            : 'Last day of this period'}
      </p>
    </div>
  )
}
