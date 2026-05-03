import { addDays, addWeeks, addMonths, parseISO, format, differenceInCalendarDays } from 'date-fns'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Transaction[]
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

export function UpcomingRecurring({ transactions }: Props) {
  const today = new Date()
  const upcoming = transactions
    .map(tx => ({ tx, next: getNextDate(tx) }))
    .filter(({ next }) => next !== null && differenceInCalendarDays(next, today) <= 7 && differenceInCalendarDays(next, today) >= 0)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime())
    .slice(0, 5)

  if (upcoming.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due in 7 days</h3>
      {upcoming.map(({ tx, next }) => {
        const daysUntil = differenceInCalendarDays(next!, today)
        return (
          <div key={tx.id} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
            <Repeat className={cn('size-4 shrink-0', tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500')} />
            <span className="flex-1 text-sm font-medium truncate">{tx.title || tx.note || 'Recurring'}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : format(next!, 'MMM d')}
            </span>
            <span className={cn('text-sm font-bold whitespace-nowrap tabular-nums', tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
              {formatCurrency(Number(tx.amount), tx.currency)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
