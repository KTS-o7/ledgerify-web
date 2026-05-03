'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { investments, investmentTransactions } from '@/lib/db/schema'
import { investmentSchema, investmentTxSchema } from '@/lib/validations/investment'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createInvestment(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData)
  const parsed = investmentSchema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const data = parsed.data
  await db.insert(investments).values({
    userId: session.user.id,
    name: data.name,
    assetType: data.assetType,
    currency: data.currency,
    quantity: data.quantity != null ? String(data.quantity) : null,
    buyPrice: data.buyPrice != null ? String(data.buyPrice) : null,
    currentPrice: data.currentPrice != null ? String(data.currentPrice) : null,
    maturityDate: data.maturityDate || null,
    interestRate: data.interestRate != null ? String(data.interestRate) : null,
  })

  revalidatePath('/investments')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/investment-returns')
  return { success: true }
}

export async function addInvestmentTransaction(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = investmentTxSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // verify ownership
  const inv = await db.select().from(investments)
    .where(and(eq(investments.id, parsed.data.investmentId), eq(investments.userId, session.user.id), isNull(investments.deletedAt)))
    .limit(1)
  if (!inv.length) return { error: 'Not found' }

  const d = parsed.data
  await db.insert(investmentTransactions).values({
    investmentId: d.investmentId,
    type: d.type,
    quantity: d.quantity != null ? String(d.quantity) : null,
    price: d.price != null ? String(d.price) : null,
    amount: String(d.amount),
    date: d.date,
    note: d.note || null,
  })

  revalidatePath(`/investments/${d.investmentId}`)
  return { success: true }
}

export async function updateInvestmentPrice(id: string, currentPrice: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  if (!Number.isFinite(currentPrice) || currentPrice < 0) {
    return { error: 'Price must be a non-negative number' }
  }

  await db.update(investments)
    .set({ currentPrice: String(currentPrice), currentPriceUpdatedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(investments.id, id), eq(investments.userId, session.user.id)))

  revalidatePath('/investments')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/investment-returns')
  return { success: true }
}

export async function deleteInvestment(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  await db.update(investments)
    .set({ deletedAt: new Date() })
    .where(and(eq(investments.id, id), eq(investments.userId, session.user.id)))

  revalidatePath('/investments')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  revalidatePath('/reports/investment-returns')
  return { success: true }
}
