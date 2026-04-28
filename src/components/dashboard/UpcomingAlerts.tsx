'use client'
import { differenceInDays } from 'date-fns'
import type { Loan, InsurancePolicy } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'

interface Props {
  loans: Loan[]
  policies: InsurancePolicy[]
}

export function UpcomingAlerts({ loans, policies }: Props) {
  const today = new Date()

  // loans with payments due (use startDate + tenure to estimate next EMI)
  const loanAlerts = loans
    .filter(l => Number(l.outstandingBalance ?? 0) > 0)
    .map(l => ({
      label: `${l.name} EMI`,
      amount: l.emiAmount,
      currency: l.currency,
      daysUntil: 30, // simplified — show all active loans
    }))

  // policies renewing within 60 days
  const renewalAlerts = policies
    .filter(p => p.renewalDate)
    .map(p => ({
      label: `${p.name} renewal`,
      amount: p.premiumAmount,
      currency: p.currency,
      daysUntil: differenceInDays(new Date(p.renewalDate!), today),
    }))
    .filter(a => a.daysUntil <= 60 && a.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const alerts = [...renewalAlerts, ...loanAlerts].slice(0, 5)

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</h2>
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-2">
            <Badge variant={alert.daysUntil <= 7 ? 'destructive' : 'secondary'}>
              {alert.daysUntil <= 0 ? 'Due' : `${alert.daysUntil}d`}
            </Badge>
            <span className="text-sm">{alert.label}</span>
          </div>
          <span className="text-sm font-medium">{alert.currency} {Number(alert.amount).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
