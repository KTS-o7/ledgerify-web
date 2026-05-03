import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { transactions, accounts, budgets, users } from '@/lib/db/schema'
import { eq, and, isNull, gte } from 'drizzle-orm'
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
import { getAccountBalance } from '@/lib/utils/accountBalance'
import { computeNetworth } from '@/lib/utils/networth'
import { format, subDays } from 'date-fns'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth.userId

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
  })
  const baseCurrency = user?.defaultCurrency ?? 'INR'

  const heatmapStart = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [accountList, budgetList, recentTxs] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(budgets).where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, heatmapStart),
    )),
  ])

  // Account balances
  const accountSummary = await Promise.all(accountList.map(async a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: await getAccountBalance(a.id, userId),
  })))

  // Budget health
  const budgetSummary = await Promise.all(budgetList.map(async b => {
    const period = getBudgetPeriod(b)
    const pStart = format(period.start, 'yyyy-MM-dd')
    const pEnd = format(period.end, 'yyyy-MM-dd')
    const periodTxs = recentTxs.filter(t =>
      t.type === 'expense' &&
      t.date >= pStart &&
      t.date <= pEnd &&
      (!b.categoryId || t.categoryId === b.categoryId)
    )
    const spent = periodTxs.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
    const allowance = getDailyAllowance(b, spent)
    return {
      id: b.id,
      name: b.name,
      amount: Number(b.amount),
      currency: b.currency,
      spent,
      remaining: Number(b.amount) - spent,
      spentPct: Number(b.amount) > 0 ? Math.round((spent / Number(b.amount)) * 100) : 0,
      periodStart: pStart,
      periodEnd: pEnd,
      daysRemaining: allowance.daysRemaining,
      dailyAllowance: Math.round(allowance.dailyAllowance),
      isOverspent: allowance.isOverspent,
      overspentBy: Math.round(allowance.overspentBy),
    }
  }))

  // Networth
  const networth = await computeNetworth(userId, baseCurrency)

  // Anomalies: expense transactions > 2x 30-day daily average
  const expenseTxs = recentTxs.filter(t => t.type === 'expense')
  const totalSpent30 = expenseTxs.reduce((s, t) => s + Number(t.amount), 0)
  const dailyAvg = totalSpent30 / 30
  const anomalies = expenseTxs
    .filter(t => Number(t.amount) > dailyAvg * 2 && dailyAvg > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      currency: t.currency,
      title: t.title,
      note: t.note,
    }))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    baseCurrency,
    networth,
    accounts: accountSummary,
    budgets: budgetSummary,
    anomalies,
    meta: {
      dailyAvgSpend30d: Math.round(dailyAvg),
      totalSpent30d: Math.round(totalSpent30),
    },
  })
}
