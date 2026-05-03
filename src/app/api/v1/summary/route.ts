import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { transactions, accounts, budgets, users, loans, insurancePolicies, investments } from '@/lib/db/schema'
import { eq, and, isNull, gte } from 'drizzle-orm'
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
import { getAccountBalance } from '@/lib/utils/accountBalance'
import { computeNetworth } from '@/lib/utils/networth'
import { format, subDays, addDays, differenceInDays } from 'date-fns'
import { getRate } from '@/lib/utils/currency'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth.userId

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
  })
  const baseCurrency = user?.defaultCurrency ?? 'INR'

  const heatmapStart = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [accountList, budgetList, recentTxs, loanList, policyList, investmentList] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(budgets).where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, heatmapStart),
    )),
    db.select().from(loans).where(and(eq(loans.userId, userId), isNull(loans.deletedAt))),
    db.select().from(insurancePolicies).where(and(eq(insurancePolicies.userId, userId), isNull(insurancePolicies.deletedAt))),
    db.select().from(investments).where(and(eq(investments.userId, userId), isNull(investments.deletedAt))),
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

  const today = new Date()
  const in30Days = format(addDays(today, 30), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  // Loan EMIs due within 30 days
  const upcomingEmis = loanList
    .filter(l => Number(l.outstandingBalance ?? 0) > 0)
    .map(l => {
      const emiDay = new Date(l.startDate).getDate()
      const candidate = new Date(today.getFullYear(), today.getMonth(), emiDay)
      if (candidate < today) candidate.setMonth(candidate.getMonth() + 1)
      const dueDateStr = format(candidate, 'yyyy-MM-dd')
      if (dueDateStr > in30Days) return null
      return {
        type: 'loan_emi' as const,
        id: l.id,
        name: l.name,
        amount: Number(l.emiAmount),
        currency: l.currency,
        dueDate: dueDateStr,
        daysUntil: differenceInDays(candidate, today),
        outstandingBalance: Number(l.outstandingBalance ?? 0),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Insurance renewals due within 30 days
  const upcomingRenewals = policyList
    .filter(p => p.renewalDate && p.renewalDate >= todayStr && p.renewalDate <= in30Days)
    .map(p => ({
      type: 'insurance_renewal' as const,
      id: p.id,
      name: p.name,
      amount: Number(p.premiumAmount),
      currency: p.currency,
      dueDate: p.renewalDate!,
      daysUntil: differenceInDays(new Date(p.renewalDate!), today),
      provider: p.provider ?? null,
    }))

  // Investment maturities in 30 days (FD, bonds, NPS, PPF)
  const upcomingMaturities = investmentList
    .filter(i => i.maturityDate && i.maturityDate >= todayStr && i.maturityDate <= in30Days)
    .map(i => ({
      type: 'investment_maturity' as const,
      id: i.id,
      name: i.name,
      assetType: i.assetType,
      currency: i.currency,
      dueDate: i.maturityDate!,
      daysUntil: differenceInDays(new Date(i.maturityDate!), today),
      estimatedValue: Math.round(Number(i.currentPrice ?? i.buyPrice ?? 0) * Number(i.quantity ?? 1)),
    }))

  const upcomingObligations = [
    ...upcomingEmis,
    ...upcomingRenewals,
    ...upcomingMaturities,
  ].sort((a, b) => a.daysUntil - b.daysUntil)

  // Investment P&L
  const investmentSummary = await Promise.all(investmentList.map(async inv => {
    const rate = await getRate(inv.currency, baseCurrency)
    const qty = Number(inv.quantity ?? 1)
    const currentValue = Number(inv.currentPrice ?? inv.buyPrice ?? 0) * qty * rate
    const costBasis = Number(inv.buyPrice ?? 0) * qty * rate
    const unrealisedPnl = currentValue - costBasis
    const unrealisedPnlPct = costBasis > 0 ? (unrealisedPnl / costBasis) * 100 : 0
    return {
      id: inv.id,
      name: inv.name,
      assetType: inv.assetType,
      currency: inv.currency,
      currentValue: Math.round(currentValue),
      costBasis: Math.round(costBasis),
      unrealisedPnl: Math.round(unrealisedPnl),
      unrealisedPnlPct: Math.round(unrealisedPnlPct * 10) / 10,
      maturityDate: inv.maturityDate ?? null,
    }
  }))

  // Credit card outstanding summary
  const creditCardSummary = accountSummary
    .filter(a => a.type === 'credit_card')
    .map(a => ({
      id: a.id,
      name: a.name,
      outstanding: a.balance,
      currency: a.currency,
    }))

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
    creditCards: creditCardSummary,
    budgets: budgetSummary,
    upcomingObligations,
    investments: investmentSummary,
    anomalies,
    meta: {
      dailyAvgSpend30d: Math.round(dailyAvg),
      totalSpent30d: Math.round(totalSpent30),
      totalCreditOutstanding: creditCardSummary.reduce((s, c) => s + c.outstanding, 0),
      totalUpcomingObligations30d: upcomingObligations.reduce((s, o) => s + ('amount' in o ? o.amount : 0), 0),
      totalInvestmentValue: investmentSummary.reduce((s, i) => s + i.currentValue, 0),
      totalUnrealisedPnl: investmentSummary.reduce((s, i) => s + i.unrealisedPnl, 0),
    },
  })
}
