'use client'
import { useState, useTransition } from 'react'
import { contributeToGoal, deleteSavingsGoal } from '@/app/actions/budgets'
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
import { formatCurrency } from '@/lib/utils/format'
import type { SavingsGoal } from '@/lib/db/schema'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  achieved: 'Achieved',
  abandoned: 'Abandoned',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  achieved: 'bg-green-100 text-green-700',
  abandoned: 'bg-gray-100 text-gray-500',
}

interface Props {
  goal: SavingsGoal
}

export function GoalCard({ goal }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [amountInput, setAmountInput] = useState('')

  const current = Number(goal.currentAmount)
  const target = Number(goal.targetAmount)
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0

  const deadlineDate = goal.deadline ? new Date(goal.deadline) : null
  const daysRemaining = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{goal.name}</p>
          {goal.description && (
            <p className="text-xs text-muted-foreground truncate">{goal.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[goal.status] ?? ''}`}
        >
          {STATUS_LABELS[goal.status] ?? goal.status}
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(current, goal.currency)} / {formatCurrency(target, goal.currency)} ({pct.toFixed(0)}%)
        </p>
      </div>

      {/* Deadline */}
      {deadlineDate && (
        <p className="text-xs text-muted-foreground">
          Deadline: {deadlineDate.toLocaleDateString()}{' '}
          {daysRemaining !== null && (
            <span className={daysRemaining < 0 ? 'text-red-500' : ''}>
              ({daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`})
            </span>
          )}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {goal.status === 'active' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="flex-1" />}>
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
                  {isPending ? 'Saving…' : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Button
          variant="destructive"
          size="sm"
          className={goal.status === 'active' ? '' : 'flex-1'}
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </div>
  )
}
