'use client'
import { useState, useTransition } from 'react'
import { ChartNoAxesCombined, Trash2 } from 'lucide-react'

import { updateInvestmentPrice, deleteInvestment } from '@/app/actions/investments'
import {
  FinancialAmount,
  IconBadge,
  StatusPill,
  TonalWidget,
} from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    <TonalWidget tone="investment" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={ChartNoAxesCombined} tone="investment" className="size-12 rounded-[1.35rem]" />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-base font-semibold">{investment.name}</p>
            <StatusPill tone="investment">
              {ASSET_TYPE_LABELS[investment.assetType] ?? investment.assetType}
            </StatusPill>
          </div>
        </div>
        <StatusPill>{investment.currency}</StatusPill>
      </div>

      <div className="rounded-[1.5rem] border bg-background/75 p-4 shadow-sm shadow-foreground/5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Current value
        </p>
        <p className="financial-display mt-2 text-3xl font-bold">
          <FinancialAmount amount={currentValue} currency={investment.currency} sign="never" />
        </p>
      </div>

      <div className="space-y-2 rounded-[1.5rem] border bg-background/70 p-4 text-sm">
        {buy > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Invested</span>
            <span className="font-medium">
              <FinancialAmount amount={buy * qty} currency={investment.currency} sign="never" />
            </span>
          </div>
        )}

        {pnl != null && pnlPct != null ? (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">P&amp;L</span>
            <span className={pnl >= 0 ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'font-medium text-rose-700 dark:text-rose-300'}>
              <FinancialAmount amount={pnl} currency={investment.currency} sign="always" />
              <span className="ml-1 text-xs">({pnlPct.toFixed(1)}%)</span>
            </span>
          </div>
        ) : (
          !hasCurrent && (
            <p className="text-xs text-muted-foreground">Current price not set.</p>
          )
        )}
      </div>

      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" className="flex-1 rounded-2xl" />}>
            Update price
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
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="destructive"
                size="sm"
                className="rounded-2xl"
              />
            }
          >
            <Trash2 className="size-4" />
            Delete
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete investment?</DialogTitle>
              <DialogDescription>
                This investment record will be permanently removed. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TonalWidget>
  )
}
