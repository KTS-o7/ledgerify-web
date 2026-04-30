'use client'
import { useState, useTransition } from 'react'
import { PiggyBank, Target, Trash2 } from 'lucide-react'

import { contributeToGoal, deleteSavingsGoal } from '@/app/actions/budgets'
import {
  AmountBox,
  FinancialAmount,
  IconBadge,
  ProgressMeter,
  StatusPill,
  TonalWidget,
} from '@/components/shared/quiet-ledger'
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
import type { SavingsGoal } from '@/lib/db/schema'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  achieved: 'Achieved',
  abandoned: 'Abandoned',
}

const STATUS_TONES = {
  active: 'info',
  achieved: 'positive',
  abandoned: 'neutral',
} as const

const STATUS_PROGRESS_TONES = {
  active: 'primary',
  achieved: 'positive',
  abandoned: 'neutral',
} as const

interface Props {
  goal: SavingsGoal
}

export function GoalCard({ goal }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [amountInput, setAmountInput] = useState('')

  const current = Number(goal.currentAmount)
  const target = Number(goal.targetAmount)
  const remaining = Math.max(0, target - current)

  const deadlineDate = goal.deadline ? new Date(goal.deadline) : null
  const daysRemaining = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  function handleContribute() {
    const amount = parseFloat(amountInput)
    if (!amount || amount <= 0) return
    startTransition(async () => {
      await contributeToGoal(goal.id, amount)
      setAmountInput('')
      setOpen(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSavingsGoal(goal.id)
    })
  }

  return (
    <TonalWidget tone="goal" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={Target} tone="goal" className="size-12 rounded-[1.35rem]" />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-base font-semibold">{goal.name}</p>
            {goal.description && (
              <p className="truncate text-sm text-muted-foreground">{goal.description}</p>
            )}
          </div>
        </div>
        <StatusPill
          tone={STATUS_TONES[goal.status as keyof typeof STATUS_TONES] ?? 'neutral'}
          className="shrink-0"
        >
          {STATUS_LABELS[goal.status] ?? goal.status}
        </StatusPill>
      </div>

      <div className="rounded-[1.5rem] border bg-background/75 p-4 shadow-sm shadow-foreground/5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Saved
        </p>
        <p className="financial-display mt-2 text-3xl font-bold">
          <FinancialAmount amount={current} currency={goal.currency} sign="never" />
        </p>
        <p className="text-sm text-muted-foreground">
          of <FinancialAmount amount={target} currency={goal.currency} sign="never" />
        </p>
      </div>

      <div>
        <ProgressMeter
          value={current}
          max={target}
          tone={STATUS_PROGRESS_TONES[goal.status as keyof typeof STATUS_PROGRESS_TONES] ?? 'primary'}
          label="Goal progress"
        />
        <div className="mt-3">
          <AmountBox
            label="Still needed"
            amount={remaining}
            currency={goal.currency}
            icon={PiggyBank}
            tone={remaining === 0 ? 'positive' : 'goal'}
          />
        </div>
      </div>

      {deadlineDate && (
        <p className="text-xs text-muted-foreground">
          Deadline: {deadlineDate.toLocaleDateString()}{' '}
          {daysRemaining !== null && (
            <span className={daysRemaining < 0 ? 'text-destructive' : ''}>
              ({daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`})
            </span>
          )}
        </p>
      )}

      <div className="flex gap-2">
        {goal.status === 'active' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="default" size="sm" className="flex-1 rounded-2xl" />}>
              Contribute
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contribute to {goal.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor={`amount-${goal.id}`}>Amount ({goal.currency})</Label>
                  <Input
                    id={`amount-${goal.id}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 1000"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button onClick={handleContribute} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Button
          variant="destructive"
          size="sm"
          className={goal.status === 'active' ? 'rounded-2xl' : 'flex-1 rounded-2xl'}
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="size-4" />
          {isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </TonalWidget>
  )
}
