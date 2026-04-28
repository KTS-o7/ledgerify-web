'use client'
import { formatCurrency } from '@/lib/utils/format'
import type { NetworthData } from '@/lib/utils/networth'

interface Props extends NetworthData {
  currency: string
}

export function NetworthCard({ networth, totalCash, totalInvestments, totalLiabilities, currency }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Net Worth</p>
        <p className="text-4xl font-bold tracking-tight">
          {formatCurrency(networth, currency)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2 border-t">
        <div>
          <p className="text-xs text-muted-foreground">Cash</p>
          <p className="font-semibold text-sm">{formatCurrency(totalCash, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Investments</p>
          <p className="font-semibold text-sm text-green-600">{formatCurrency(totalInvestments, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Liabilities</p>
          <p className="font-semibold text-sm text-red-500">{formatCurrency(totalLiabilities, currency)}</p>
        </div>
      </div>
    </div>
  )
}
