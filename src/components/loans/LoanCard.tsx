'use client'
import { useTransition } from 'react'
import { deleteLoan } from '@/app/actions/loans'
import { FinancialAmount, ProgressMeter, StatusPill } from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
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

  const principal = Number(loan.principal)
  const outstanding = Number(loan.outstandingBalance ?? loan.principal)
  const paid = principal - outstanding
  const paidPct = principal > 0 ? Math.min(100, Math.max(0, (paid / principal) * 100)) : 0

  function handleDelete() {
    startTransition(async () => {
      await deleteLoan(loan.id)
    })
  }

  return (
    <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-semibold tracking-tight">{loan.name}</p>
          <StatusPill tone="negative">
            {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
          </StatusPill>
        </div>
        <StatusPill>{loan.currency}</StatusPill>
      </div>

      <div className="mt-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Outstanding
        </p>
        <p className="financial-display text-3xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
          <FinancialAmount amount={outstanding} currency={loan.currency} sign="never" />
        </p>
      </div>

      <div className="mt-5 space-y-2 text-sm">
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

      <div className="mt-5">
        <ProgressMeter value={paidPct} tone="positive" label="Repaid" />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-5 w-full rounded-2xl text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? 'Deleting...' : 'Delete loan'}
      </Button>
    </div>
  )
}
