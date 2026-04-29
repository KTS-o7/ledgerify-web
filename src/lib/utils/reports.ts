import { db } from '@/lib/db'
import { transactions, investments, budgets } from '@/lib/db/schema'
import { eq, and, isNull, gte, lte, sql } from 'drizzle-orm'

// Cash flow by month for the last N months
export async function getCashFlowByMonth(userId: string, months = 12) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const sinceStr = since.toISOString().slice(0, 10)

  return db
    .select({
      month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.convertedAmount}::numeric ELSE 0 END), 0)`,
      expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.convertedAmount}::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, sinceStr),
    ))
    .groupBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`)
}

// Category breakdown for a date range
export async function getCategoryBreakdown(userId: string, startDate: string, endDate: string) {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`COALESCE(SUM(${transactions.convertedAmount}::numeric), 0)`,
      type: transactions.type,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ))
    .groupBy(transactions.categoryId, transactions.type)

  return rows
}

// Investment returns summary
export async function getInvestmentReturns(userId: string) {
  const invRows = await db.select().from(investments)
    .where(and(eq(investments.userId, userId), isNull(investments.deletedAt)))

  return invRows.map(inv => {
    const qty = Number(inv.quantity ?? 1)
    const buy = Number(inv.buyPrice ?? 0)
    const cur = Number(inv.currentPrice ?? inv.buyPrice ?? 0)
    const invested = buy * qty
    const current = cur * qty
    const pnl = current - invested
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
    return { ...inv, invested, current, pnl, pnlPct }
  })
}

// Budget vs actual for current month
export async function getBudgetVsActual(userId: string, startDate: string, endDate: string) {
  const budgetRows = await db.select().from(budgets)
    .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt)))

  const txRows = await db.select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.type, 'expense'),
      isNull(transactions.deletedAt),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ))

  return budgetRows.map(budget => {
    const relevant = budget.categoryId
      ? txRows.filter(t => t.categoryId === budget.categoryId)
      : txRows
    const spent = relevant.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
    return { ...budget, spent }
  })
}
