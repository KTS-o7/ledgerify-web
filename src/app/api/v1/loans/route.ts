import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { loans } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { loanSchema } from '@/lib/validations/loan'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(loans)
    .where(and(eq(loans.userId, auth.userId), isNull(loans.deletedAt)))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = loanSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const d = parsed.data
  const [row] = await db.insert(loans).values({
    userId: auth.userId,
    name: d.name,
    loanType: d.loanType,
    principal: String(d.principal),
    interestRate: String(d.interestRate),
    tenureMonths: d.tenureMonths,
    startDate: d.startDate,
    emiAmount: String(d.emiAmount),
    currency: d.currency,
    outstandingBalance: String(d.principal),
  }).returning()

  revalidatePath('/loans')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/debt-payoff')
  return NextResponse.json(row, { status: 201 })
}
