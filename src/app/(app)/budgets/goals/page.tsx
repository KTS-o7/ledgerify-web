import { db } from '@/lib/db'
import { savingsGoals } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { GoalCard } from '@/components/budgets/GoalCard'
import { SavingsGoalForm } from '@/components/budgets/SavingsGoalForm'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Plus } from 'lucide-react'

export default async function SavingsGoalsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const goalList = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.userId, userId), isNull(savingsGoals.deletedAt)))

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <Sheet>
          <SheetTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Savings Goal</SheetTitle>
            </SheetHeader>
            <div className="mt-4 px-4">
              <SavingsGoalForm />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {goalList.length === 0 ? (
        <p className="text-muted-foreground text-sm">No savings goals yet. Add one to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goalList.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  )
}
