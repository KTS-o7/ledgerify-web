import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { computeNetworth } from '@/lib/utils/networth'
import { formatCurrency } from '@/lib/utils/format'

export default async function NetworthPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  const { networth, totalCash, totalInvestments, totalLiabilities } = await computeNetworth(userId, baseCurrency)

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Net Worth</h1>
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm mb-1">Total Net Worth</p>
        <p className="text-5xl font-bold">{formatCurrency(networth, baseCurrency)}</p>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Cash & Accounts', value: totalCash, color: 'text-foreground' },
          { label: 'Investments', value: totalInvestments, color: 'text-green-600' },
          { label: 'Liabilities (Loans)', value: -totalLiabilities, color: 'text-red-500' },
        ].map(row => (
          <div key={row.label} className="flex justify-between p-4 rounded-lg border bg-card">
            <span className="text-sm font-medium">{row.label}</span>
            <span className={`font-bold ${row.color}`}>{formatCurrency(row.value, baseCurrency)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
