'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { loans, loanPayments } from '@/lib/db/schema'
import { loanSchema, loanPaymentSchema } from '@/lib/validations/loan'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createLoan(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData)
  const parsed = loanSchema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  await db.insert(loans).values({
    userId: session.user.id,
    name: d.name,
    loanType: d.loanType,
    principal: String(d.principal),
    interestRate: String(d.interestRate),
    tenureMonths: d.tenureMonths,
    startDate: d.startDate,
    emiAmount: String(d.emiAmount),
    currency: d.currency,
    outstandingBalance: String(d.principal),
  })

  revalidatePath('/loans')
  return { success: true }
}

export async function recordLoanPayment(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = loanPaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const existing = await db.select().from(loans)
    .where(and(eq(loans.id, parsed.data.loanId), eq(loans.userId, session.user.id), isNull(loans.deletedAt)))
    .limit(1)
  if (!existing.length) return { error: 'Loan not found' }

  const d = parsed.data
  await db.insert(loanPayments).values({
    loanId: d.loanId,
    date: d.date,
    amount: String(d.amount),
    principalComponent: d.principalComponent != null ? String(d.principalComponent) : null,
    interestComponent: d.interestComponent != null ? String(d.interestComponent) : null,
    status: d.status,
  })

  // update outstanding balance
  const loan = existing[0]
  const newBalance = Math.max(0, Number(loan.outstandingBalance ?? loan.principal) - (d.principalComponent ?? 0))
  await db.update(loans)
    .set({ outstandingBalance: String(newBalance), updatedAt: new Date() })
    .where(eq(loans.id, d.loanId))

  revalidatePath('/loans')
  return { success: true }
}

export async function deleteLoan(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  await db.update(loans)
    .set({ deletedAt: new Date() })
    .where(and(eq(loans.id, id), eq(loans.userId, session.user.id)))

  revalidatePath('/loans')
  return { success: true }
}
