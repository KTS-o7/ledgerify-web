'use client'
import { addDays, addWeeks, addMonths, format, parseISO, differenceInCalendarDays } from 'date-fns'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { Repeat } from 'lucide-react'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Transaction[]
  accounts: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string; color?: string | null }>
}

function getNextDate(tx: Transaction): Date | null {
  if (!tx.recurrenceInterval || !tx.recurrenceUnit) return null
  const last = parseISO(tx.date)
  const n = Number(tx.recurrenceInterval)
  if (tx.recurrenceUnit === 'day') return addDays(last, n)
  if (tx.recurrenceUnit === 'week') return addWeeks(last, n)
  if (tx.recurrenceUnit === 'month') return addMonths(last, n)
  return null
}

export function RecurringList({ transactions, accounts, categories }: Props) {
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]))
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const today = new Date()

  const sorted = [...transactions].sort((a, b) => {
    const na = getNextDate(a)
    const nb = getNextDate(b)
    if (!na && !nb) return 0
    if (!na) return 1
    if (!nb) return -1
    return na.getTime() - nb.getTime()
  })

  return (
    <div className="space-y-3">
      {sorted.map(tx => {
        const next = getNextDate(tx)
        const cat = tx.categoryId ? catMap[tx.categoryId] : null
        const acc = accMap[tx.accountId]
        const daysUntil = next ? differenceInCalendarDays(next, today) : null
        const isUrgent = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0
        const isOverdue = daysUntil !== null && daysUntil < 0

        let dueLine = ''
        if (next) {
          if (daysUntil === 0) dueLine = 'Due today'
          else if (daysUntil === 1) dueLine = 'Due tomorrow'
          else if (daysUntil !== null && daysUntil < 0) dueLine = `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'}`
          else dueLine = `Due ${format(next, 'MMM d')}`
        }

        return (
          <div key={tx.id} className="flex items-center gap-4 rounded-3xl border bg-card p-4">
            <div className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-2xl',
              tx.type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
            )}>
              <Repeat className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{tx.title || tx.note || 'Recurring'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {acc?.name ?? '—'} · {cat?.name ?? 'Uncategorised'} · every {tx.recurrenceInterval} {tx.recurrenceUnit}(s)
              </p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className={cn(
                'font-bold tabular-nums',
                tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
              )}>
                {tx.type === 'income' ? '+' : '−'}{formatCurrency(Number(tx.amount), tx.currency)}
              </p>
              {next && (
                <p className={cn(
                  'text-xs',
                  isOverdue ? 'text-rose-600 font-semibold'
                    : isUrgent ? 'text-amber-600 font-semibold'
                      : 'text-muted-foreground'
                )}>
                  {dueLine}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
