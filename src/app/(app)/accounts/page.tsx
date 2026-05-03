import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getAccountBalance } from '@/lib/utils/accountBalance'
import { AccountCard } from '@/components/accounts/AccountCard'
import { PageHeader, PageShell, EmptyState } from '@/components/shared/quiet-ledger'
import { WalletCards } from 'lucide-react'

export default async function AccountsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const accountList = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))

  const accountsWithBalance = await Promise.all(
    accountList.map(async (a) => ({
      ...a,
      balance: await getAccountBalance(a.id, userId),
    }))
  )

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Your money"
        title="Accounts"
        description="Each account's live balance is computed from all transactions plus opening balance."
      />
      {accountList.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="No accounts yet"
          description="Go to Settings → Accounts to add your first account."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accountsWithBalance.map(a => <AccountCard key={a.id} account={a} />)}
        </div>
      )}
    </PageShell>
  )
}
