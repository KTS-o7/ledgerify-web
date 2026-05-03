import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { investments } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { investmentSchema } from '@/lib/validations/investment'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(investments)
    .where(and(eq(investments.userId, auth.userId), isNull(investments.deletedAt)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = investmentSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const data = parsed.data
  const [row] = await db.insert(investments).values({
    userId: auth.userId,
    name: data.name,
    assetType: data.assetType,
    currency: data.currency,
    quantity: data.quantity != null ? String(data.quantity) : null,
    buyPrice: data.buyPrice != null ? String(data.buyPrice) : null,
    currentPrice: data.currentPrice != null ? String(data.currentPrice) : null,
    maturityDate: data.maturityDate || null,
    interestRate: data.interestRate != null ? String(data.interestRate) : null,
  }).returning()

  revalidatePath('/investments')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/investment-returns')
  return NextResponse.json(row, { status: 201 })
}
