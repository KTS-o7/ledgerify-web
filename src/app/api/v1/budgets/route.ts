import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { budgets, categories } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { budgetSchema } from '@/lib/validations/budget'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(budgets)
    .where(and(eq(budgets.userId, auth.userId), isNull(budgets.deletedAt)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = budgetSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
    categoryId: body.categoryId || undefined,
    endDate: body.endDate || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const d = parsed.data
  if (d.categoryId) {
    const catCheck = await db.query.categories.findFirst({
      where: and(eq(categories.id, d.categoryId), isNull(categories.deletedAt), or(eq(categories.userId, auth.userId), isNull(categories.userId))),
    })
    if (!catCheck) return NextResponse.json({ error: 'Category not found or not yours' }, { status: 400 })
  }

  const [row] = await db.insert(budgets).values({
    userId: auth.userId,
    name: d.name,
    categoryId: d.categoryId || null,
    amount: String(d.amount),
    currency: d.currency,
    periodType: d.periodType,
    startDate: d.startDate,
    endDate: d.endDate || null,
  }).returning()

  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  revalidatePath('/reports/budget-vs-actual')
  return NextResponse.json(row, { status: 201 })
}
