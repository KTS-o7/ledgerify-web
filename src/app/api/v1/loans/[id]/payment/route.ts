import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { loans, loanPayments } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { loanPaymentSchema } from '@/lib/validations/loan'
import { revalidatePath } from 'next/cache'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const parsed = loanPaymentSchema.safeParse({ ...body, loanId: id })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const existing = await db.select().from(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, auth.userId), isNull(loans.deletedAt)))
    .limit(1)
  if (!existing.length) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const d = parsed.data
  const [payment] = await db.insert(loanPayments).values({
    loanId: id,
    date: d.date,
    amount: String(d.amount),
    principalComponent: d.principalComponent != null ? String(d.principalComponent) : null,
    interestComponent: d.interestComponent != null ? String(d.interestComponent) : null,
    status: d.status,
  }).returning()

  const loan = existing[0]
  const newBalance = Math.max(0, Number(loan.outstandingBalance ?? loan.principal) - (d.principalComponent ?? 0))
  await db.update(loans)
    .set({ outstandingBalance: String(newBalance), updatedAt: new Date() })
    .where(and(eq(loans.id, id), eq(loans.userId, auth.userId)))

  revalidatePath('/loans')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/debt-payoff')
  return NextResponse.json(payment, { status: 201 })
}
