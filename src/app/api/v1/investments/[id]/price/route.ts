import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { investments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const schema = z.object({ currentPrice: z.number().min(0) })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { currentPrice } = parsed.data
  if (!Number.isFinite(currentPrice) || currentPrice < 0) {
    return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
  }

  const [row] = await db.update(investments)
    .set({ currentPrice: String(currentPrice), currentPriceUpdatedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(investments.id, id), eq(investments.userId, auth.userId)))
    .returning()

  revalidatePath('/investments')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/investment-returns')
  return NextResponse.json(row)
}
