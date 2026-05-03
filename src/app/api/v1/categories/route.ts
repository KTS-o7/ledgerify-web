import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(categories)
    .where(and(
      isNull(categories.deletedAt),
      or(eq(categories.userId, auth.userId), isNull(categories.userId)),
    ))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const [row] = await db.insert(categories)
    .values({ ...parsed.data, userId: auth.userId })
    .returning()

  revalidatePath('/settings/categories')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/reports/category-breakdown')
  return NextResponse.json(row, { status: 201 })
}
