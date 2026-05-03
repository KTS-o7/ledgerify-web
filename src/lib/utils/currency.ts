import { db } from '@/lib/db'
import { exchangeRates } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function getRate(base: string, target: string): Promise<number> {
  if (base === target) return 1

  // Try direct pair first (e.g. INR → USD stored by cron)
  const direct = await db.query.exchangeRates.findFirst({
    where: and(eq(exchangeRates.base, base), eq(exchangeRates.target, target)),
  })
  if (direct) return Number(direct.rate)

  // Try inverse pair (e.g. asked for USD → INR, cron stored INR → USD)
  const inverse = await db.query.exchangeRates.findFirst({
    where: and(eq(exchangeRates.base, target), eq(exchangeRates.target, base)),
  })
  if (inverse && Number(inverse.rate) !== 0) return 1 / Number(inverse.rate)

  return 1 // unknown pair — caller should treat as same-currency
}

// Re-export for server-side consumers that import from this module
export { formatCurrency } from '@/lib/utils/format'
