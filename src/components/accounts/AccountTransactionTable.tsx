'use client'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Array<Transaction & { runningBalance: number }>
  categories: Array<{ id: string; name: string; color?: string | null }>
  currency: string
}

export function AccountTransactionTable({ transactions, categories, currency }: Props) {
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions on this account yet.
      </p>
    )
  }

  return (
    <div className="rounded-3xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Title / Note</th>
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map(t => {
              const cat = t.categoryId ? catMap[t.categoryId] : null
              return (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {format(parseISO(t.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                    {t.title || t.note || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {cat ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: (cat.color ?? '#888') + '22', color: cat.color ?? '#888' }}
                      >
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn(
                    'px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums',
                    t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-muted-foreground'
                  )}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                    {formatCurrency(Number(t.amount), currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatCurrency(t.runningBalance, currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
