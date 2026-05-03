import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { investments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  await db.update(investments)
    .set({ deletedAt: new Date() })
    .where(and(eq(investments.id, id), eq(investments.userId, auth.userId)))

  revalidatePath('/investments')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/investment-returns')
  return NextResponse.json({ success: true })
}
