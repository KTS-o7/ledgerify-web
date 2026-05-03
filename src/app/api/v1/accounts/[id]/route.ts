import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  await db.update(accounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, auth.userId)))

  revalidatePath('/settings/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/networth')
  return NextResponse.json({ success: true })
}
