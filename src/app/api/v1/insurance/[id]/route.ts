import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { insurancePolicies } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const row = await db.query.insurancePolicies.findFirst({
    where: and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, auth.userId), isNull(insurancePolicies.deletedAt)),
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
  await db.update(insurancePolicies)
    .set({ deletedAt: new Date() })
    .where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, auth.userId)))

  revalidatePath('/insurance')
  revalidatePath('/dashboard')
  return NextResponse.json({ success: true })
}
