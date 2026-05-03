'use client'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { EmptyState } from '@/components/shared/quiet-ledger'
import { ReceiptText } from 'lucide-react'
import type { Transaction } from '@/lib/db/schema'

interface Props { transactions: Transaction[] }

export function RecentTransactions({ transactions }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Recent</h2>
        <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">View all</Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No transactions yet"
          description="Add your first income or expense." className="py-8" />
      ) : (
        <div className="rounded-2xl border bg-card divide-y">
          {transactions.map(t => {
            const isIncome = t.type === 'income'
            const isExpense = t.type === 'expense'
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/30 transition-colors">
                {/* Color dot */}
                <span className={cn('size-2 shrink-0 rounded-full',
                  isIncome ? 'bg-emerald-500' : isExpense ? 'bg-rose-500' : 'bg-sky-500')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.title || t.note || 'Transaction'}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(t.date), 'MMM d')}</p>
                </div>
                <p className={cn('text-sm font-semibold tabular-nums shrink-0',
                  isIncome ? 'text-emerald-600' : isExpense ? 'text-rose-600' : 'text-muted-foreground')}>
                  {isIncome ? '+' : isExpense ? '−' : ''}{formatCurrency(Number(t.amount), t.currency)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
