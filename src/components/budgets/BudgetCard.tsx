'use client'
import { useTransition } from 'react'
import { Gauge, Trash2, WalletCards } from 'lucide-react'

import { deleteBudget } from '@/app/actions/budgets'
import {
  AmountBox,
  FinancialAmount,
  IconBadge,
  ProgressMeter,
  StatusPill,
  TonalWidget,
} from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Budget } from '@/lib/db/schema'

interface Props {
  budget: Budget
  spent: number
}

export function BudgetCard({ budget, spent }: Props) {
  const [isPending, startTransition] = useTransition()

  const total = Number(budget.amount)
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const remaining = total - spent

  const tone = pct >= 100 ? 'negative' : pct >= 80 ? 'warning' : 'positive'
  const status = pct >= 100 ? 'Over plan' : pct >= 80 ? 'Watch' : 'On track'

  function handleDelete() {
    startTransition(async () => {
      await deleteBudget(budget.id)
    })
  }

  return (
    <TonalWidget tone="budget" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={Gauge} tone="budget" className="size-12 rounded-[1.35rem]" />
          <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-semibold">{budget.name}</p>
          <div className="flex flex-wrap gap-2">
            <StatusPill className="capitalize">{budget.periodType}</StatusPill>
            <StatusPill tone={tone}>{status}</StatusPill>
          </div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {budget.currency}
        </span>
      </div>

      <div className="rounded-[1.5rem] border bg-background/75 p-4 shadow-sm shadow-foreground/5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Planned
        </p>
        <p className="financial-display mt-2 text-3xl font-bold">
          <FinancialAmount amount={total} currency={budget.currency} sign="never" />
        </p>
      </div>

      <div>
        <ProgressMeter value={spent} max={total} tone={tone} label="Spent so far" />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <AmountBox
            label="Spent"
            amount={spent}
            currency={budget.currency}
            icon={WalletCards}
            tone={tone}
          />
          <AmountBox
            label={remaining >= 0 ? 'Left' : 'Over'}
            amount={Math.abs(remaining)}
            currency={budget.currency}
            icon={WalletCards}
            tone={remaining >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>

      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="mt-5 w-full rounded-2xl text-destructive hover:text-destructive"
            />
          }
        >
          <Trash2 className="size-4" />
          Delete budget
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete budget?</DialogTitle>
            <DialogDescription>
              &ldquo;{budget.name}&rdquo; will be permanently removed. This action cannot be undone.
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
    </TonalWidget>
  )
}
