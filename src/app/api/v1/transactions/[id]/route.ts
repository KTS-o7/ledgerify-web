import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { transactions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  await db.update(transactions)
    .set({ deletedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, auth.userId)))

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/reports/cash-flow')
  revalidatePath('/reports/category-breakdown')
  revalidatePath('/reports/budget-vs-actual')
  revalidatePath('/networth')
  revalidatePath('/budgets')
  return NextResponse.json({ success: true })
}
