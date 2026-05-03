import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { budgets, transactions, categories } from '@/lib/db/schema'
import { eq, and, isNull, gte, lte } from 'drizzle-orm'
import { format } from 'date-fns'
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
import { BudgetDetail } from '@/components/budgets/BudgetDetail'

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user!.id!

  const [budget] = await db.select().from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId), isNull(budgets.deletedAt)))

  if (!budget) notFound()

  const period = getBudgetPeriod(budget)
  const periodStart = format(period.start, 'yyyy-MM-dd')
  const periodEnd = format(period.end, 'yyyy-MM-dd')

  const txConditions = [
    eq(transactions.userId, userId),
    eq(transactions.type, 'expense'),
    isNull(transactions.deletedAt),
    gte(transactions.date, periodStart),
    lte(transactions.date, periodEnd),
    ...(budget.categoryId ? [eq(transactions.categoryId, budget.categoryId)] : []),
  ] as const

  const [periodTxs, categoryList] = await Promise.all([
    db.select().from(transactions).where(and(...txConditions)),
    db.select().from(categories).where(
      and(isNull(categories.deletedAt))
    ),
  ])

  const spent = periodTxs.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
  const allowance = getDailyAllowance(budget, spent)

  // Build per-category spend map
  const COLORS = ['#4ade80', '#f472b6', '#facc15', '#60a5fa', '#94a3b8', '#fb923c', '#a78bfa']
  const catSpendMap: Record<string, number> = {}
  for (const t of periodTxs) {
    const key = t.categoryId ?? '__none__'
    catSpendMap[key] = (catSpendMap[key] ?? 0) + Number(t.amount)
  }
  const slices = Object.entries(catSpendMap).map(([catId, value], i) => ({
    name: categoryList.find(c => c.id === catId)?.name ?? 'Uncategorised',
    value,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <BudgetDetail
      budget={budget}
      period={period}
      spent={spent}
      allowance={allowance}
      slices={slices}
      categories={categoryList}
      periodTxs={periodTxs}
    />
  )
}
