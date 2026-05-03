import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { insurancePolicies } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { insuranceSchema } from '@/lib/validations/insurance'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(insurancePolicies)
    .where(and(eq(insurancePolicies.userId, auth.userId), isNull(insurancePolicies.deletedAt)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = insuranceSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const d = parsed.data
  const [row] = await db.insert(insurancePolicies).values({
    userId: auth.userId,
    name: d.name,
    provider: d.provider || null,
    policyType: d.policyType,
    premiumAmount: String(d.premiumAmount),
    premiumFrequency: d.premiumFrequency,
    coverageAmount: d.coverageAmount != null ? String(d.coverageAmount) : null,
    currency: d.currency,
    startDate: d.startDate,
    endDate: d.endDate || null,
    renewalDate: d.renewalDate || null,
    nominee: d.nominee || null,
    notes: d.notes || null,
  }).returning()

  revalidatePath('/insurance')
  revalidatePath('/dashboard')
  return NextResponse.json(row, { status: 201 })
}
