import { db } from '@/lib/db'
import { transactions, accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { Transaction } from '@/lib/db/schema'

export async function getAccountBalance(accountId: string, userId: string): Promise<number> {
  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
  if (!account) return 0

  const txs = await db.select().from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, userId), isNull(transactions.deletedAt)))

  const isCreditCard = account.type === 'credit_card'

  const txBalance = txs.reduce((sum, t) => {
    if (isCreditCard) {
      if (t.type === 'expense') return sum + Number(t.amount)
      if (t.type === 'credit_payment') return sum - Number(t.amount)
      return sum
    } else {
      if (t.type === 'income') return sum + Number(t.amount)
      if (t.type === 'expense') return sum - Number(t.amount)
      if (t.type === 'credit_payment') return sum - Number(t.amount)
      // transfer: deduct from this account (the receiving side is a separate income tx)
      if (t.type === 'transfer') return sum - Number(t.amount)
      return sum
    }
  }, 0)

  return Number(account.openingBalance ?? 0) + txBalance
}

export function attachRunningBalance(
  txs: Transaction[],
  openingBalance: number,
  isCreditCard = false
): Array<Transaction & { runningBalance: number }> {
  const sorted = [...txs].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  let running = openingBalance
  return sorted.map(t => {
    if (isCreditCard) {
      if (t.type === 'expense') running += Number(t.amount)
      else if (t.type === 'credit_payment') running -= Number(t.amount)
    } else {
      if (t.type === 'income') running += Number(t.amount)
      else if (t.type === 'expense') running -= Number(t.amount)
      else if (t.type === 'credit_payment') running -= Number(t.amount)
      else if (t.type === 'transfer') running -= Number(t.amount)
    }
    return { ...t, runningBalance: running }
  })
}
