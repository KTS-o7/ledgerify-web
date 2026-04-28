'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, accounts, categories } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function updateProfile(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const schema = z.object({
    name: z.string().min(1),
    defaultCurrency: z.string().length(3),
    timezone: z.string().min(1),
  })
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  revalidatePath('/settings/profile')
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
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.insert(accounts).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/settings/accounts')
  return { success: true }
}

export async function deleteAccount(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  await db.update(accounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, session.user.id)))
  revalidatePath('/settings/accounts')
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
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.insert(categories).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/settings/categories')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  await db.update(categories)
    .set({ deletedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, session.user.id)))
  revalidatePath('/settings/categories')
  return { success: true }
}
