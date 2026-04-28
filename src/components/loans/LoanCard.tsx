'use client'
import { useTransition } from 'react'
import { deleteLoan } from '@/app/actions/loans'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/format'
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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{loan.name}</p>
          <span className="inline-block mt-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{loan.currency}</span>
      </div>

      {/* Outstanding balance */}
      <div>
        <p className="text-xs text-muted-foreground">Outstanding Balance</p>
        <p className="text-2xl font-bold text-red-500">
          {formatCurrency(outstanding, loan.currency)}
        </p>
      </div>

      {/* Details */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Principal</span>
          <span>{formatCurrency(principal, loan.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Interest Rate</span>
          <span>{Number(loan.interestRate).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">EMI</span>
          <span>{formatCurrency(Number(loan.emiAmount), loan.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tenure</span>
          <span>{loan.tenureMonths} months</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Repaid</span>
          <span>{paidPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${paidPct}%` }}
          />
        </div>
      </div>

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? 'Deleting…' : 'Delete'}
      </Button>
    </div>
  )
}
