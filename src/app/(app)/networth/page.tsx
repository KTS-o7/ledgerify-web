import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { computeNetworth } from '@/lib/utils/networth'
import {
  AmountBox,
  FinancialAmount,
  PageHeader,
  PageShell,
  ProgressMeter,
  SectionHeader,
  TonalWidget,
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

      <TonalWidget tone="primary" className="p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Total net worth
        </p>
        <p className="financial-display mt-2 text-4xl font-bold sm:text-6xl">
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
      </TonalWidget>

      <div className="grid gap-4 md:grid-cols-3">
        <AmountBox
          label="Cash and accounts"
          amount={totalCash}
          currency={baseCurrency}
          icon={WalletCards}
          tone="cash"
          count="Accessible money containers"
        />
        <AmountBox
          label="Investments"
          amount={totalInvestments}
          currency={baseCurrency}
          icon={TrendingUp}
          tone="investment"
          count="Longer-term household assets"
        />
        <AmountBox
          label="Liabilities"
          amount={totalLiabilities}
          currency={baseCurrency}
          icon={Landmark}
          tone={totalLiabilities > 0 ? 'loan' : 'neutral'}
          count={`${liabilityRatio.toFixed(0)}% of tracked assets`}
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
