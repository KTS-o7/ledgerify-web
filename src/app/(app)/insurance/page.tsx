import { db } from '@/lib/db'
import { insurancePolicies } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { differenceInDays } from 'date-fns'
import { PolicyCard } from '@/components/insurance/PolicyCard'
import { InsuranceForm } from '@/components/insurance/InsuranceForm'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

export default async function InsurancePage() {
  const session = await auth()
  const userId = session!.user!.id!

  const policies = await db.select().from(insurancePolicies)
    .where(and(eq(insurancePolicies.userId, userId), isNull(insurancePolicies.deletedAt)))

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

  const summaryCurrency = policies[0]?.currency ?? 'INR'

  return (
    <div className="p-4 space-y-6">
      {/* Warning banner */}
      {expiringCount > 0 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
          {expiringCount} {expiringCount === 1 ? 'policy renews' : 'policies renew'} within the next 30 days.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Annual Premium</p>
          <p className="text-xl font-bold">
            {formatCurrency(totalAnnualPremium, summaryCurrency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Policies</p>
          <p className="text-xl font-bold">{policies.length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Insurance</h1>
        <Sheet>
          <SheetTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Policy</Button>} />
          <SheetContent>
            <SheetHeader><SheetTitle>New Policy</SheetTitle></SheetHeader>
            <div className="mt-4 px-4 pb-4 overflow-y-auto"><InsuranceForm /></div>
          </SheetContent>
        </Sheet>
      </div>

      {policies.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No insurance policies yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map(policy => <PolicyCard key={policy.id} policy={policy} />)}
        </div>
      )}
    </div>
  )
}
