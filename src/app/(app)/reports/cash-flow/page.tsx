import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCashFlowByMonth } from '@/lib/utils/reports'
import { CashFlowChart } from '@/components/reports/CashFlowChart'
import { FinancialAmount, MetricCard, PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react'

export default async function CashFlowPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'
  const data = await getCashFlowByMonth(userId, 12)
  const totals = data.reduce(
    (sum, row) => ({
      income: sum.income + Number(row.income),
      expense: sum.expense + Number(row.expense),
    }),
    { income: 0, expense: 0 }
  )
  const net = totals.income - totals.expense

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Report"
        title="Cash flow"
        description="Income and expenses across the last 12 months."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Income" value={<FinancialAmount amount={totals.income} currency={currency} sign="never" />} icon={ArrowUpRight} tone="positive" />
        <MetricCard label="Expenses" value={<FinancialAmount amount={totals.expense} currency={currency} sign="never" />} icon={ArrowDownRight} tone="negative" />
        <MetricCard label="Net" value={<FinancialAmount amount={net} currency={currency} sign="always" />} icon={Scale} tone={net >= 0 ? 'positive' : 'negative'} />
      </div>
      <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
        <CashFlowChart data={data} currency={currency} />
      </div>
    </PageShell>
  )
}
