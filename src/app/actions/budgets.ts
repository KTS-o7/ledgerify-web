'use server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { budgets, savingsGoals, categories, accounts } from '@/lib/db/schema'
import { budgetSchema, savingsGoalSchema } from '@/lib/validations/budget'
import { eq, and, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createBudget(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData)
  const parsed = budgetSchema.safeParse({
    ...raw,
    categoryId: raw.categoryId || undefined,
    endDate: raw.endDate || undefined,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data

  // Verify categoryId is current-user-owned or system
  if (d.categoryId) {
    const catCheck = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, d.categoryId),
        isNull(categories.deletedAt),
        or(eq(categories.userId, session.user.id), isNull(categories.userId)),
      ),
    });
    if (!catCheck) return { error: 'Category not found or not yours' }
  }

  await db.insert(budgets).values({
    userId: session.user.id,
    name: d.name,
    categoryId: d.categoryId || null,
    amount: String(d.amount),
    currency: d.currency,
    periodType: d.periodType,
    startDate: d.startDate,
    endDate: d.endDate || null,
  })

  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  revalidatePath('/reports/budget-vs-actual')
  return { success: true }
}

export async function deleteBudget(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  await db.update(budgets)
    .set({ deletedAt: new Date() })
    .where(and(eq(budgets.id, id), eq(budgets.userId, session.user.id)))
  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  revalidatePath('/reports/budget-vs-actual')
  return { success: true }
}

export async function createSavingsGoal(_: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData)
  const parsed = savingsGoalSchema.safeParse({
    ...raw,
    description: raw.description || undefined,
    linkedAccountId: raw.linkedAccountId || undefined,
    deadline: raw.deadline || undefined,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data

  if (d.linkedAccountId) {
    const acctCheck = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, d.linkedAccountId),
        eq(accounts.userId, session.user.id),
        isNull(accounts.deletedAt),
      ),
    })
    if (!acctCheck) return { error: 'Account not found or not yours' }
  }

  await db.insert(savingsGoals).values({
    userId: session.user.id,
    name: d.name,
    description: d.description || null,
    targetAmount: String(d.targetAmount),
    currency: d.currency,
    linkedAccountId: d.linkedAccountId || null,
    deadline: d.deadline || null,
  })

  revalidatePath('/budgets/goals')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function contributeToGoal(goalId: string, amount: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be a positive number' }
  }

  const rows = await db.select().from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, session.user.id), isNull(savingsGoals.deletedAt)))
    .limit(1)
  if (!rows.length) return { error: 'Not found' }

  const goal = rows[0]
  if (goal.status === 'achieved') {
    return { error: 'This goal has already been achieved' }
  }
  const newAmount = Number(goal.currentAmount) + amount
  const isAchieved = newAmount >= Number(goal.targetAmount)

  await db.update(savingsGoals)
    .set({
      currentAmount: String(newAmount),
      status: isAchieved ? 'achieved' : 'active',
      updatedAt: new Date(),
    })
    .where(eq(savingsGoals.id, goalId))

  revalidatePath('/budgets/goals')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteSavingsGoal(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  await db.update(savingsGoals)
    .set({ deletedAt: new Date() })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, session.user.id)))
  revalidatePath('/budgets/goals')
  revalidatePath('/dashboard')
  return { success: true }
}
