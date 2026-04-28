'use client'
import { useTransition } from 'react'
import type { Transaction } from '@/lib/db/schema'
import { deleteTransaction } from '@/app/actions/transactions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/format'
import { Trash2 } from 'lucide-react'

interface Props {
  transactions: Transaction[]
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() => startTransition(() => { deleteTransaction(id) })}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transactions yet. Add your first one.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-3">
            <Badge
              variant={
                tx.type === 'income'
                  ? 'default'
                  : tx.type === 'expense'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {tx.type}
            </Badge>
            <div>
              <p className="text-sm font-medium">{tx.note || '—'}</p>
              <p className="text-xs text-muted-foreground">{tx.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`font-semibold ${
                tx.type === 'income'
                  ? 'text-green-600'
                  : tx.type === 'expense'
                  ? 'text-red-500'
                  : ''
              }`}
            >
              {tx.type === 'expense' ? '-' : '+'}
              {formatCurrency(Number(tx.amount), tx.currency)}
            </span>
            <DeleteButton id={tx.id} />
          </div>
        </div>
      ))}
    </div>
  )
}
