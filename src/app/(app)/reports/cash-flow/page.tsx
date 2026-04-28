import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCashFlowByMonth } from '@/lib/utils/reports'
import { CashFlowChart } from '@/components/reports/CashFlowChart'

export default async function CashFlowPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'
  const data = await getCashFlowByMonth(userId, 12)
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Cash Flow</h1>
      <p className="text-muted-foreground text-sm">Last 12 months income vs expenses</p>
      <CashFlowChart data={data} currency={currency} />
    </div>
  )
}
