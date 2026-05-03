import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { insurancePolicies, insurancePayments } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { insurancePaymentSchema } from '@/lib/validations/insurance'
import { revalidatePath } from 'next/cache'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const parsed = insurancePaymentSchema.safeParse({ ...body, policyId: id })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const existing = await db.select().from(insurancePolicies)
    .where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, auth.userId), isNull(insurancePolicies.deletedAt)))
    .limit(1)
  if (!existing.length) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })

  const d = parsed.data
  const [payment] = await db.insert(insurancePayments).values({
    policyId: id,
    date: d.date,
    amount: String(d.amount),
    status: d.status,
  }).returning()

  revalidatePath('/insurance')
  revalidatePath('/dashboard')
  return NextResponse.json(payment, { status: 201 })
}
