'use client'
import type { Transaction } from '@/lib/db/schema'
import { formatCurrency } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface Props { transactions: Transaction[] }

export function RecentTransactions({ transactions }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent</h2>
        <Link href="/transactions" className="text-xs text-primary underline">View all</Link>
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : transactions.map(tx => (
        <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-2">
            <Badge variant={tx.type === 'income' ? 'default' : tx.type === 'expense' ? 'destructive' : 'secondary'} className="text-xs">
              {tx.type}
            </Badge>
            <span className="text-sm">{tx.note || '—'}</span>
          </div>
          <span className={`text-sm font-medium ${tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-500' : ''}`}>
            {tx.type === 'expense' ? '-' : '+'}{formatCurrency(Number(tx.amount), tx.currency)}
          </span>
        </div>
      ))}
    </div>
  )
}
