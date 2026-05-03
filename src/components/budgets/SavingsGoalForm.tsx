'use client'
import { useActionState } from 'react'
import { createSavingsGoal } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SavingsGoalForm({
  defaultCurrency = 'INR',
}: {
  defaultCurrency?: string
}) {
  const [state, formAction, pending] = useActionState(createSavingsGoal, null)

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Emergency fund, trip, school fees"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          type="text"
          placeholder="What this goal protects or unlocks"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <div className="space-y-1">
          <Label htmlFor="targetAmount">Target amount</Label>
          <Input id="targetAmount" name="targetAmount" type="number" step="0.01" min="0.01" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="deadline">Deadline</Label>
        <Input id="deadline" name="deadline" type="date" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full rounded-2xl" disabled={pending}>
        {pending ? 'Saving…' : 'Create goal'}
      </Button>
    </form>
  )
}
