import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  name: string
  color: string
  icon?: string | null
  spent: number
  limit?: number
  count: number
  currency: string
}

export function CategoryRow({ name, color, icon, spent, limit, count, currency }: Props) {
  const pct = limit && limit > 0 ? Math.min(100, (spent / limit) * 100) : null
  const isOver = pct !== null && pct >= 100

  return (
    <div className="flex items-center gap-3 py-3">
      {/* Icon circle */}
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ background: color + '22', border: `2px solid ${color}`, color }}
      >
        {icon ?? name[0]?.toUpperCase()}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className={cn('shrink-0 text-sm font-bold tabular-nums', isOver && 'text-rose-600')}>
            {formatCurrency(spent, currency)}
            {limit != null
              ? <span className="font-normal text-muted-foreground"> / {formatCurrency(limit, currency)}</span>
              : null}
          </span>
        </div>
        {pct !== null && (
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', isOver ? 'bg-rose-500' : 'bg-current')}
              style={{ width: `${pct}%`, color: isOver ? undefined : color, background: isOver ? undefined : color }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">{count} transaction{count !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}
