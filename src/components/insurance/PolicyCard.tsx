'use client'
import { useState, useTransition } from 'react'
import { differenceInDays } from 'date-fns'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deletePolicy, recordPremiumPayment } from '@/app/actions/insurance'
import {
  FinancialAmount,
  IconBadge,
  StatusPill,
  TonalWidget,
} from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InsurancePolicy } from '@/lib/db/schema'

const POLICY_TYPE_LABELS: Record<string, string> = {
  life: 'Life',
  health: 'Health',
  vehicle: 'Vehicle',
  property: 'Property',
  term: 'Term',
  other: 'Other',
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

interface Props {
  policy: InsurancePolicy
}

export function PolicyCard({ policy }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isPayPending, startPayTransition] = useTransition()
  const [payOpen, setPayOpen] = useState(false)

  const daysUntilRenewal = policy.renewalDate
    ? differenceInDays(new Date(policy.renewalDate), new Date())
    : null

  const renewsSoon = daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30

  const today = new Date().toISOString().split('T')[0]

  function handleDelete() {
    startTransition(async () => {
      await deletePolicy(policy.id)
    })
  }

  function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startPayTransition(async () => {
      const result = await recordPremiumPayment(null, fd)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Payment recorded')
        setPayOpen(false)
      }
    })
  }

  return (
    <TonalWidget tone="insurance" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconBadge icon={ShieldCheck} tone="insurance" className="size-12 rounded-[1.35rem]" />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-base font-semibold">{policy.name}</p>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="insurance">
                {POLICY_TYPE_LABELS[policy.policyType] ?? policy.policyType}
              </StatusPill>
              {renewsSoon && <StatusPill tone="warning">Renews soon</StatusPill>}
            </div>
          </div>
        </div>
        <StatusPill>{policy.currency}</StatusPill>
      </div>

      {policy.provider && (
        <p className="text-sm text-muted-foreground">{policy.provider}</p>
      )}

      <div className="rounded-[1.5rem] border bg-background/75 p-4 shadow-sm shadow-foreground/5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Premium
        </p>
        <p className="financial-display mt-2 text-3xl font-bold">
          <FinancialAmount amount={Number(policy.premiumAmount)} currency={policy.currency} sign="never" />
          <span className="text-sm font-normal text-muted-foreground ml-1">
            / {FREQUENCY_LABELS[policy.premiumFrequency] ?? policy.premiumFrequency}
          </span>
        </p>
      </div>

      {policy.coverageAmount && (
        <div className="rounded-2xl border bg-background/70 p-3 text-sm">
          <span className="text-muted-foreground">Coverage: </span>
          <span className="font-medium">
            <FinancialAmount amount={Number(policy.coverageAmount)} currency={policy.currency} sign="never" />
          </span>
        </div>
      )}

      {policy.renewalDate && (
        <div className="text-sm">
          <span className="text-muted-foreground">Renewal: </span>
          <span className={renewsSoon ? 'font-medium text-orange-600 dark:text-orange-400' : ''}>
            {policy.renewalDate}
            {daysUntilRenewal !== null && daysUntilRenewal >= 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({daysUntilRenewal}d)</span>
            )}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-2xl"
              />
            }
          >
            Record payment
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>
                Record a premium payment for {policy.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <input type="hidden" name="policyId" value={policy.id} />
              <div className="space-y-1">
                <Label htmlFor={`pay-date-${policy.id}`}>Date</Label>
                <Input
                  id={`pay-date-${policy.id}`}
                  name="date"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pay-amount-${policy.id}`}>Amount</Label>
                <Input
                  id={`pay-amount-${policy.id}`}
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pay-status-${policy.id}`}>Status</Label>
                <select
                  id={`pay-status-${policy.id}`}
                  name="status"
                  defaultValue="paid"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="paid">Paid</option>
                  <option value="due">Due</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
                <Button type="submit" disabled={isPayPending}>
                  {isPayPending ? 'Recording…' : 'Record payment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-2xl text-destructive hover:text-destructive"
              />
            }
          >
            <Trash2 className="size-4" />
            Delete policy
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete policy?</DialogTitle>
              <DialogDescription>
                This insurance policy record will be permanently removed. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TonalWidget>
  )
}
