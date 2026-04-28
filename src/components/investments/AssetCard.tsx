'use client'
import { useState, useTransition } from 'react'
import { updateInvestmentPrice, deleteInvestment } from '@/app/actions/investments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import type { Investment } from '@/lib/db/schema'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  mf: 'Mutual Fund',
  crypto: 'Crypto',
  fd: 'FD',
  ppf: 'PPF',
  nps: 'NPS',
  gold: 'Gold',
  silver: 'Silver',
  real_estate: 'Real Estate',
  savings: 'Savings',
  other: 'Other',
}

interface Props {
  investment: Investment
}

export function AssetCard({ investment }: Props) {
  const [open, setOpen] = useState(false)
  const [priceInput, setPriceInput] = useState(investment.currentPrice ?? investment.buyPrice ?? '')
  const [isPending, startTransition] = useTransition()

  const qty = Number(investment.quantity ?? 1)
  const buy = Number(investment.buyPrice ?? 0)
  const cur = Number(investment.currentPrice ?? null)
  const hasCurrent = investment.currentPrice != null

  const currentValue = hasCurrent ? cur * qty : buy * qty
  const pnl = hasCurrent && buy > 0 ? (cur - buy) * qty : null
  const pnlPct = hasCurrent && buy > 0 ? ((cur - buy) / buy) * 100 : null

  function handleUpdatePrice() {
    const val = Number(priceInput)
    if (isNaN(val) || val < 0) return
    startTransition(async () => {
      await updateInvestmentPrice(investment.id, val)
      setOpen(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteInvestment(investment.id)
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{investment.name}</p>
          <span className="inline-block mt-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {ASSET_TYPE_LABELS[investment.assetType] ?? investment.assetType}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{investment.currency}</span>
      </div>

      {/* Values */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current Value</span>
          <span className="font-medium">
            {currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>

        {buy > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Invested</span>
            <span>{(buy * qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {pnl != null && pnlPct != null ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">P&amp;L</span>
            <span className={pnl >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
              {pnl >= 0 ? '+' : ''}
              {pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="ml-1 text-xs">({pnlPct.toFixed(1)}%)</span>
            </span>
          </div>
        ) : (
          !hasCurrent && (
            <p className="text-xs text-muted-foreground italic">Price not set</p>
          )
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" className="flex-1" />}>
            Update Price
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Price — {investment.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor={`price-${investment.id}`}>Current Price</Label>
                <Input
                  id={`price-${investment.id}`}
                  type="number"
                  step="any"
                  min="0"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={handleUpdatePrice} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
