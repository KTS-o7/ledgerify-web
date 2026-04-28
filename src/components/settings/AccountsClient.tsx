'use client'
import { useTransition, useActionState } from 'react'
import { createAccount, deleteAccount } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Plus, Trash2 } from 'lucide-react'
import type { Account } from '@/lib/db/schema'

interface AccountsClientProps {
  accountList: Account[]
}

function AddAccountForm() {
  const [state, action, pending] = useActionState(createAccount, null)

  return (
    <form action={action} className="space-y-4 px-4 mt-4">
      <div className="space-y-1">
        <Label htmlFor="acc-name">Name</Label>
        <Input id="acc-name" name="name" required placeholder="e.g. HDFC Savings" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-type">Type</Label>
        <select
          id="acc-type"
          name="type"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          defaultValue="bank"
        >
          <option value="bank">Bank</option>
          <option value="wallet">Wallet</option>
          <option value="cash">Cash</option>
          <option value="savings">Savings</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-currency">Currency</Label>
        <Input id="acc-currency" name="currency" defaultValue="INR" maxLength={3} required />
      </div>
      {state && 'error' in state && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Adding…' : 'Add Account'}
      </Button>
    </form>
  )
}

function DeleteAccountButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => startTransition(() => void deleteAccount(id))}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}

export function AccountsClient({ accountList }: AccountsClientProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <Sheet>
          <SheetTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Account</SheetTitle>
            </SheetHeader>
            <AddAccountForm />
          </SheetContent>
        </Sheet>
      </div>

      {accountList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts yet. Add one to get started.</p>
      ) : (
        <div className="space-y-2">
          {accountList.map(account => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{account.currency}</p>
                </div>
                <Badge variant="secondary">{account.type}</Badge>
              </div>
              <DeleteAccountButton id={account.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
