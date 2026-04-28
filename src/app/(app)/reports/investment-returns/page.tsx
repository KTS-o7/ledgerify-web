import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getInvestmentReturns } from '@/lib/utils/reports'
import { formatCurrency } from '@/lib/utils/format'

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
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Investment Returns</h1>
      <p className="text-muted-foreground text-sm">Portfolio P&amp;L and returns</p>
      {investments.length === 0 ? (
        <p className="text-muted-foreground">No investments found.</p>
      ) : (
        <div className="overflow-x-auto">
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
                  <td className="py-2 pr-4">{inv.name}</td>
                  <td className="py-2 pr-4 capitalize">{inv.assetType}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(inv.invested, currency)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(inv.current, currency)}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${inv.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {inv.pnl >= 0 ? '+' : ''}{formatCurrency(inv.pnl, currency)}
                  </td>
                  <td className={`py-2 text-right font-medium ${inv.pnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {inv.pnlPct >= 0 ? '+' : ''}{inv.pnlPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
              <tr className="font-semibold bg-muted/30">
                <td className="py-2 pr-4" colSpan={2}>Total</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(totalInvested, currency)}</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(totalCurrent, currency)}</td>
                <td className={`py-2 pr-4 text-right ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, currency)}
                </td>
                <td className={`py-2 text-right ${totalPnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
