import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exchangeRates } from '@/lib/db/schema'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED', 'CAD', 'AUD']

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = `https://api.frankfurter.app/latest?base=INR&symbols=${CURRENCIES.join(',')}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`frankfurter returned ${res.status}`)
    const data = await res.json() as { rates: Record<string, number> }

    let updated = 0
    for (const [target, rate] of Object.entries(data.rates)) {
      await db
        .insert(exchangeRates)
        .values({ base: 'INR', target, rate: String(rate), fetchedAt: new Date() })
        .onConflictDoUpdate({
          target: [exchangeRates.base, exchangeRates.target],
          set: { rate: String(rate), fetchedAt: new Date() },
        })
      updated++
    }

    return NextResponse.json({ updated, base: 'INR', currencies: CURRENCIES })
  } catch (e) {
    // Return 200 so cron doesn't alarm — cached rates still work
    return NextResponse.json({ error: String(e), usingCached: true })
  }
}
