import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { savingsGoals, accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { savingsGoalSchema } from '@/lib/validations/budget'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(savingsGoals)
    .where(and(eq(savingsGoals.userId, auth.userId), isNull(savingsGoals.deletedAt)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = savingsGoalSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
    description: body.description || undefined,
    linkedAccountId: body.linkedAccountId || undefined,
    deadline: body.deadline || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const d = parsed.data
  if (d.linkedAccountId) {
    const acctCheck = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, d.linkedAccountId), eq(accounts.userId, auth.userId), isNull(accounts.deletedAt)),
    })
    if (!acctCheck) return NextResponse.json({ error: 'Account not found or not yours' }, { status: 400 })
  }

  const [row] = await db.insert(savingsGoals).values({
    userId: auth.userId,
    name: d.name,
    description: d.description || null,
    targetAmount: String(d.targetAmount),
    currency: d.currency,
    linkedAccountId: d.linkedAccountId || null,
    deadline: d.deadline || null,
  }).returning()

  revalidatePath('/budgets/goals')
  revalidatePath('/dashboard')
  return NextResponse.json(row, { status: 201 })
}
