'use client'
import { useActionState } from 'react'
import { createPolicy } from '@/app/actions/insurance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const POLICY_TYPES = [
  { value: 'life', label: 'Life' },
  { value: 'health', label: 'Health' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'property', label: 'Property' },
  { value: 'term', label: 'Term' },
  { value: 'other', label: 'Other' },
] as const

const PREMIUM_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
] as const

export function InsuranceForm() {
  const [state, formAction, pending] = useActionState(createPolicy, null)

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Policy Name</Label>
        <Input id="name" name="name" type="text" required placeholder="e.g. LIC Jeevan Anand" />
      </div>

      {/* Provider */}
      <div className="space-y-1">
        <Label htmlFor="provider">Provider</Label>
        <Input id="provider" name="provider" type="text" placeholder="e.g. LIC, HDFC ERGO" />
      </div>

      {/* Policy Type */}
      <div className="space-y-1">
        <Label htmlFor="policyType">Policy Type</Label>
        <select
          name="policyType"
          id="policyType"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {POLICY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Premium Amount + Frequency */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="premiumAmount">Premium Amount</Label>
          <Input id="premiumAmount" name="premiumAmount" type="number" step="any" min="0" required placeholder="e.g. 12000" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="premiumFrequency">Frequency</Label>
          <select
            name="premiumFrequency"
            id="premiumFrequency"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PREMIUM_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Coverage Amount */}
      <div className="space-y-1">
        <Label htmlFor="coverageAmount">Coverage Amount (optional)</Label>
        <Input id="coverageAmount" name="coverageAmount" type="number" step="any" min="0" placeholder="e.g. 5000000" />
      </div>

      {/* Currency */}
      <div className="space-y-1">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" type="text" defaultValue="INR" maxLength={3} required />
      </div>

      {/* Start Date */}
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>

      {/* End Date */}
      <div className="space-y-1">
        <Label htmlFor="endDate">End Date (optional)</Label>
        <Input id="endDate" name="endDate" type="date" />
      </div>

      {/* Renewal Date */}
      <div className="space-y-1">
        <Label htmlFor="renewalDate">Renewal Date (optional)</Label>
        <Input id="renewalDate" name="renewalDate" type="date" />
      </div>

      {/* Nominee */}
      <div className="space-y-1">
        <Label htmlFor="nominee">Nominee (optional)</Label>
        <Input id="nominee" name="nominee" type="text" placeholder="e.g. Spouse" />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" type="text" placeholder="Any additional notes" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Add Policy'}
      </Button>
    </form>
  )
}
