'use client'
import { useTransition } from 'react'
import { deleteBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/format'
import type { Budget } from '@/lib/db/schema'

interface Props {
  budget: Budget
  spent: number
}

export function BudgetCard({ budget, spent }: Props) {
  const [isPending, startTransition] = useTransition()

  const total = Number(budget.amount)
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0

  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-green-500'

  function handleDelete() {
    startTransition(async () => {
      await deleteBudget(budget.id)
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{budget.name}</p>
          <span className="inline-block mt-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
            {budget.periodType}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{budget.currency}</span>
      </div>

      {/* Budget amount */}
      <div>
        <p className="text-xs text-muted-foreground">Budget</p>
        <p className="text-2xl font-bold">
          {formatCurrency(total, budget.currency)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(spent, budget.currency)} / {formatCurrency(total, budget.currency)} ({pct.toFixed(0)}%)
        </p>
      </div>

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? 'Deleting…' : 'Delete'}
      </Button>
    </div>
  )
}
