'use client'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { NetworthData } from '@/lib/utils/networth'

interface Props extends NetworthData {
  currency: string
}

export function NetworthCard({ networth, totalCash, totalInvestments, totalLiabilities, currency }: Props) {
  return (
    <div className="space-y-4">
      {/* Big net worth number */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net worth</p>
        <p className={cn(
          'text-5xl font-bold tabular-nums tracking-tight mt-1',
          networth < 0 ? 'text-rose-600' : 'text-foreground'
        )}>
          {formatCurrency(networth, currency)}
        </p>
      </div>

      {/* Three numbers flat — no cards */}
      <div className="grid grid-cols-3 gap-px rounded-2xl bg-border overflow-hidden">
        {[
          { label: 'Cash', value: totalCash, color: 'text-sky-600' },
          { label: 'Investments', value: totalInvestments, color: 'text-violet-600' },
          { label: 'Debt', value: -totalLiabilities, color: totalLiabilities > 0 ? 'text-rose-600' : 'text-foreground' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-lg font-semibold tabular-nums mt-0.5', color)}>
              {formatCurrency(Math.abs(value), currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
