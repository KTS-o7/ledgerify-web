'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { insurancePolicies, insurancePayments } from '@/lib/db/schema'
import { insuranceSchema, insurancePaymentSchema } from '@/lib/validations/insurance'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createPolicy(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData)
  const parsed = insuranceSchema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  await db.insert(insurancePolicies).values({
    userId: session.user.id,
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
  })

  revalidatePath('/insurance')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function recordPremiumPayment(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = insurancePaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const existing = await db.select().from(insurancePolicies)
    .where(and(
      eq(insurancePolicies.id, parsed.data.policyId),
      eq(insurancePolicies.userId, session.user.id),
      isNull(insurancePolicies.deletedAt),
    ))
    .limit(1)
  if (!existing.length) return { error: 'Policy not found' }

  const d = parsed.data
  await db.insert(insurancePayments).values({
    policyId: d.policyId,
    date: d.date,
    amount: String(d.amount),
    status: d.status,
  })

  revalidatePath('/insurance')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePolicy(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  await db.update(insurancePolicies)
    .set({ deletedAt: new Date() })
    .where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, session.user.id)))

  revalidatePath('/insurance')
  revalidatePath('/dashboard')
  return { success: true }
}
