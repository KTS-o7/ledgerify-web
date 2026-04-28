import { db } from '@/lib/db'
import { budgets, transactions } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull, gte, lte } from 'drizzle-orm'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { BudgetForm } from '@/components/budgets/BudgetForm'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Plus } from 'lucide-react'
import type { Budget, Transaction } from '@/lib/db/schema'

function computeSpent(budget: Budget, txs: Transaction[]): number {
  const relevant = budget.categoryId
    ? txs.filter((t) => t.categoryId === budget.categoryId)
    : txs
  return relevant.reduce((sum, t) => sum + Number(t.convertedAmount ?? t.amount), 0)
}

export default async function BudgetsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [budgetList, monthlyTxs, weeklyTxs] = await Promise.all([
    db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          isNull(transactions.deletedAt),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
        ),
      ),
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          isNull(transactions.deletedAt),
          gte(transactions.date, weekStart),
          lte(transactions.date, weekEnd),
        ),
      ),
  ])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <Sheet>
          <SheetTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Budget</SheetTitle>
            </SheetHeader>
            <div className="mt-4 px-4">
              <BudgetForm />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {budgetList.length === 0 ? (
        <p className="text-muted-foreground text-sm">No budgets yet. Add one to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgetList.map((budget) => {
            const txs = budget.periodType === 'monthly' ? monthlyTxs : weeklyTxs
            const spent = computeSpent(budget, txs)
            return <BudgetCard key={budget.id} budget={budget} spent={spent} />
          })}
        </div>
      )}
    </div>
  )
}
