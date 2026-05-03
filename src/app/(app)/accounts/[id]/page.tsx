import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { accounts, transactions, categories } from '@/lib/db/schema'
import { eq, and, isNull, desc, or } from 'drizzle-orm'
import { attachRunningBalance } from '@/lib/utils/accountBalance'
import { AccountTransactionTable } from '@/components/accounts/AccountTransactionTable'
import { PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { formatCurrency } from '@/lib/utils/format'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user!.id!

  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId), isNull(accounts.deletedAt)))

  if (!account) notFound()

  const [txList, categoryList] = await Promise.all([
    db.select().from(transactions)
      .where(and(
        eq(transactions.accountId, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ))
      .orderBy(desc(transactions.date)),
    db.select().from(categories)
      .where(and(
        isNull(categories.deletedAt),
        or(eq(categories.userId, userId), isNull(categories.userId)),
      )),
  ])

  const withBalance = attachRunningBalance(txList, Number(account.openingBalance ?? 0))
  const currentBalance = withBalance.length > 0
    ? withBalance[withBalance.length - 1].runningBalance
    : Number(account.openingBalance ?? 0)

  // For display, show newest first
  const displayTxs = [...withBalance].reverse()

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow={account.type}
        title={account.name}
        description={`Live balance: ${formatCurrency(currentBalance, account.currency)} · ${txList.length} transactions`}
      />
      <AccountTransactionTable
        transactions={displayTxs}
        categories={categoryList}
        currency={account.currency}
      />
    </PageShell>
  )
}
