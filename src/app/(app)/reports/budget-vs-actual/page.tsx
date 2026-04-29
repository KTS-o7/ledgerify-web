import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getBudgetVsActual } from '@/lib/utils/reports'
import { BudgetActualChart } from '@/components/reports/BudgetActualChart'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { EmptyState, FinancialAmount, MetricCard, PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { Gauge, Target, TrendingDown } from 'lucide-react'

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
  const totalBudget = chartData.reduce((sum, row) => sum + row.budget, 0)
  const totalSpent = chartData.reduce((sum, row) => sum + row.spent, 0)

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Report"
        title="Budget vs actual"
        description={`Spending compared with budgets for ${format(now, 'MMMM yyyy')}.`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Budgeted" value={<FinancialAmount amount={totalBudget} currency={currency} sign="never" />} icon={Target} tone="info" />
        <MetricCard label="Spent" value={<FinancialAmount amount={totalSpent} currency={currency} sign="never" />} icon={TrendingDown} tone={totalSpent > totalBudget ? 'negative' : 'positive'} />
        <MetricCard label="Envelopes" value={chartData.length} icon={Gauge} tone={chartData.length > 0 ? 'primary' : 'neutral'} />
      </div>
      {chartData.length === 0 ? (
        <EmptyState icon={Target} title="No budgets found" description="Create a budget to compare planned and actual spending." />
      ) : (
        <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
          <BudgetActualChart data={chartData} currency={currency} />
        </div>
      )}
    </PageShell>
  )
}
