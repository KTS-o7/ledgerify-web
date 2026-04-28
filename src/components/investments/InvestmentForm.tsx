'use client'
import { useActionState } from 'react'
import { createInvestment } from '@/app/actions/investments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ASSET_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'mf', label: 'Mutual Fund' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'fd', label: 'Fixed Deposit (FD)' },
  { value: 'ppf', label: 'PPF' },
  { value: 'nps', label: 'NPS' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
] as const

export function InvestmentForm() {
  const [state, formAction, pending] = useActionState(createInvestment, null)

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" required placeholder="e.g. Reliance Industries" />
      </div>

      {/* Asset Type */}
      <div className="space-y-1">
        <Label htmlFor="assetType">Asset Type</Label>
        <select
          name="assetType"
          id="assetType"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Currency */}
      <div className="space-y-1">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" type="text" defaultValue="INR" maxLength={3} required />
      </div>

      {/* Quantity + Buy Price */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" name="quantity" type="number" step="any" min="0" placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="buyPrice">Buy Price / NAV</Label>
          <Input id="buyPrice" name="buyPrice" type="number" step="any" min="0" placeholder="Optional" />
        </div>
      </div>

      {/* Current Price */}
      <div className="space-y-1">
        <Label htmlFor="currentPrice">Current Price</Label>
        <Input id="currentPrice" name="currentPrice" type="number" step="any" min="0" placeholder="Optional" />
      </div>

      {/* Maturity Date (for FD/PPF/NPS) */}
      <div className="space-y-1">
        <Label htmlFor="maturityDate">Maturity Date (for FD/PPF/NPS)</Label>
        <Input id="maturityDate" name="maturityDate" type="date" />
      </div>

      {/* Interest Rate (for FD/PPF/NPS) */}
      <div className="space-y-1">
        <Label htmlFor="interestRate">Interest Rate % (for FD/PPF/NPS)</Label>
        <Input id="interestRate" name="interestRate" type="number" step="any" min="0" placeholder="Optional" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Add Investment'}
      </Button>
    </form>
  )
}
