'use client'
import Link from 'next/link'
import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteBudget } from '@/app/actions/budgets'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { Budget } from '@/lib/db/schema'

interface Props {
  budget: Budget
  spent: number
  period?: { progressPct: number; daysRemaining: number; start: Date; end: Date }
  allowance?: { dailyAllowance: number; isOverspent: boolean; overspentBy: number; daysRemaining: number }
}

export function BudgetCard({ budget, spent, period, allowance }: Props) {
  const [isPending, startTransition] = useTransition()
  const total = Number(budget.amount)
  const spentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const timePct = period?.progressPct ?? 50
  const isOver = spentPct >= 100
  const isBehind = spentPct > timePct + 10

  const barColor = isOver ? 'bg-rose-500' : isBehind ? 'bg-amber-400' : 'bg-primary'

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Name + amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-base truncate">{budget.name}</p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{budget.periodType}</p>
        </div>
        <p className="text-sm font-bold tabular-nums shrink-0 text-muted-foreground">
          {formatCurrency(total, budget.currency)}
        </p>
      </div>

      {/* Spent number */}
      <p className={cn('text-2xl font-bold tabular-nums', isOver ? 'text-rose-600' : 'text-foreground')}>
        {formatCurrency(spent, budget.currency)}
        <span className="text-sm font-normal text-muted-foreground ml-1">spent</span>
      </p>

      {/* Progress bar with Today marker */}
      <div className="relative h-3 w-full rounded-full bg-muted overflow-visible">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${spentPct}%` }} />
        {period && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-foreground/50"
            style={{ left: `${Math.min(98, timePct)}%` }}
          />
        )}
      </div>

      {/* Daily allowance hint */}
      {allowance && (
        <p className="text-xs text-muted-foreground">
          {allowance.isOverspent
            ? `${formatCurrency(allowance.overspentBy, budget.currency)} over budget`
            : allowance.daysRemaining > 0
              ? `${formatCurrency(allowance.dailyAllowance, budget.currency)}/day · ${allowance.daysRemaining}d left`
              : 'Last day'}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link href={`/budgets/${budget.id}`}
          className="flex-1 rounded-xl border border-primary/30 bg-primary/5 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/10 transition-colors">
          Details
        </Link>
        <Dialog>
          <DialogTrigger render={
            <Button variant="ghost" size="sm" className="rounded-xl px-3 text-muted-foreground hover:text-destructive" disabled={isPending} />
          }>
            <Trash2 className="size-4" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete budget?</DialogTitle>
              <DialogDescription>&ldquo;{budget.name}&rdquo; will be permanently removed.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button variant="destructive" disabled={isPending}
                onClick={() => startTransition(async () => { await deleteBudget(budget.id) })}>
                {isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
