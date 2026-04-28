'use client'
import { useActionState } from 'react'
import { createBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function BudgetForm() {
  const [state, formAction, pending] = useActionState(createBudget, null)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" required placeholder="e.g. Groceries Budget" />
      </div>

      {/* Period Type */}
      <div className="space-y-1">
        <Label htmlFor="periodType">Period</Label>
        <select
          name="periodType"
          id="periodType"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      {/* Amount + Currency */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue="INR" maxLength={3} required />
        </div>
      </div>

      {/* Start Date */}
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input id="startDate" name="startDate" type="date" required defaultValue={today} />
      </div>

      {/* End Date (optional) */}
      <div className="space-y-1">
        <Label htmlFor="endDate">End Date (optional)</Label>
        <Input id="endDate" name="endDate" type="date" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Add Budget'}
      </Button>
    </form>
  )
}
