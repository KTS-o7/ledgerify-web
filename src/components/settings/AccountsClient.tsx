'use client'
import { useTransition, useActionState } from 'react'
import { createAccount, deleteAccount } from '@/app/actions/settings'
import {
  EmptyState,
  IconBadge,
  SectionHeader,
  StatusPill,
  TonalWidget,
} from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Banknote, Landmark, Plus, Trash2, Wallet, WalletCards } from 'lucide-react'
import type { Account } from '@/lib/db/schema'

interface AccountsClientProps {
  accountList: Account[]
}

const accountMeta = {
  bank: { label: 'Bank', icon: Landmark, tone: 'info' },
  wallet: { label: 'Wallet', icon: Wallet, tone: 'primary' },
  cash: { label: 'Cash', icon: Banknote, tone: 'positive' },
  savings: { label: 'Savings', icon: WalletCards, tone: 'warning' },
} as const

function AddAccountForm({ defaultCurrency = 'INR' }: { defaultCurrency?: string }) {
  const [state, action, pending] = useActionState(createAccount, null)

  return (
    <form action={action} className="mt-5 space-y-5 px-4">
      <div className="space-y-1">
        <Label htmlFor="acc-name">Name</Label>
        <Input id="acc-name" name="name" required placeholder="HDFC savings, Cash wallet" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div className="space-y-1">
          <Label htmlFor="acc-type">Type</Label>
          <select
            id="acc-type"
            name="type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
          <Input
            id="acc-currency"
            name="currency"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
      </div>
      {state && 'error' in state && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full rounded-2xl">
        {pending ? 'Adding...' : 'Add account'}
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
      className="rounded-2xl text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => startTransition(() => void deleteAccount(id))}
      aria-label="Delete account"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}

export function AccountsClient({ accountList }: AccountsClientProps) {
  const defaultCurrency = accountList[0]?.currency ?? 'INR'

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Accounts"
        description="Add the places where money lives so transactions have clear context."
        action={
        <Sheet>
          <SheetTrigger render={<Button size="sm" className="rounded-2xl" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add account
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>New account</SheetTitle>
              <SheetDescription>
                Start with the account you use most often for daily spending.
              </SheetDescription>
            </SheetHeader>
            <AddAccountForm defaultCurrency={defaultCurrency} />
          </SheetContent>
        </Sheet>
        }
      />

      {accountList.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="Add your first money container"
          description="A bank account, wallet, cash pocket, or savings account gives every transaction a home."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {accountList.map((account) => {
            const meta = accountMeta[account.type]
            return (
              <TonalWidget
                key={account.id}
                tone={meta.tone}
                className="flex items-center justify-between gap-3 p-4 sm:p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IconBadge icon={meta.icon} tone={meta.tone} className="size-11" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{account.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      <StatusPill>{account.currency}</StatusPill>
                    </div>
                  </div>
                </div>
                <DeleteAccountButton id={account.id} />
              </TonalWidget>
            )
          })}
        </div>
      )}
    </section>
  )
}
