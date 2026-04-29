import { db } from '@/lib/db'
import { savingsGoals, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { and, eq, isNull } from 'drizzle-orm'
import { GoalCard } from '@/components/budgets/GoalCard'
import { SavingsGoalForm } from '@/components/budgets/SavingsGoalForm'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  EmptyState,
  FinancialAmount,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
} from '@/components/shared/quiet-ledger'
import { Flag, PiggyBank, Plus, Sparkles, Target } from 'lucide-react'

export default async function SavingsGoalsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [userRow, goalList] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.userId, userId), isNull(savingsGoals.deletedAt))),
  ])

  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'
  const activeGoals = goalList.filter((goal) => goal.status === 'active')
  const achievedGoals = goalList.filter((goal) => goal.status === 'achieved')
  const totalTarget = goalList.reduce((sum, goal) => sum + Number(goal.targetAmount), 0)
  const totalSaved = goalList.reduce((sum, goal) => sum + Number(goal.currentAmount), 0)
  const nextDeadline = activeGoals
    .filter((goal) => goal.deadline)
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))[0]

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Future plans"
        title="Savings goals"
        description="Track the money you are setting aside for family priorities, protection, and the things worth planning for."
        action={
          <Sheet>
            <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
              <Plus className="h-4 w-4 mr-1" />
              Add goal
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>New savings goal</SheetTitle>
                <SheetDescription>
                  Give the goal a name, target, and optional deadline. Contributions
                  can be recorded from the goal card.
                </SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <SavingsGoalForm defaultCurrency={baseCurrency} />
              </div>
            </SheetContent>
          </Sheet>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{activeGoals.length} active</span>
          <span>·</span>
          <span>{achievedGoals.length} achieved</span>
          <span>·</span>
          <span>{baseCurrency} home currency</span>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Saved"
          value={<FinancialAmount amount={totalSaved} currency={baseCurrency} sign="never" />}
          description="Total progress recorded across all goals."
          icon={PiggyBank}
          tone={totalSaved > 0 ? 'positive' : 'neutral'}
        />
        <MetricCard
          label="Targets"
          value={<FinancialAmount amount={totalTarget} currency={baseCurrency} sign="never" />}
          description="Money assigned to future plans."
          icon={Target}
          tone={goalList.length > 0 ? 'primary' : 'neutral'}
        />
        <MetricCard
          label="Next milestone"
          value={nextDeadline?.deadline ? new Date(nextDeadline.deadline).toLocaleDateString() : 'None'}
          description={nextDeadline ? nextDeadline.name : 'Add a deadline to make progress easier to pace.'}
          icon={Flag}
          tone={nextDeadline ? 'info' : 'neutral'}
        />
      </div>

      {goalList.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Create a goal worth protecting"
          description="Start with an emergency fund, a family trip, a school expense, or any future plan that deserves a clear target."
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title="Goal progress"
            description="Contribute from each card and Ledgerify will mark goals achieved when the target is met."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {goalList.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}
