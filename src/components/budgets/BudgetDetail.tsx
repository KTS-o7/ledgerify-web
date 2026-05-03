'use client'
import { format } from 'date-fns'
import { BudgetProgressBar } from '@/components/shared/BudgetProgressBar'
import { SpendingDonut } from '@/components/shared/SpendingDonut'
import { CategoryRow } from '@/components/shared/CategoryRow'
import { PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { formatCurrency } from '@/lib/utils/format'
import type { Budget, Transaction } from '@/lib/db/schema'
import type { BudgetPeriod } from '@/lib/utils/budgetPeriod'
import type { DonutSlice } from '@/components/shared/SpendingDonut'

interface Props {
  budget: Budget
  period: BudgetPeriod
  spent: number
  allowance: {
    dailyAllowance: number
    daysRemaining: number
    isOverspent: boolean
    overspentBy: number
  }
  slices: DonutSlice[]
  categories: Array<{ id: string; name: string; color?: string | null; icon?: string | null }>
  periodTxs: Transaction[]
}

export function BudgetDetail({ budget, period, spent, allowance, slices, categories, periodTxs }: Props) {
  const total = Number(budget.amount)
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  // Category rows — compute spend + count per category
  const catAccum: Record<string, { spent: number; count: number }> = {}
  for (const t of periodTxs) {
    const key = t.categoryId ?? '__none__'
    if (!catAccum[key]) catAccum[key] = { spent: 0, count: 0 }
    catAccum[key].spent += Number(t.amount)
    catAccum[key].count++
  }
  const catRows = Object.entries(catAccum).sort((a, b) => b[1].spent - a[1].spent)

  return (
    <PageShell size="default">
      <PageHeader
        eyebrow={budget.periodType}
        title={budget.name}
        description={`${format(period.start, 'MMM d')} — ${format(period.end, 'MMM d, yyyy')}`}
      />

      {/* Budget amount hero */}
      <div className="rounded-3xl bg-primary/10 border border-primary/20 p-6 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Budget limit</p>
        <p className="text-4xl font-bold tabular-nums">{formatCurrency(total, budget.currency)}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-rose-600">{formatCurrency(spent, budget.currency)}</span> spent ·{' '}
          <span className="font-semibold text-emerald-600">{formatCurrency(Math.max(0, total - spent), budget.currency)}</span> remaining
        </p>
      </div>

      {/* Progress bar with Today marker */}
      <div className="rounded-3xl border bg-card p-6">
        <BudgetProgressBar
          spent={spent}
          total={total}
          period={period}
          currency={budget.currency}
          dailyAllowance={allowance.dailyAllowance}
          daysRemaining={allowance.daysRemaining}
          isOverspent={allowance.isOverspent}
          overspentBy={allowance.overspentBy}
        />
      </div>

      {/* Donut + category rows */}
      {slices.length > 0 && (
        <div className="rounded-3xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-base">Spending breakdown</h3>
          <SpendingDonut
            slices={slices}
            currency={budget.currency}
            centerLabel="Spent"
            centerValue={formatCurrency(spent, budget.currency)}
          />
          <div className="divide-y">
            {catRows.map(([catId, { spent: catSpent, count }]) => {
              const cat = catMap[catId]
              const slice = slices.find(s => s.name === (cat?.name ?? 'Uncategorised'))
              return (
                <CategoryRow
                  key={catId}
                  name={cat?.name ?? 'Uncategorised'}
                  color={slice?.color ?? '#94a3b8'}
                  icon={cat?.icon}
                  spent={catSpent}
                  count={count}
                  currency={budget.currency}
                />
              )
            })}
          </div>
        </div>
      )}
    </PageShell>
  )
}
