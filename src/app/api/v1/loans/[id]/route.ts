import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { loans } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  await db.update(loans)
    .set({ deletedAt: new Date() })
    .where(and(eq(loans.id, id), eq(loans.userId, auth.userId)))

  revalidatePath('/loans')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/debt-payoff')
  return NextResponse.json({ success: true })
}
