import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { AccountsClient } from '@/components/settings/AccountsClient'

export default async function AccountsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const accountList = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))

  return <AccountsClient accountList={accountList} />
}
