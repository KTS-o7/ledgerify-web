import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { computeNetworth } from '@/lib/utils/networth'
import {
  FinancialAmount,
  MetricCard,
  PageHeader,
  PageShell,
  ProgressMeter,
  SectionHeader,
} from '@/components/shared/quiet-ledger'
import { Landmark, Scale, TrendingUp, WalletCards } from 'lucide-react'

export default async function NetworthPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  const { networth, totalCash, totalInvestments, totalLiabilities } = await computeNetworth(userId, baseCurrency)
  const assets = totalCash + totalInvestments
  const liabilityRatio = assets > 0 ? (totalLiabilities / assets) * 100 : 0

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Financial snapshot"
        title="Net worth"
        description="A calm view of what you own, what you owe, and the household position that remains."
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{baseCurrency} home currency</span>
          <span>·</span>
          <span>Assets less liabilities</span>
        </div>
      </PageHeader>

      <div className="rounded-3xl border bg-card/85 p-6 shadow-sm shadow-foreground/5 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Total net worth
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">
          <FinancialAmount amount={networth} currency={baseCurrency} sign="never" />
        </p>
        <div className="mt-6 max-w-xl">
          <ProgressMeter
            value={Math.max(0, assets - totalLiabilities)}
            max={Math.max(assets, 1)}
            tone={networth >= 0 ? 'positive' : 'negative'}
            label="Owned after liabilities"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Cash and accounts"
          value={<FinancialAmount amount={totalCash} currency={baseCurrency} sign="never" />}
          description="Accessible money containers included in the snapshot."
          icon={WalletCards}
          tone="info"
        />
        <MetricCard
          label="Investments"
          value={<FinancialAmount amount={totalInvestments} currency={baseCurrency} sign="never" />}
          description="Longer-term assets counted toward household wealth."
          icon={TrendingUp}
          tone="positive"
        />
        <MetricCard
          label="Liabilities"
          value={<FinancialAmount amount={totalLiabilities} currency={baseCurrency} sign="never" />}
          description={`${liabilityRatio.toFixed(0)}% of tracked assets.`}
          icon={Landmark}
          tone={totalLiabilities > 0 ? 'negative' : 'neutral'}
        />
      </div>

      <section className="rounded-3xl border bg-card/70 p-5 shadow-sm shadow-foreground/5">
        <SectionHeader
          title="How this is calculated"
          description="Ledgerify combines cash accounts and investments, then subtracts outstanding loans. Insurance coverage is protection, so it is not counted as spendable wealth."
          action={<Scale className="size-5 text-muted-foreground" />}
        />
      </section>
    </PageShell>
  )
}
