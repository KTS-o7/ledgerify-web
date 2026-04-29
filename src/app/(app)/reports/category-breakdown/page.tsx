import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, categories } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'
import { getCategoryBreakdown } from '@/lib/utils/reports'
import { CategoryPieChart } from '@/components/reports/CategoryPieChart'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { ChartPanel, EmptyState, FinancialAmount, MetricCard, PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { PieChart, ReceiptText, Tags } from 'lucide-react'

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
  const totalExpense = expenseData.reduce((sum, row) => sum + row.value, 0)
  const topCategory = expenseData.toSorted((a, b) => b.value - a.value)[0]

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Report"
        title="Category breakdown"
        description={`Expense breakdown for ${format(now, 'MMMM yyyy')}.`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard label="Total expenses" value={<FinancialAmount amount={totalExpense} currency={currency} sign="never" />} icon={ReceiptText} tone="negative" />
        <MetricCard label="Categories used" value={expenseData.length} icon={Tags} tone={expenseData.length > 0 ? 'info' : 'neutral'} />
      </div>
      {expenseData.length === 0 ? (
        <EmptyState icon={PieChart} title="No expense data this month" description="Record or import transactions to see where money is going." />
      ) : (
        <ChartPanel
          title="Spending by category"
          description="A donut view of this month’s expenses."
          insight={topCategory ? `${topCategory.name} is the largest spending category this month.` : undefined}
        >
          <CategoryPieChart data={expenseData} currency={currency} />
        </ChartPanel>
      )}
    </PageShell>
  )
}
