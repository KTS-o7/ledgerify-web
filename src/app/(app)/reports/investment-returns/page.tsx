import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getInvestmentReturns } from '@/lib/utils/reports'
import { EmptyState, FinancialAmount, MetricCard, PageHeader, PageShell, StatusPill } from '@/components/shared/quiet-ledger'
import { ChartNoAxesColumnIncreasing, TrendingUp, WalletCards } from 'lucide-react'

export default async function InvestmentReturnsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'

  const investments = await getInvestmentReturns(userId)

  const totalInvested = investments.reduce((s, i) => s + i.invested, 0)
  const totalCurrent = investments.reduce((s, i) => s + i.current, 0)
  const totalPnl = totalCurrent - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Report"
        title="Investment returns"
        description="Portfolio P&L and return percentages from tracked current prices."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Invested" value={<FinancialAmount amount={totalInvested} currency={currency} sign="never" />} icon={WalletCards} tone="neutral" />
        <MetricCard label="Current value" value={<FinancialAmount amount={totalCurrent} currency={currency} sign="never" />} icon={TrendingUp} tone="positive" />
        <MetricCard label="P&L" value={<FinancialAmount amount={totalPnl} currency={currency} sign="always" />} description={`${totalPnlPct.toFixed(2)}% total return.`} icon={ChartNoAxesColumnIncreasing} tone={totalPnl >= 0 ? 'positive' : 'negative'} />
      </div>
      {investments.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No investments found" description="Add investments to review returns and current value." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card/85 p-2 shadow-sm shadow-foreground/5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium text-right">Invested</th>
                <th className="py-2 pr-4 font-medium text-right">Current Value</th>
                <th className="py-2 pr-4 font-medium text-right">P&amp;L</th>
                <th className="py-2 font-medium text-right">P&amp;L %</th>
              </tr>
            </thead>
            <tbody>
              {investments.map(inv => (
                <tr key={inv.id} className="border-b hover:bg-muted/30">
                  <td className="py-3 pr-4 font-medium">{inv.name}</td>
                  <td className="py-3 pr-4 capitalize"><StatusPill tone="primary">{inv.assetType}</StatusPill></td>
                  <td className="py-3 pr-4 text-right"><FinancialAmount amount={inv.invested} currency={currency} sign="never" /></td>
                  <td className="py-3 pr-4 text-right"><FinancialAmount amount={inv.current} currency={currency} sign="never" /></td>
                  <td className={`py-2 pr-4 text-right font-medium ${inv.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <FinancialAmount amount={inv.pnl} currency={currency} sign="always" />
                  </td>
                  <td className={`py-2 text-right font-medium ${inv.pnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {inv.pnlPct >= 0 ? '+' : ''}{inv.pnlPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
              <tr className="font-semibold bg-muted/30">
                <td className="py-2 pr-4" colSpan={2}>Total</td>
                <td className="py-2 pr-4 text-right"><FinancialAmount amount={totalInvested} currency={currency} sign="never" /></td>
                <td className="py-2 pr-4 text-right"><FinancialAmount amount={totalCurrent} currency={currency} sign="never" /></td>
                <td className={`py-2 pr-4 text-right ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <FinancialAmount amount={totalPnl} currency={currency} sign="always" />
                </td>
                <td className={`py-2 text-right ${totalPnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  )
}
