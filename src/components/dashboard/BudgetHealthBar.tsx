import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Budget } from '@/lib/db/schema'
import type { BudgetPeriod } from '@/lib/utils/budgetPeriod'

interface Props {
  budget: Budget
  spent: number
  period: BudgetPeriod
}

export function BudgetHealthBar({ budget, spent, period }: Props) {
  const total = Number(budget.amount)
  const spentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const timePct = period.progressPct
  const isBehind = spentPct > timePct + 10
  const isOver = spentPct >= 100

  return (
    <Link
      href={`/budgets/${budget.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium truncate">{budget.name}</span>
          <span className={cn(
            'text-xs font-semibold tabular-nums',
            isOver ? 'text-rose-600' : isBehind ? 'text-amber-600' : 'text-emerald-600'
          )}>
            {formatCurrency(spent, budget.currency)} / {formatCurrency(total, budget.currency)}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isOver ? 'bg-rose-500' : isBehind ? 'bg-amber-400' : 'bg-primary')}
            style={{ width: `${spentPct}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/30 rounded-full"
            style={{ left: `${Math.min(99, timePct)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {isOver ? 'Over budget' : isBehind ? 'Spending ahead of schedule' : 'On track'} · {period.daysRemaining}d remaining
        </p>
      </div>
    </Link>
  )
}
