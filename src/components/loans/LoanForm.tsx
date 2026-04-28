'use client'
import { useActionState } from 'react'
import { createLoan } from '@/app/actions/loans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LOAN_TYPES = [
  { value: 'home', label: 'Home Loan' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'vehicle', label: 'Vehicle Loan' },
  { value: 'education', label: 'Education Loan' },
  { value: 'other', label: 'Other' },
] as const

export function LoanForm() {
  const [state, formAction, pending] = useActionState(createLoan, null)

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" required placeholder="e.g. Home Loan - SBI" />
      </div>

      {/* Loan Type */}
      <div className="space-y-1">
        <Label htmlFor="loanType">Loan Type</Label>
        <select
          name="loanType"
          id="loanType"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {LOAN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Principal */}
      <div className="space-y-1">
        <Label htmlFor="principal">Principal Amount</Label>
        <Input id="principal" name="principal" type="number" step="any" min="0" required placeholder="e.g. 2500000" />
      </div>

      {/* Interest Rate */}
      <div className="space-y-1">
        <Label htmlFor="interestRate">Interest Rate %</Label>
        <Input id="interestRate" name="interestRate" type="number" step="0.01" min="0" required placeholder="e.g. 8.5" />
      </div>

      {/* Tenure */}
      <div className="space-y-1">
        <Label htmlFor="tenureMonths">Tenure (months)</Label>
        <Input id="tenureMonths" name="tenureMonths" type="number" step="1" min="1" required placeholder="e.g. 240" />
      </div>

      {/* Start Date */}
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>

      {/* EMI Amount */}
      <div className="space-y-1">
        <Label htmlFor="emiAmount">EMI Amount</Label>
        <Input id="emiAmount" name="emiAmount" type="number" step="any" min="0" required placeholder="e.g. 21640" />
      </div>

      {/* Currency */}
      <div className="space-y-1">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" type="text" defaultValue="INR" maxLength={3} required />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Add Loan'}
      </Button>
    </form>
  )
}
