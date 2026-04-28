import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getBudgetVsActual } from '@/lib/utils/reports'
import { BudgetActualChart } from '@/components/reports/BudgetActualChart'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export default async function BudgetVsActualPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const budgetData = await getBudgetVsActual(userId, monthStart, monthEnd)

  const chartData = budgetData.map(b => ({
    name: b.name,
    budget: Number(b.amount),
    spent: b.spent,
  }))

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Budget vs Actual</h1>
      <p className="text-muted-foreground text-sm">Spending vs your budgets for {format(now, 'MMMM yyyy')}</p>
      {chartData.length === 0 ? (
        <p className="text-muted-foreground">No budgets found.</p>
      ) : (
        <BudgetActualChart data={chartData} currency={currency} />
      )}
    </div>
  )
}
