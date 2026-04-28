'use client'
import { useActionState } from 'react'
import { createTransaction } from '@/app/actions/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Account, Category } from '@/lib/db/schema'

interface Props {
  accounts: Account[]
  categories: Category[]
}

export function TransactionForm({ accounts, categories }: Props) {
  const [state, formAction, pending] = useActionState(createTransaction, null)

  return (
    <form action={formAction} className="space-y-4">
      {/* Type */}
      <div className="space-y-1">
        <Label htmlFor="type">Type</Label>
        <select
          name="type"
          id="type"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
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

      {/* Account */}
      <div className="space-y-1">
        <Label htmlFor="accountId">Account</Label>
        <select
          name="accountId"
          id="accountId"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="space-y-1">
        <Label htmlFor="categoryId">Category</Label>
        <select
          name="categoryId"
          id="categoryId"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— No category —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      {/* Note */}
      <div className="space-y-1">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" type="text" placeholder="Optional note" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Add Transaction'}
      </Button>
    </form>
  )
}
