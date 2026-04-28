import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, loans, insurancePolicies, users } from '@/lib/db/schema'
import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm'
import { computeNetworth } from '@/lib/utils/networth'
import { NetworthCard } from '@/components/dashboard/NetworthCard'
import { CashFlowSummary } from '@/components/dashboard/CashFlowSummary'
import { UpcomingAlerts } from '@/components/dashboard/UpcomingAlerts'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [networthData, monthlyTxs, recentTxs, loanList, policyList] = await Promise.all([
    computeNetworth(userId, baseCurrency),
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, monthStart),
      lte(transactions.date, monthEnd),
    )),
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    )).orderBy(desc(transactions.date)).limit(5),
    db.select().from(loans).where(and(eq(loans.userId, userId), isNull(loans.deletedAt))),
    db.select().from(insurancePolicies).where(and(eq(insurancePolicies.userId, userId), isNull(insurancePolicies.deletedAt))),
  ])

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <NetworthCard {...networthData} currency={baseCurrency} />
      <CashFlowSummary transactions={monthlyTxs} currency={baseCurrency} />
      <UpcomingAlerts loans={loanList} policies={policyList} />
      <RecentTransactions transactions={recentTxs} />
    </div>
  )
}
