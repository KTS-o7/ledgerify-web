import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, categories } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'
import { getCategoryBreakdown } from '@/lib/utils/reports'
import { CategoryPieChart } from '@/components/reports/CategoryPieChart'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export default async function CategoryBreakdownPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [breakdown, categoryRows] = await Promise.all([
    getCategoryBreakdown(userId, monthStart, monthEnd),
    db.select().from(categories).where(and(isNull(categories.deletedAt))),
  ])

  const catMap = new Map(categoryRows.map(c => [c.id, c.name]))

  const expenseData = breakdown
    .filter(row => row.type === 'expense')
    .map(row => ({
      name: row.categoryId ? (catMap.get(row.categoryId) ?? 'Unknown') : 'Uncategorized',
      value: Number(row.total),
    }))
    .filter(d => d.value > 0)

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Category Breakdown</h1>
      <p className="text-muted-foreground text-sm">Expense breakdown for {format(now, 'MMMM yyyy')}</p>
      {expenseData.length === 0 ? (
        <p className="text-muted-foreground">No expense data for this month.</p>
      ) : (
        <CategoryPieChart data={expenseData} currency={currency} />
      )}
    </div>
  )
}
