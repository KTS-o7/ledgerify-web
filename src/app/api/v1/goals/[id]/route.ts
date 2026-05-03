import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { savingsGoals } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const row = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.id, id), eq(savingsGoals.userId, auth.userId), isNull(savingsGoals.deletedAt)),
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  await db.update(savingsGoals)
    .set({ deletedAt: new Date() })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, auth.userId)))

  revalidatePath('/budgets/goals')
  revalidatePath('/dashboard')
  return NextResponse.json({ success: true })
}
