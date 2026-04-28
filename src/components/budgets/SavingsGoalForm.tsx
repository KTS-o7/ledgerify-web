'use client'
import { useActionState } from 'react'
import { createSavingsGoal } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SavingsGoalForm() {
  const [state, formAction, pending] = useActionState(createSavingsGoal, null)

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" required placeholder="e.g. Emergency Fund" />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" name="description" type="text" placeholder="Optional description" />
      </div>

      {/* Target Amount + Currency */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="targetAmount">Target Amount</Label>
          <Input id="targetAmount" name="targetAmount" type="number" step="0.01" min="0.01" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue="INR" maxLength={3} required />
        </div>
      </div>

      {/* Deadline (optional) */}
      <div className="space-y-1">
        <Label htmlFor="deadline">Deadline (optional)</Label>
        <Input id="deadline" name="deadline" type="date" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Add Goal'}
      </Button>
    </form>
  )
}
