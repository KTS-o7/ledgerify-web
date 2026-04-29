import {
  PageHeader,
  PageShell,
  SetupChecklist,
} from '@/components/shared/quiet-ledger'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { accounts, categories, transactions, users } from '@/lib/db/schema'
import { and, eq, isNull, or } from 'drizzle-orm'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const userId = session!.user!.id!

  const [userRow, accountList, categoryList, txList] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db
      .select()
      .from(categories)
      .where(or(eq(categories.userId, userId), isNull(categories.userId))),
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .limit(1),
  ])

  const user = userRow[0]
  const activeCategories = categoryList.filter((category) => !category.deletedAt)

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Setup and safety"
        title="Settings"
        description="Keep Ledgerify understandable for you and trusted family members: profile, money containers, category labels, and data export."
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{user?.defaultCurrency ?? 'INR'} home currency</span>
          <span>·</span>
          <span>{accountList.length} accounts</span>
          <span>·</span>
          <span>{activeCategories.length} categories</span>
        </div>
      </PageHeader>

      <SetupChecklist
        items={[
          {
            label: 'Review profile and home currency',
            href: '/settings/profile',
            complete: Boolean(user?.name && user?.defaultCurrency && user?.timezone),
          },
          {
            label: 'Add your first account',
            href: '/settings/accounts',
            complete: accountList.length > 0,
          },
          {
            label: 'Review income and expense categories',
            href: '/settings/categories',
            complete: activeCategories.length > 0,
          },
          {
            label: 'Record your first transaction',
            href: '/transactions',
            complete: txList.length > 0,
          },
        ]}
      />

      <SettingsNav />
      <div>{children}</div>
    </PageShell>
  )
}
