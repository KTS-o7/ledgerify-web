import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'wallet', 'cash', 'savings']),
  currency: z.string().length(3),
})

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(accounts)
    .where(and(eq(accounts.userId, auth.userId), isNull(accounts.deletedAt)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = createSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const [row] = await db.insert(accounts)
    .values({ ...parsed.data, userId: auth.userId })
    .returning()

  revalidatePath('/settings/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/networth')
  revalidatePath('/reports/cash-flow')
  return NextResponse.json(row, { status: 201 })
}
