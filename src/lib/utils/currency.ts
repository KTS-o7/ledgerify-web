import { db } from '@/lib/db'
import { exchangeRates } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function getRate(base: string, target: string): Promise<number> {
  if (base === target) return 1
  const row = await db.query.exchangeRates.findFirst({
    where: and(eq(exchangeRates.base, base), eq(exchangeRates.target, target)),
  })
  return row ? Number(row.rate) : 1
}

// Re-export for server-side consumers that import from this module
export { formatCurrency } from '@/lib/utils/format'
