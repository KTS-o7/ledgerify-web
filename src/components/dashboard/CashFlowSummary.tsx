'use client'
import { formatCurrency } from '@/lib/utils/format'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Transaction[]
  currency: string
}

export function CashFlowSummary({ transactions, currency }: Props) {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.convertedAmount ?? t.amount), 0)

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.convertedAmount ?? t.amount), 0)

  const net = income - expense

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">Income this month</p>
        <p className="text-lg font-bold text-green-600">{formatCurrency(income, currency)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">Expenses this month</p>
        <p className="text-lg font-bold text-red-500">{formatCurrency(expense, currency)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">Net</p>
        <p className={`text-lg font-bold ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {net >= 0 ? '+' : ''}{formatCurrency(net, currency)}
        </p>
      </div>
    </div>
  )
}
