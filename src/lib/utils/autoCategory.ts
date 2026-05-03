import { db } from '@/lib/db'
import { categoryKeywords } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Given a transaction title and userId, returns the best matching categoryId or null.
 * Case-insensitive substring match. First match wins (ordered by createdAt ascending).
 */
export async function matchCategory(title: string, userId: string): Promise<string | null> {
  if (!title?.trim()) return null

  const keywords = await db.select().from(categoryKeywords)
    .where(eq(categoryKeywords.userId, userId))

  const lower = title.toLowerCase()
  for (const kw of keywords) {
    if (lower.includes(kw.keyword.toLowerCase())) {
      return kw.categoryId
    }
  }
  return null
}
