'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, accounts, categories } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function updateProfile(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const schema = z.object({
    name: z.string().min(1),
    defaultCurrency: z.string().length(3),
    timezone: z.string().min(1).refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz })
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid timezone' },
    ),
  })
  const raw = Object.fromEntries(formData)
  const parsed = schema.safeParse({
    ...raw,
    defaultCurrency: String(raw.defaultCurrency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  revalidatePath('/settings/profile')
  revalidatePath('/dashboard')
  revalidatePath('/networth')
  return { success: true }
}

export async function createAccount(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(['bank', 'wallet', 'cash', 'savings']),
    currency: z.string().length(3),
  })
  const raw = Object.fromEntries(formData)
  const parsed = schema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.insert(accounts).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/settings/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/networth')
  revalidatePath('/reports/cash-flow')
  return { success: true }
}

export async function deleteAccount(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  await db.update(accounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, session.user.id)))
  revalidatePath('/settings/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/networth')
  revalidatePath('/reports/cash-flow')
  return { success: true }
}

export async function createCategory(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(['income', 'expense']),
    color: z.string().optional(),
  })
  const raw = Object.fromEntries(formData)
  const parsed = schema.safeParse({
    ...raw,
    color: raw.color || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.insert(categories).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/settings/categories')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/reports/category-breakdown')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  await db.update(categories)
    .set({ deletedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, session.user.id)))
  revalidatePath('/settings/categories')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/reports/category-breakdown')
  return { success: true }
}
