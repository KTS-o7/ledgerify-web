import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  await db.update(categories)
    .set({ deletedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, auth.userId)))

  revalidatePath('/settings/categories')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/reports/category-breakdown')
  return NextResponse.json({ success: true })
}
