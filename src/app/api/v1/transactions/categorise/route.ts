import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { transactions, categoryKeywords } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/**
 * POST /api/v1/transactions/categorise
 * Applies auto-categorisation to ALL transactions that have no categoryId.
 * Uses the user's category_keywords rules.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  // Load all keywords for user
  const keywords = await db.select().from(categoryKeywords)
    .where(eq(categoryKeywords.userId, auth.userId))

  if (keywords.length === 0) return NextResponse.json({ updated: 0, message: 'No keywords configured' })

  // Load all uncategorised transactions
  const uncategorised = await db.select().from(transactions)
    .where(and(
      eq(transactions.userId, auth.userId),
      isNull(transactions.categoryId),
      isNull(transactions.deletedAt),
    ))

  let updated = 0
  for (const txn of uncategorised) {
    const title = (txn.title || txn.note || '').toLowerCase()
    if (!title) continue

    const match = keywords.find(kw => title.includes(kw.keyword.toLowerCase()))
    if (match) {
      await db.update(transactions)
        .set({ categoryId: match.categoryId })
        .where(eq(transactions.id, txn.id))
      updated++
    }
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/reports/category-breakdown')
  revalidatePath('/budgets')
  return NextResponse.json({ updated, total: uncategorised.length })
}
