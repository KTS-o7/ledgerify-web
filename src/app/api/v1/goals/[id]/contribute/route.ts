import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { savingsGoals } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const schema = z.object({ amount: z.number().positive() })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { amount } = parsed.data

  const rows = await db.select().from(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, auth.userId), isNull(savingsGoals.deletedAt)))
    .limit(1)
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const goal = rows[0]
  if (goal.status === 'achieved') return NextResponse.json({ error: 'Goal already achieved' }, { status: 400 })

  const newAmount = Number(goal.currentAmount) + amount
  const isAchieved = newAmount >= Number(goal.targetAmount)

  const [row] = await db.update(savingsGoals)
    .set({ currentAmount: String(newAmount), status: isAchieved ? 'achieved' : 'active', updatedAt: new Date() })
    .where(eq(savingsGoals.id, id))
    .returning()

  revalidatePath('/budgets/goals')
  revalidatePath('/dashboard')
  return NextResponse.json(row)
}
