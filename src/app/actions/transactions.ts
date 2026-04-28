'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, transactionTags, users } from '@/lib/db/schema'
import { transactionSchema } from '@/lib/validations/transaction'
import { getRate } from '@/lib/utils/currency'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createTransaction(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData)
  const parsed = transactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { tagIds, ...data } = parsed.data

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  const baseCurrency = user?.defaultCurrency ?? 'INR'
  const rate = await getRate(data.currency, baseCurrency)

  const [tx] = await db.insert(transactions).values({
    ...data,
    userId: session.user.id,
    amount: String(data.amount),
    convertedAmount: String(data.amount * rate),
    baseCurrency,
    isRecurring: data.isRecurring ?? false,
  }).returning()

  if (tagIds) {
    const ids = tagIds.split(',').filter(Boolean)
    if (ids.length > 0) {
      await db.insert(transactionTags).values(
        ids.map(tagId => ({ transactionId: tx.id, tagId }))
      )
    }
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true, id: tx.id }
}

export async function updateTransaction(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const id = formData.get('id') as string
  if (!id) return { error: 'Missing id' }

  const raw = Object.fromEntries(formData)
  const parsed = transactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { tagIds, ...data } = parsed.data

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  const baseCurrency = user?.defaultCurrency ?? 'INR'
  const rate = await getRate(data.currency, baseCurrency)

  await db.update(transactions)
    .set({
      ...data,
      amount: String(data.amount),
      convertedAmount: String(data.amount * rate),
      baseCurrency,
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)))

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  await db.update(transactions)
    .set({ deletedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)))

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}
