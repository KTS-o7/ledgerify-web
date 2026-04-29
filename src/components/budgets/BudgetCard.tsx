'use client'
import { useTransition } from 'react'
import { deleteBudget } from '@/app/actions/budgets'
import { FinancialAmount, ProgressMeter, StatusPill } from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import type { Budget } from '@/lib/db/schema'

interface Props {
  budget: Budget
  spent: number
}

export function BudgetCard({ budget, spent }: Props) {
  const [isPending, startTransition] = useTransition()

  const total = Number(budget.amount)
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const remaining = total - spent

  const tone = pct >= 100 ? 'negative' : pct >= 80 ? 'warning' : 'positive'
  const status = pct >= 100 ? 'Over plan' : pct >= 80 ? 'Watch' : 'On track'

  function handleDelete() {
    startTransition(async () => {
      await deleteBudget(budget.id)
    })
  }

  return (
    <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-semibold tracking-tight">{budget.name}</p>
          <div className="flex flex-wrap gap-2">
            <StatusPill className="capitalize">{budget.periodType}</StatusPill>
            <StatusPill tone={tone}>{status}</StatusPill>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {budget.currency}
        </span>
      </div>

      <div className="mt-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Planned
        </p>
        <p className="financial-display text-3xl font-bold tracking-tight">
          <FinancialAmount amount={total} currency={budget.currency} sign="never" />
        </p>
      </div>

      <div className="mt-5">
        <ProgressMeter value={spent} max={total} tone={tone} label="Spent so far" />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="font-semibold">
              <FinancialAmount amount={spent} currency={budget.currency} sign="never" />
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              {remaining >= 0 ? 'Left' : 'Over'}
            </p>
            <p className="font-semibold">
              <FinancialAmount
                amount={Math.abs(remaining)}
                currency={budget.currency}
                sign="never"
              />
            </p>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-5 w-full rounded-2xl text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? 'Deleting...' : 'Delete budget'}
      </Button>
    </div>
  )
}
