import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { isNull, or, eq } from 'drizzle-orm'
import { CategoriesClient } from '@/components/settings/CategoriesClient'

export default async function CategoriesPage() {
  const session = await auth()
  const userId = session!.user!.id!

  // Fetch user-owned categories and system categories (userId IS NULL)
  const allCategories = await db.select().from(categories)
    .where(or(eq(categories.userId, userId), isNull(categories.userId)))

  const active = allCategories.filter(c => !c.deletedAt)
  const incomeCategories = active.filter(c => c.type === 'income')
  const expenseCategories = active.filter(c => c.type === 'expense')

  return (
    <CategoriesClient
      incomeCategories={incomeCategories}
      expenseCategories={expenseCategories}
      userId={userId}
    />
  )
}
