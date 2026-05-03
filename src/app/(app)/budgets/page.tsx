import { db } from '@/lib/db'
import { budgets, categories, transactions, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull, gte, lte, or } from 'drizzle-orm'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns'
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

  const [userRow, budgetList, monthlyTxs, weeklyTxs, categoryList] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
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
    db.select().from(categories).where(
      and(
        isNull(categories.deletedAt),
        or(eq(categories.userId, userId), isNull(categories.userId)),
      )
    ),
  ])
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  const budgetProgress = budgetList.map((budget) => {
    const txs = budget.periodType === 'monthly' ? monthlyTxs : weeklyTxs
    const spent = computeSpent(budget, txs)
    const amount = Number(budget.amount)
    const percentage = amount > 0 ? (spent / amount) * 100 : 0
    return { budget, spent, amount, percentage }
  })

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
          <span>{monthlyTxs.length + weeklyTxs.length} expense entries in scope</span>
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
          count="Expenses in weekly and monthly windows"
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
          description="Start with one area that is easy to recognize, like groceries, eating out, fuel, or school. Ledgerify will compare it with expenses from the current week or month."
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
            description="Progress is calculated from current weekly or monthly expenses."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {budgetProgress.map(({ budget, spent }) => (
              <BudgetCard key={budget.id} budget={budget} spent={spent} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}
