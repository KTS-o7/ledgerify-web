import { db } from '@/lib/db'
import { transactions, accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { Transaction } from '@/lib/db/schema'

/**
 * Returns live balance for an account:
 * openingBalance + SUM(income) - SUM(expense)
 * Transfers are excluded from balance calculation.
 */
export async function getAccountBalance(accountId: string, userId: string): Promise<number> {
  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), isNull(accounts.deletedAt)))

  if (!account) return 0

  const txs = await db.select().from(transactions)
    .where(and(
      eq(transactions.accountId, accountId),
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ))

  const txBalance = txs.reduce((sum, t) => {
    if (t.type === 'income') return sum + Number(t.amount)
    if (t.type === 'expense') return sum - Number(t.amount)
    return sum
  }, 0)

  return Number(account.openingBalance ?? 0) + txBalance
}

/**
 * Returns transactions sorted ASC by date with a running balance column attached.
 * openingBalance is the account's opening balance.
 */
export function attachRunningBalance(
  txs: Transaction[],
  openingBalance: number
): Array<Transaction & { runningBalance: number }> {
  const sorted = [...txs].sort((a, b) => {
    if (a.date < b.date) return -1
    if (a.date > b.date) return 1
    return 0
  })
  let running = openingBalance
  return sorted.map(t => {
    if (t.type === 'income') running += Number(t.amount)
    else if (t.type === 'expense') running -= Number(t.amount)
    return { ...t, runningBalance: running }
  })
}
