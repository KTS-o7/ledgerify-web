'use client'
import { useTransition } from 'react'
import { differenceInDays } from 'date-fns'
import { deletePolicy } from '@/app/actions/insurance'
import { FinancialAmount, StatusPill } from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
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

  const daysUntilRenewal = policy.renewalDate
    ? differenceInDays(new Date(policy.renewalDate), new Date())
    : null

  const renewsSoon = daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30

  function handleDelete() {
    startTransition(async () => {
      await deletePolicy(policy.id)
    })
  }

  return (
    <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-base font-semibold tracking-tight">{policy.name}</p>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="info">
              {POLICY_TYPE_LABELS[policy.policyType] ?? policy.policyType}
            </StatusPill>
            {renewsSoon && <StatusPill tone="warning">Renews soon</StatusPill>}
          </div>
        </div>
        <StatusPill>{policy.currency}</StatusPill>
      </div>

      {policy.provider && (
        <p className="mt-3 text-sm text-muted-foreground">{policy.provider}</p>
      )}

      <div className="mt-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Premium
        </p>
        <p className="financial-display text-3xl font-bold tracking-tight">
          <FinancialAmount amount={Number(policy.premiumAmount)} currency={policy.currency} sign="never" />
          <span className="text-sm font-normal text-muted-foreground ml-1">
            / {FREQUENCY_LABELS[policy.premiumFrequency] ?? policy.premiumFrequency}
          </span>
        </p>
      </div>

      {policy.coverageAmount && (
        <div className="mt-5 rounded-2xl bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Coverage: </span>
          <span className="font-medium">
            <FinancialAmount amount={Number(policy.coverageAmount)} currency={policy.currency} sign="never" />
          </span>
        </div>
      )}

      {policy.renewalDate && (
        <div className="mt-4 text-sm">
          <span className="text-muted-foreground">Renewal: </span>
          <span className={renewsSoon ? 'font-medium text-orange-600 dark:text-orange-400' : ''}>
            {policy.renewalDate}
            {daysUntilRenewal !== null && daysUntilRenewal >= 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({daysUntilRenewal}d)</span>
            )}
          </span>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-5 w-full rounded-2xl text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? 'Deleting...' : 'Delete policy'}
      </Button>
    </div>
  )
}
