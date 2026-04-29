import { db } from '@/lib/db'
import { insurancePolicies, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { differenceInDays } from 'date-fns'
import { PolicyCard } from '@/components/insurance/PolicyCard'
import { InsuranceForm } from '@/components/insurance/InsuranceForm'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  FinancialAmount,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from '@/components/shared/quiet-ledger'
import { CalendarClock, Plus, ShieldCheck, Umbrella } from 'lucide-react'

export default async function InsurancePage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [userRow, policies] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(insurancePolicies)
      .where(and(eq(insurancePolicies.userId, userId), isNull(insurancePolicies.deletedAt))),
  ])

  // Count policies expiring within 30 days
  const today = new Date()
  const expiringCount = policies.filter(p => {
    if (!p.renewalDate) return false
    const days = differenceInDays(new Date(p.renewalDate), today)
    return days >= 0 && days <= 30
  }).length

  // Compute total annual premium cost
  const totalAnnualPremium = policies.reduce((sum, p) => {
    const amount = Number(p.premiumAmount)
    let annual = amount
    if (p.premiumFrequency === 'monthly') annual = amount * 12
    else if (p.premiumFrequency === 'quarterly') annual = amount * 4
    return sum + annual
  }, 0)

  const summaryCurrency = policies[0]?.currency ?? userRow[0]?.defaultCurrency ?? 'INR'

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Protection"
        title="Insurance"
        description="Keep policies, premiums, coverage, nominees, and renewal dates in one calm protection view."
        action={
        <Sheet>
          <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add policy
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>New policy</SheetTitle>
              <SheetDescription>
                Add the policy basics and renewal date so protection does not get missed.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4"><InsuranceForm /></div>
          </SheetContent>
        </Sheet>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{policies.length} active policies</span>
          <span>·</span>
          <span>{summaryCurrency} summary currency</span>
          {expiringCount > 0 && (
            <>
              <span>·</span>
              <StatusPill tone="warning">{expiringCount} renewal soon</StatusPill>
            </>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Annual premium"
          value={<FinancialAmount amount={totalAnnualPremium} currency={summaryCurrency} sign="never" />}
          description="Estimated yearly cost from tracked payment frequencies."
          icon={Umbrella}
          tone="info"
        />
        <MetricCard
          label="Active policies"
          value={policies.length}
          description="Protection records available for household reference."
          icon={ShieldCheck}
          tone={policies.length > 0 ? 'positive' : 'neutral'}
        />
        <MetricCard
          label="Renewals soon"
          value={expiringCount}
          description="Policies due within the next 30 days."
          icon={CalendarClock}
          tone={expiringCount > 0 ? 'warning' : 'positive'}
        />
      </div>

      {policies.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No protection records yet"
          description="Add health, life, vehicle, or property policies so renewals and coverage are easy to find."
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title="Policies"
            description="Review premiums, coverage, and renewal timing before they become urgent."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {policies.map(policy => <PolicyCard key={policy.id} policy={policy} />)}
          </div>
        </section>
      )}
    </PageShell>
  )
}
