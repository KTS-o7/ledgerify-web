'use client'
import { useTransition } from 'react'
import { differenceInDays } from 'date-fns'
import { deletePolicy } from '@/app/actions/insurance'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/format'
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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{policy.name}</p>
            {renewsSoon && (
              <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                Renews soon
              </span>
            )}
          </div>
          <span className="inline-block mt-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {POLICY_TYPE_LABELS[policy.policyType] ?? policy.policyType}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{policy.currency}</span>
      </div>

      {/* Provider */}
      {policy.provider && (
        <p className="text-sm text-muted-foreground">{policy.provider}</p>
      )}

      {/* Premium */}
      <div>
        <p className="text-xs text-muted-foreground">Premium</p>
        <p className="text-xl font-bold">
          {formatCurrency(Number(policy.premiumAmount), policy.currency)}
          <span className="text-sm font-normal text-muted-foreground ml-1">
            / {FREQUENCY_LABELS[policy.premiumFrequency] ?? policy.premiumFrequency}
          </span>
        </p>
      </div>

      {/* Coverage */}
      {policy.coverageAmount && (
        <div className="text-sm">
          <span className="text-muted-foreground">Coverage: </span>
          <span className="font-medium">{formatCurrency(Number(policy.coverageAmount), policy.currency)}</span>
        </div>
      )}

      {/* Renewal date */}
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
