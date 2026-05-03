import { db } from '@/lib/db'
import { budgets, categories, transactions, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull, gte, lte, or } from 'drizzle-orm'
import { format } from 'date-fns'
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { BudgetForm } from '@/components/budgets/BudgetForm'
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
  AmountBox,
  EmptyState,
  HeaderActionLink,
  PageHeader,
  PageShell,
  SectionHeader,
} from '@/components/shared/quiet-ledger'
import { Gauge, Plus, Target, TrendingDown, WalletCards } from 'lucide-react'

export default async function BudgetsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [userRow, budgetList, categoryList] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
    db.select().from(categories).where(
      and(
        isNull(categories.deletedAt),
        or(eq(categories.userId, userId), isNull(categories.userId)),
      )
    ),
  ])
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  const budgetProgress = await Promise.all(budgetList.map(async (budget) => {
    const period = getBudgetPeriod(budget)
    const periodTxs = await db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      eq(transactions.type, 'expense'),
      isNull(transactions.deletedAt),
      gte(transactions.date, format(period.start, 'yyyy-MM-dd')),
      lte(transactions.date, format(period.end, 'yyyy-MM-dd')),
      ...(budget.categoryId ? [eq(transactions.categoryId, budget.categoryId)] : []),
    ))
    const spent = periodTxs.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
    const amount = Number(budget.amount)
    const allowance = getDailyAllowance(budget, spent)
    const percentage = amount > 0 ? (spent / amount) * 100 : 0
    return { budget, spent, amount, period, allowance, percentage }
  }))

  const totalPlanned = budgetProgress.reduce((sum, item) => sum + item.amount, 0)
  const totalSpent = budgetProgress.reduce((sum, item) => sum + item.spent, 0)
  const remaining = totalPlanned - totalSpent
  const atRiskCount = budgetProgress.filter((item) => item.percentage >= 80).length

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Spending plan"
        title="Budgets"
        description="Give everyday spending a gentle boundary so family money decisions stay visible and low-stress."
        action={
          <Sheet>
            <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
              <Plus className="h-4 w-4 mr-1" />
              Add budget
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>New budget</SheetTitle>
                <SheetDescription>
                  Start with a broad envelope, then narrow it by category when useful.
                </SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <BudgetForm categories={categoryList} defaultCurrency={baseCurrency} />
              </div>
            </SheetContent>
          </Sheet>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{budgetList.length} budgets</span>
          <span>·</span>
          <span>{budgetProgress.length} budget periods active</span>
          <span>·</span>
          <span>{baseCurrency} home currency</span>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <AmountBox
          label="Planned"
          amount={totalPlanned}
          currency={baseCurrency}
          icon={Gauge}
          tone={budgetList.length > 0 ? 'budget' : 'neutral'}
          count="Total active budget boundaries"
        />
        <AmountBox
          label="Spent"
          amount={totalSpent}
          currency={baseCurrency}
          icon={TrendingDown}
          tone={totalSpent > totalPlanned && totalPlanned > 0 ? 'negative' : 'positive'}
          count="Expenses in active budget period windows"
        />
        <AmountBox
          label={remaining >= 0 ? 'Still available' : 'Over planned'}
          amount={Math.abs(remaining)}
          currency={baseCurrency}
          icon={WalletCards}
          tone={remaining < 0 ? 'negative' : atRiskCount > 0 ? 'warning' : 'positive'}
          count={`${atRiskCount} budget${atRiskCount === 1 ? '' : 's'} need attention`}
        />
      </div>

      {budgetList.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Create your first spending envelope"
          description="Start with one area that is easy to recognize, like groceries, eating out, fuel, or school. Ledgerify will compare it with expenses from the current period cycle."
          action={
            <HeaderActionLink href="/transactions" variant="outline">
              Review transactions
            </HeaderActionLink>
          }
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title="Active envelopes"
            description="Progress is calculated from each budget's current period cycle."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {budgetProgress.map(({ budget, spent, allowance }) => (
              <BudgetCard key={budget.id} budget={budget} spent={spent} allowance={allowance} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}
