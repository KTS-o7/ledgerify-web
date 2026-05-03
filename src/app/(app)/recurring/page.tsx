import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { RecurringList } from '@/components/recurring/RecurringList'
import { PageHeader, PageShell, EmptyState } from '@/components/shared/quiet-ledger'
import { Repeat } from 'lucide-react'

export default async function RecurringPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [recurringTxs, accountList, categoryList] = await Promise.all([
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      eq(transactions.isRecurring, true),
      isNull(transactions.deletedAt),
    )),
    db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(categories).where(
      and(isNull(categories.deletedAt), or(eq(categories.userId, userId), isNull(categories.userId)))
    ),
  ])

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Scheduled"
        title="Recurring Transactions"
        description="Salary, rent, subscriptions — money that moves on a schedule."
      />
      {recurringTxs.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring transactions"
          description="When adding a transaction, toggle 'Recurring' and set an interval to see them here."
        />
      ) : (
        <RecurringList
          transactions={recurringTxs}
          accounts={accountList}
          categories={categoryList}
        />
      )}
    </PageShell>
  )
}
