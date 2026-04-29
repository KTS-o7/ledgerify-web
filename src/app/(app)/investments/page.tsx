import { db } from '@/lib/db'
import { investments, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { AssetCard } from '@/components/investments/AssetCard'
import { InvestmentForm } from '@/components/investments/InvestmentForm'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  FinancialAmount,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
} from '@/components/shared/quiet-ledger'
import { ChartNoAxesColumnIncreasing, Plus, TrendingUp, WalletCards } from 'lucide-react'

export default async function InvestmentsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [userRow, invList] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(investments)
      .where(and(eq(investments.userId, userId), isNull(investments.deletedAt))),
  ])
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  // compute portfolio totals
  let totalInvested = 0
  let totalCurrent = 0
  for (const inv of invList) {
    const qty = Number(inv.quantity ?? 1)
    const buy = Number(inv.buyPrice ?? 0)
    const cur = Number(inv.currentPrice ?? inv.buyPrice ?? 0)
    totalInvested += buy * qty
    totalCurrent += cur * qty
  }
  const totalPnL = totalCurrent - totalInvested
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Portfolio"
        title="Investments"
        description="Track long-term assets with just enough detail to understand value, cost, and movement."
        action={
        <Sheet>
          <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add investment
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>New investment</SheetTitle>
              <SheetDescription>
                Capture the asset, cost, and current value. Optional fields can stay blank.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4"><InvestmentForm /></div>
          </SheetContent>
        </Sheet>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{invList.length} assets</span>
          <span>·</span>
          <span>{baseCurrency} home currency</span>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Invested"
          value={<FinancialAmount amount={totalInvested} currency={baseCurrency} sign="never" />}
          description="Total purchase value from tracked holdings."
          icon={WalletCards}
          tone="neutral"
        />
        <MetricCard
          label="Current value"
          value={<FinancialAmount amount={totalCurrent} currency={baseCurrency} sign="never" />}
          description="Latest value from current prices where available."
          icon={TrendingUp}
          tone="positive"
        />
        <MetricCard
          label="P&L"
          value={<FinancialAmount amount={totalPnL} currency={baseCurrency} sign="always" />}
          description={`${totalPnLPct.toFixed(1)}% across tracked positions.`}
          icon={ChartNoAxesColumnIncreasing}
          tone={totalPnL >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {invList.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Add your first long-term asset"
          description="Start with one investment you already understand. You can refine prices and details over time."
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title="Holdings"
            description="Update prices occasionally so the wealth snapshot stays useful."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {invList.map(inv => <AssetCard key={inv.id} investment={inv} />)}
          </div>
        </section>
      )}
    </PageShell>
  )
}
