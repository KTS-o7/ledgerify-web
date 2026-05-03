'use client'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Transaction[]
  currency: string
}

export function CashFlowSummary({ transactions, currency }: Props) {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)

  const net = income - expense
  const expensePct = income > 0 ? Math.min(100, (expense / income) * 100) : 0

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">This month</h2>

      <div className="grid grid-cols-3 gap-px rounded-2xl bg-border overflow-hidden">
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="text-xl font-bold tabular-nums text-emerald-600 mt-0.5">
            {formatCurrency(income, currency)}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-xl font-bold tabular-nums text-rose-600 mt-0.5">
            {formatCurrency(expense, currency)}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={cn('text-xl font-bold tabular-nums mt-0.5', net >= 0 ? 'text-foreground' : 'text-rose-600')}>
            {formatCurrency(Math.abs(net), currency)}
          </p>
        </div>
      </div>

      {/* Expense pace bar — flat, no card wrapper */}
      {income > 0 && (
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full', expensePct > 85 ? 'bg-rose-500' : 'bg-primary')}
              style={{ width: `${expensePct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.round(expensePct)}% of income spent · {transactions.length} transactions
          </p>
        </div>
      )}
    </div>
  )
}
