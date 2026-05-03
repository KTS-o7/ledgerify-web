import { db } from '@/lib/db'
import { transactions, investments, loans, accounts } from '@/lib/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { getRate } from './currency'

export interface NetworthData {
  networth: number
  totalCash: number
  totalInvestments: number
  totalLiabilities: number
}

export async function computeNetworth(userId: string, baseCurrency: string): Promise<NetworthData> {
  // 1. Investment current value
  const invRows = await db.select().from(investments)
    .where(and(eq(investments.userId, userId), isNull(investments.deletedAt)))

  let totalInvestments = 0
  for (const inv of invRows) {
    const rate = await getRate(inv.currency, baseCurrency)
    const price = Number(inv.currentPrice ?? inv.buyPrice ?? 0)
    const qty = Number(inv.quantity ?? 1)
    totalInvestments += price * qty * rate
  }

  // 2. Outstanding loan liabilities
  const loanRows = await db.select().from(loans)
    .where(and(eq(loans.userId, userId), isNull(loans.deletedAt)))

  let totalLiabilities = 0
  for (const loan of loanRows) {
    const rate = await getRate(loan.currency, baseCurrency)
    totalLiabilities += Number(loan.outstandingBalance ?? 0) * rate
  }

  // 3. Account balances — openingBalance + transaction deltas
  //    Credit cards: outstanding is a liability (not cash)
  const accountRows = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))

  let totalCash = 0
  for (const account of accountRows) {
    const isCreditCard = account.type === 'credit_card'
    const rate = await getRate(account.currency, baseCurrency)

    const result = await db
      .select({
        txBalance: sql<string>`
          COALESCE(
            SUM(CASE
              WHEN ${transactions.type} = 'income'          THEN  ${transactions.amount}::numeric
              WHEN ${transactions.type} = 'expense'         THEN -(${transactions.amount}::numeric)
              WHEN ${transactions.type} = 'credit_payment'  THEN -(${transactions.amount}::numeric)
              WHEN ${transactions.type} = 'transfer'        THEN -(${transactions.amount}::numeric)
              ELSE 0
            END), 0
          )`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.accountId, account.id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ))

    const txBalance = Number(result[0]?.txBalance ?? 0)
    const openingBalance = Number(account.openingBalance ?? 0)

    if (isCreditCard) {
      // Credit card: openingBalance = initial outstanding debt
      // expenses add to debt, credit_payments reduce it
      const creditOutstanding = openingBalance
        + txBalance * -1  // txBalance already negates expenses via CASE above, flip back
      // Actually recompute correctly for credit cards:
      const ccResult = await db
        .select({
          outstanding: sql<string>`
            COALESCE(
              SUM(CASE
                WHEN ${transactions.type} = 'expense'        THEN  ${transactions.amount}::numeric
                WHEN ${transactions.type} = 'credit_payment' THEN -(${transactions.amount}::numeric)
                ELSE 0
              END), 0
            )`,
        })
        .from(transactions)
        .where(and(
          eq(transactions.accountId, account.id),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ))
      const outstanding = openingBalance + Number(ccResult[0]?.outstanding ?? 0)
      totalLiabilities += Math.max(0, outstanding) * rate
    } else if (account.type === 'investment') {
      // Investment accounts: openingBalance + transaction credits count as investments
      const balance = openingBalance + txBalance
      totalInvestments += balance * rate
    } else {
      const balance = openingBalance + txBalance
      totalCash += balance * rate
    }
  }

  return {
    networth: totalCash + totalInvestments - totalLiabilities,
    totalCash,
    totalInvestments,
    totalLiabilities,
  }
}
