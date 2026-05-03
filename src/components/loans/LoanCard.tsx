'use client'
import { useState, useTransition } from 'react'
import { Landmark, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteLoan, recordLoanPayment } from '@/app/actions/loans'
import {
  FinancialAmount,
  IconBadge,
  ProgressMeter,
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
import type { Loan } from '@/lib/db/schema'

const LOAN_TYPE_LABELS: Record<string, string> = {
  home: 'Home',
  personal: 'Personal',
  vehicle: 'Vehicle',
  education: 'Education',
  other: 'Other',
}

interface Props {
  loan: Loan
}

export function LoanCard({ loan }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isPayPending, startPayTransition] = useTransition()
  const [payOpen, setPayOpen] = useState(false)

  const principal = Number(loan.principal)
  const outstanding = Number(loan.outstandingBalance ?? loan.principal)
  const paid = principal - outstanding
  const paidPct = principal > 0 ? Math.min(100, Math.max(0, (paid / principal) * 100)) : 0

  const today = new Date().toISOString().split('T')[0]

  function handleDelete() {
    startTransition(async () => {
      await deleteLoan(loan.id)
    })
  }

  function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startPayTransition(async () => {
      const result = await recordLoanPayment(null, fd)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Payment recorded')
        setPayOpen(false)
      }
    })
  }

  return (
    <TonalWidget tone="loan" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={Landmark} tone="loan" className="size-12 rounded-[1.35rem]" />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-base font-semibold">{loan.name}</p>
            <StatusPill tone="loan">
              {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
            </StatusPill>
          </div>
        </div>
        <StatusPill>{loan.currency}</StatusPill>
      </div>

      <div className="rounded-[1.5rem] border bg-background/75 p-4 shadow-sm shadow-foreground/5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Outstanding
        </p>
        <p className="financial-display mt-2 text-3xl font-bold text-rose-700 dark:text-rose-300">
          <FinancialAmount amount={outstanding} currency={loan.currency} sign="never" />
        </p>
      </div>

      <div className="space-y-2 rounded-[1.5rem] border bg-background/70 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Principal</span>
          <span className="font-medium">
            <FinancialAmount amount={principal} currency={loan.currency} sign="never" />
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Interest Rate</span>
          <span>{Number(loan.interestRate).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">EMI</span>
          <span className="font-medium">
            <FinancialAmount amount={Number(loan.emiAmount)} currency={loan.currency} sign="never" />
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tenure</span>
          <span>{loan.tenureMonths} months</span>
        </div>
      </div>

      <div>
        <ProgressMeter value={paidPct} tone="positive" label="Repaid" />
      </div>

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
                Record a payment for {loan.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <input type="hidden" name="loanId" value={loan.id} />
              <div className="space-y-1">
                <Label htmlFor={`pay-date-${loan.id}`}>Date</Label>
                <Input
                  id={`pay-date-${loan.id}`}
                  name="date"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pay-amount-${loan.id}`}>Amount</Label>
                <Input
                  id={`pay-amount-${loan.id}`}
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pay-principal-${loan.id}`}>Principal portion</Label>
                <Input
                  id={`pay-principal-${loan.id}`}
                  name="principalComponent"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pay-interest-${loan.id}`}>Interest portion</Label>
                <Input
                  id={`pay-interest-${loan.id}`}
                  name="interestComponent"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pay-status-${loan.id}`}>Status</Label>
                <select
                  id={`pay-status-${loan.id}`}
                  name="status"
                  defaultValue="paid"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
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
            Delete loan
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete loan?</DialogTitle>
              <DialogDescription>
                This loan record will be permanently removed. This action cannot be undone.
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
