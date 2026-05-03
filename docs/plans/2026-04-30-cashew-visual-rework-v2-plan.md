# Cashew Visual Rework v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform every app surface into a Cashew-inspired widget-style UI while adding `accounts.currentBalance` for fast balance reads.

**Architecture:** One PR on branch `feat/cashew-visual-rework-v2`. Schema first, then dashboard, transactions, planning, wealth/obligations, reports, import. Each task is a focused Edit followed by a verify+commit. No backend domain logic changes. No extra DB tables.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Tailwind v4, shadcn/ui base-ui, Recharts, Bun, Zod v4, Auth.js v5

**Key rules:**
- Use `Edit` tool in small chunks — never rewrite whole files at once
- Run `bunx tsc --noEmit && bun run lint` after every task
- Run `bun run build` after every segment (tasks grouped below)
- All money stored as strings in DB, cast with `Number()` when computing
- shadcn uses base-ui render prop: `<SheetTrigger render={<Button />}>`
- `formatCurrency` → `src/lib/utils/format.ts` (client-safe)
- `getRate` → `src/lib/utils/currency.ts` (server-only)

## Segment 2: Dashboard Widgets

### Task 4: Extend dashboard loader + add QuickAddStrip component

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/dashboard/QuickAddStrip.tsx`

**Step 1: Add budget + savings goal queries to dashboard loader**

In `src/app/(app)/dashboard/page.tsx`, add imports:

```ts
import { budgets, savingsGoals } from "@/lib/db/schema";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
```

Add to the `Promise.all` array:

```ts
// budgets
db.select().from(budgets).where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
// savings goals
db.select().from(savingsGoals).where(and(eq(savingsGoals.userId, userId), isNull(savingsGoals.deletedAt))),
// monthly expenses (for budget progress)
db.select().from(transactions).where(and(
  eq(transactions.userId, userId),
  eq(transactions.type, 'expense'),
  isNull(transactions.deletedAt),
  gte(transactions.date, monthStart),
  lte(transactions.date, monthEnd),
)),
```

Destructure the new entries from the result array.

**Step 2: Create `QuickAddStrip` component**

Create `src/components/dashboard/QuickAddStrip.tsx`:

```tsx
import Link from "next/link"
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  { label: "Expense", href: "/transactions?type=expense", icon: ArrowDownLeft, color: "bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900" },
  { label: "Income",  href: "/transactions?type=income",  icon: ArrowUpRight,  color: "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" },
  { label: "Transfer",href: "/transactions?type=transfer",icon: ArrowLeftRight, color: "bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900" },
]

export function QuickAddStrip() {
  return (
    <div className="flex gap-3">
      {actions.map(({ label, href, icon: Icon, color }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
            color,
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </div>
  )
}
```

**Step 3: Add `QuickAddStrip` import + usage in dashboard page**

In `src/app/(app)/dashboard/page.tsx`, import and pass it as a new `quickAdd` prop to `DashboardSections`.

**Step 4: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 5: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx src/components/dashboard/QuickAddStrip.tsx
git commit -m "feat(dashboard): extend loader with budgets/goals, add QuickAddStrip"
```

---

### Task 5: Build `BalanceSnapshotWidget` (replaces `NetworthCard`)

**Files:**
- Modify: `src/components/dashboard/NetworthCard.tsx`

**Step 1: Rewrite `NetworthCard` to widget style**

Replace the entire component body with:

```tsx
"use client"
import Link from "next/link"
import { Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react"
import type { NetworthData } from "@/lib/utils/networth"
import { FinancialAmount, IconBadge, ProgressMeter, StatusPill, TonalWidget, WidgetHeading } from "@/components/shared/quiet-ledger"
import { cn } from "@/lib/utils"

interface Props extends NetworthData { currency: string }

const quickLinks = [
  { label: "Net Worth",    href: "/networth",     icon: PiggyBank  },
  { label: "Investments",  href: "/investments",  icon: TrendingUp },
  { label: "Loans",        href: "/loans",        icon: Landmark   },
  { label: "Accounts",     href: "/settings/accounts", icon: WalletCards },
]

export function NetworthCard({ networth, totalCash, totalInvestments, totalLiabilities, currency }: Props) {
  const totalAssets = totalCash + totalInvestments
  const safe = Math.max(totalAssets, 1)
  const cashPct = Math.min((totalCash / safe) * 100, 100)
  const invPct  = Math.min((totalInvestments / safe) * 100, 100)
  const liabRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0
  const tone = networth > 0 ? "positive" : networth < 0 ? "negative" : "neutral"

  return (
    <TonalWidget tone="primary" className="space-y-5">
      <WidgetHeading
        icon={PiggyBank} tone="primary"
        eyebrow="Balance snapshot"
        title="Net worth"
        description="Assets minus liabilities."
        action={<StatusPill tone={tone}>{networth > 0 ? "Positive" : networth < 0 ? "Deficit" : "Starting out"}</StatusPill>}
      />

      {/* Hero number */}
      <div className="rounded-3xl border bg-background/75 px-5 py-4 shadow-sm shadow-foreground/5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total net worth</p>
        <p className="financial-display mt-1 text-4xl font-extrabold sm:text-5xl">
          <FinancialAmount amount={networth} currency={currency} />
        </p>
      </div>

      {/* Asset chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cash", amount: totalCash, pct: cashPct, tone: "cash" as const, icon: WalletCards },
          { label: "Investments", amount: totalInvestments, pct: invPct, tone: "investment" as const, icon: TrendingUp },
          { label: "Liabilities", amount: totalLiabilities, pct: Math.min(liabRatio * 100, 100), tone: liabRatio > 0.5 ? "negative" as const : "loan" as const, icon: Landmark },
        ].map(({ label, amount, pct, tone: t, icon: Icon }) => (
          <div key={label} className="space-y-2 rounded-2xl border bg-background/60 p-3">
            <IconBadge icon={Icon} tone={t} className="size-8 rounded-xl" />
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-bold tabular-nums"><FinancialAmount amount={amount} currency={currency} /></p>
            <ProgressMeter value={pct} tone={t} label="" />
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        {quickLinks.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground">
            <Icon className="size-3.5" />
            {label}
          </Link>
        ))}
      </div>
    </TonalWidget>
  )
}
```

**Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 3: Commit**

```bash
git add src/components/dashboard/NetworthCard.tsx
git commit -m "feat(dashboard): BalanceSnapshotWidget with hero number + asset chips"
```

---

### Task 6: Build `DailyMoneyWidget` (replaces `CashFlowSummary`)

**Files:**
- Modify: `src/components/dashboard/CashFlowSummary.tsx`

**Step 1: Rewrite `CashFlowSummary` with month progress + insight copy**

Key additions vs current: month progress bar, plain-language insight sentence, compact layout.

```tsx
"use client"
import { getDaysInMonth } from "date-fns"
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, WalletCards } from "lucide-react"
import type { Transaction } from "@/lib/db/schema"
import { AmountBox, ProgressMeter, StatusPill, TonalWidget, WidgetHeading } from "@/components/shared/quiet-ledger"

interface Props { transactions: Transaction[]; currency: string }

export function CashFlowSummary({ transactions, currency }: Props) {
  const income  = transactions.filter(t => t.type === "income" ).reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
  const net = income - expense
  const expensePace = income > 0 ? Math.min((expense / income) * 100, 100) : 0
  const netTone = net > 0 ? "positive" : net < 0 ? "negative" : "neutral"

  // Month progress
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = getDaysInMonth(now)
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100)

  // Insight
  const insight = income === 0
    ? "Add income transactions to track your monthly cash flow."
    : net > 0
      ? `Spending is below income this month — ${Math.round(expensePace)}% of income spent so far.`
      : `Expenses are ahead of income this month by ${Math.abs(Math.round(net)).toLocaleString()} ${currency}.`

  return (
    <TonalWidget tone="cash" className="space-y-5">
      <WidgetHeading
        icon={WalletCards} tone="cash"
        eyebrow="Month in motion"
        title="Cash flow"
        description={insight}
        action={<StatusPill tone={netTone}>{net > 0 ? "Ahead" : net < 0 ? "Behind" : "Balanced"}</StatusPill>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AmountBox label="Income"   amount={income}   currency={currency} icon={ArrowUpRight}  tone="positive" count="Received this month" />
        <AmountBox label="Expenses" amount={expense}  currency={currency} icon={ArrowDownLeft} tone="negative" count="Spent this month" />
        <AmountBox label="Net"      amount={net}      currency={currency} icon={ArrowLeftRight} tone={netTone} sign="always" count="Income minus expenses" />
      </div>

      <div className="space-y-3 rounded-3xl border bg-background/70 p-4">
        <ProgressMeter value={expensePace} tone={expensePace > 85 ? "warning" : "positive"} label="Expense pace vs income" />
        <ProgressMeter value={monthProgress} tone="info" label={`Month progress — day ${dayOfMonth} of ${daysInMonth}`} />
      </div>
    </TonalWidget>
  )
}
```

**Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 3: Commit**

```bash
git add src/components/dashboard/CashFlowSummary.tsx
git commit -m "feat(dashboard): DailyMoneyWidget with month progress + insight copy"
```

---

### Task 7: Build `PlanningWidgets` component

**Files:**
- Create: `src/components/dashboard/PlanningWidgets.tsx`

**Step 1: Create the component**

```tsx
"use client"
import Link from "next/link"
import { Target, Wallet } from "lucide-react"
import type { Budget, SavingsGoal, Transaction } from "@/lib/db/schema"
import { AmountBox, FinancialAmount, IconBadge, ProgressMeter, StatusPill, TonalWidget, WidgetHeading } from "@/components/shared/quiet-ledger"

interface Props {
  budgets: Budget[]
  goals: SavingsGoal[]
  monthlyExpenses: Transaction[]
  currency: string
}

export function PlanningWidgets({ budgets, goals, monthlyExpenses, currency }: Props) {
  // Budget health
  const budgetProgress = budgets.map(b => {
    const relevant = b.categoryId
      ? monthlyExpenses.filter(t => t.categoryId === b.categoryId)
      : monthlyExpenses
    const spent = relevant.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
    const limit = Number(b.amount)
    const pct = limit > 0 ? (spent / limit) * 100 : 0
    return { ...b, spent, limit, pct }
  })
  const totalBudgetLimit = budgetProgress.reduce((s, b) => s + b.limit, 0)
  const totalBudgetSpent = budgetProgress.reduce((s, b) => s + b.spent, 0)
  const overCount  = budgetProgress.filter(b => b.pct >= 100).length
  const watchCount = budgetProgress.filter(b => b.pct >= 70 && b.pct < 100).length
  const safeCount  = budgetProgress.filter(b => b.pct < 70).length
  const overallBudgetPct = totalBudgetLimit > 0 ? Math.min((totalBudgetSpent / totalBudgetLimit) * 100, 100) : 0

  // Goals health
  const totalGoalTarget  = goals.reduce((s, g) => s + Number(g.targetAmount), 0)
  const totalGoalCurrent = goals.reduce((s, g) => s + Number(g.currentAmount ?? 0), 0)
  const goalPct = totalGoalTarget > 0 ? Math.min((totalGoalCurrent / totalGoalTarget) * 100, 100) : 0
  const achievedCount = goals.filter(g => Number(g.currentAmount ?? 0) >= Number(g.targetAmount)).length

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Budget health tile */}
      <TonalWidget tone="budget" className="space-y-4">
        <WidgetHeading icon={Wallet} tone="budget" eyebrow="Planning" title="Budget health" />
        {budgets.length === 0 ? (
          <Link href="/budgets" className="block text-sm text-muted-foreground hover:underline">Set up your first budget →</Link>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {safeCount  > 0 && <StatusPill tone="positive">{safeCount} safe</StatusPill>}
              {watchCount > 0 && <StatusPill tone="warning">{watchCount} watch</StatusPill>}
              {overCount  > 0 && <StatusPill tone="negative">{overCount} over</StatusPill>}
            </div>
            <ProgressMeter value={overallBudgetPct} tone={overCount > 0 ? "negative" : watchCount > 0 ? "warning" : "positive"} label="Total spent vs budget" />
            <p className="text-xs text-muted-foreground">
              <FinancialAmount amount={totalBudgetSpent} currency={currency} /> of{" "}
              <FinancialAmount amount={totalBudgetLimit} currency={currency} /> budgeted
            </p>
          </>
        )}
      </TonalWidget>

      {/* Goal progress tile */}
      <TonalWidget tone="goal" className="space-y-4">
        <WidgetHeading icon={Target} tone="goal" eyebrow="Planning" title="Savings goals" />
        {goals.length === 0 ? (
          <Link href="/budgets/goals" className="block text-sm text-muted-foreground hover:underline">Set up your first goal →</Link>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="neutral">{goals.length} goal{goals.length !== 1 ? "s" : ""}</StatusPill>
              {achievedCount > 0 && <StatusPill tone="positive">{achievedCount} achieved</StatusPill>}
            </div>
            <ProgressMeter value={goalPct} tone="goal" label="Overall progress" />
            <p className="text-xs text-muted-foreground">
              <FinancialAmount amount={totalGoalCurrent} currency={currency} /> of{" "}
              <FinancialAmount amount={totalGoalTarget} currency={currency} /> saved
            </p>
          </>
        )}
      </TonalWidget>
    </div>
  )
}
```

**Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 3: Commit**

```bash
git add src/components/dashboard/PlanningWidgets.tsx
git commit -m "feat(dashboard): PlanningWidgets — budget health + goal progress tiles"
```

---

### Task 8: Add `planning` slot to `DashboardSections` + wire everything in dashboard page

**Files:**
- Modify: `src/components/dashboard/DashboardSections.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Add `planning` and `quickAdd` to `DashboardSections`**

- Add `planning` and `quickAdd` to `defaultVisibility`, `sectionLabels`, and the props interface.
- Add `{visibility.quickAdd && quickAdd}` between setup and snapshot.
- Add `{visibility.planning && planning}` between cashFlow and attention.

**Step 2: Update dashboard page to import and pass new components**

Import `QuickAddStrip` and `PlanningWidgets`. Pass them:

```tsx
<DashboardSections
  setup={...}
  snapshot={<NetworthCard {...networthData} currency={baseCurrency} />}
  quickAdd={<QuickAddStrip />}
  basics={...}
  cashFlow={<CashFlowSummary transactions={monthlyTxs} currency={baseCurrency} />}
  planning={<PlanningWidgets budgets={budgetList} goals={goalList} monthlyExpenses={monthlyExpenses} currency={baseCurrency} />}
  recent={<RecentTransactions transactions={recentTxs} />}
  attention={<UpcomingAlerts loans={loanList} policies={policyList} />}
/>
```

**Step 3: Build verify**

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardSections.tsx src/app/(app)/dashboard/page.tsx
git commit -m "feat(dashboard): wire QuickAddStrip + PlanningWidgets into DashboardSections"
```

---

---

## Segment 1: Schema + Networth

### Task 1: Add `currentBalance` to accounts schema

**Files:**
- Modify: `src/lib/db/schema/accounts.ts`
- Create: `drizzle/0001_accounts_current_balance.sql`

**Step 1: Add column to Drizzle schema**

In `src/lib/db/schema/accounts.ts`, add import for `numeric` and add the column:

```ts
import { pgTable, uuid, varchar, timestamp, pgEnum, numeric } from 'drizzle-orm/pg-core'
// ...existing code...
export const accounts = pgTable('accounts', {
  // ...existing columns...
  currentBalance: numeric('current_balance').notNull().default('0'),
})
```

**Step 2: Write the migration SQL**

Create `drizzle/0001_accounts_current_balance.sql`:

```sql
ALTER TABLE "accounts" ADD COLUMN "current_balance" numeric NOT NULL DEFAULT 0;
```

**Step 3: Apply migration on VPS**

```bash
# locally — verify schema compiles
bunx tsc --noEmit
bun run lint
```

On VPS after deploy:
```bash
docker exec ledgerify-db psql -U ledgerify -d ledgerify -c \
  "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0;"
```

**Step 4: Commit**

```bash
git checkout -b feat/cashew-visual-rework-v2
git add src/lib/db/schema/accounts.ts drizzle/0001_accounts_current_balance.sql
git commit -m "feat(schema): add currentBalance to accounts"
```

---

### Task 2: Update transaction server actions to maintain `currentBalance`

**Files:**
- Modify: `src/app/actions/transactions.ts`
- Modify: `src/lib/db/schema/accounts.ts` (already done — just importing it)

**Context:** `createTransaction`, `updateTransaction`, `deleteTransaction` must update `accounts.currentBalance` after each write. Income adds, expense subtracts, transfer moves between accounts.

**Step 1: Add accounts import to transactions action**

In `src/app/actions/transactions.ts` add `accounts` to the schema import:

```ts
import { transactions, transactionTags, users, accounts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
```

**Step 2: Add helper `adjustBalance` inside the file (after imports, before `normalizeOptionalTransactionFields`)**

```ts
async function adjustBalance(accountId: string, type: string, amount: number, sign: 1 | -1) {
  const delta = type === 'income' ? amount * sign : type === 'expense' ? -amount * sign : 0
  if (delta === 0) return
  await db.update(accounts)
    .set({ currentBalance: sql`current_balance + ${String(delta)}` })
    .where(eq(accounts.id, accountId))
}
```

**Step 3: Call `adjustBalance` in `createTransaction` after the insert**

After `const [tx] = await db.insert(transactions)...returning()`, add:

```ts
await adjustBalance(data.accountId, data.type, data.amount, 1)
if (data.type === 'transfer' && data.transferToId) {
  await adjustBalance(data.transferToId, 'income', data.amount, 1)
}
```

**Step 4: Call `adjustBalance` in `deleteTransaction` — reverse the effect**

Before the soft-delete update, fetch the transaction first, then reverse:

```ts
const [existing] = await db.select().from(transactions)
  .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id!)))
if (existing) {
  await adjustBalance(existing.accountId, existing.type, Number(existing.amount), -1)
  if (existing.type === 'transfer' && existing.transferToId) {
    await adjustBalance(existing.transferToId, 'income', Number(existing.amount), -1)
  }
}
```

**Step 5: Call `adjustBalance` in `updateTransaction` — reverse old, apply new**

Before the update, fetch old transaction. After update, adjust both old and new balances.

**Step 6: Verify**

```bash
bunx tsc --noEmit
bun run lint
```

**Step 7: Commit**

```bash
git add src/app/actions/transactions.ts
git commit -m "feat(actions): maintain account currentBalance on transaction write"
```

---

### Task 3: Simplify `computeNetworth` to use `currentBalance`

**Files:**
- Modify: `src/lib/utils/networth.ts`

**Step 1: Replace the per-account transaction sum loop**

Current code loops over accounts and runs a SQL aggregate per account. Replace with:

```ts
// 3. Account cash balances — use maintained currentBalance field
const accountRows = await db.select().from(accounts)
  .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))

let totalCash = 0
for (const account of accountRows) {
  const rate = await getRate(account.currency, baseCurrency)
  totalCash += Number(account.currentBalance) * rate
}
```

Remove the `sql` import if no longer needed.

**Step 2: Verify**

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

**Step 3: Commit**

```bash
git add src/lib/utils/networth.ts
git commit -m "perf(networth): use account.currentBalance instead of transaction sum"
```

---

## Segment 3: Transactions

### Task 9: Add summary strip + segmented control to TransactionList

**Files:**
- Modify: `src/components/transactions/TransactionList.tsx`

**Step 1: Add a `TransactionSummaryStrip` block at the top of the rendered list**

Inside `TransactionList` (client component), compute from the currently filtered `filtered` array and render three `AmountBox`-style tiles above the list. Add these derivations right before the return:

```tsx
const summaryIncome  = filtered.filter(t => t.type === 'income' ).reduce((s,t) => s + Number(t.convertedAmount ?? t.amount), 0)
const summaryExpense = filtered.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.convertedAmount ?? t.amount), 0)
const summaryNet     = summaryIncome - summaryExpense
```

Render a strip above the date-grouped list:

```tsx
<div className="grid grid-cols-3 gap-3">
  <AmountBox label="Income"   amount={summaryIncome}  currency={baseCurrency} icon={ArrowUpRight}  tone="positive" count="" />
  <AmountBox label="Expenses" amount={summaryExpense} currency={baseCurrency} icon={ArrowDownLeft} tone="negative" count="" />
  <AmountBox label="Net"      amount={summaryNet}     currency={baseCurrency} icon={ArrowLeftRight} tone={summaryNet >= 0 ? 'positive' : 'negative'} sign="always" count="" />
</div>
```

Import `AmountBox` from `@/components/shared/quiet-ledger` and the three icons from `lucide-react`.

**Step 2: Replace type filter chips with a segmented control**

Find the existing filter chip row (renders `All`, `Income`, `Expenses`, `Transfers` chips). Replace it with a single segmented control div:

```tsx
<div className="flex rounded-2xl border bg-muted/50 p-1 gap-1">
  {(['all','income','expense','transfer'] as const).map(t => (
    <button
      key={t}
      type="button"
      onClick={() => setTypeFilter(t)}
      className={cn(
        'flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition',
        typeFilter === t
          ? 'bg-background shadow-sm text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
    </button>
  ))}
</div>
```

**Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 4: Commit**

```bash
git add src/components/transactions/TransactionList.tsx
git commit -m "feat(transactions): summary strip + segmented type control"
```

---

### Task 10: Add category glyph + overflow delete to transaction rows

**Files:**
- Modify: `src/components/transactions/TransactionList.tsx`

**Step 1: Add `CategoryGlyph` inline helper**

At the top of the file, add a small helper component:

```tsx
function CategoryGlyph({ name, tone }: { name?: string; tone: 'positive' | 'negative' | 'info' }) {
  const colors = {
    positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    negative: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    info:     'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  }
  const letter = name ? name[0].toUpperCase() : '?'
  return (
    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold', colors[tone])}>
      {letter}
    </div>
  )
}
```

**Step 2: Update each transaction row to use `CategoryGlyph`**

In the row render, replace the current `IconBadge` with:

```tsx
<CategoryGlyph
  name={categoryMap[transaction.categoryId ?? ''] ?? transaction.type}
  tone={transaction.type === 'income' ? 'positive' : transaction.type === 'expense' ? 'negative' : 'info'}
/>
```

Where `categoryMap` is a `Record<string,string>` built from the `categories` prop passed to `TransactionList`.

**Step 3: Move delete into an overflow menu**

Replace the visible delete button on each row with a `DropdownMenu`:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:bg-muted">
      <MoreHorizontal className="size-4" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(transaction.id)}>
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Import `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` from `@/components/ui/dropdown-menu` and `MoreHorizontal` from `lucide-react`.

**Step 4: Update row secondary line**

Change the secondary text line below the note to show category and account:

```tsx
<p className="mt-0.5 text-xs text-muted-foreground truncate">
  {categoryMap[transaction.categoryId ?? ''] ?? '—'} · {accountMap[transaction.accountId] ?? '—'} · {transaction.date}
</p>
```

**Step 5: Verify**

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

**Step 6: Commit**

```bash
git add src/components/transactions/TransactionList.tsx
git commit -m "feat(transactions): category glyph, overflow delete, richer row metadata"
```

---

## Segment 4: Budgets & Goals

### Task 11: Rework `BudgetCard` to progress-first surface

**Files:**
- Modify: `src/components/budgets/BudgetCard.tsx`

**Step 1: Rewrite card body**

Replace the current card with a layout that leads with spent/limit fraction and a colored progress bar. Key elements:

- Budget name + period badge (Monthly / Weekly)
- Category name if present
- Large fraction: `₹spent / ₹limit`
- Colored `ProgressMeter`: emerald < 70%, amber 70–99%, rose ≥ 100%
- Status badge: `Safe` / `Watch` / `Over`
- Days remaining line

```tsx
const pct     = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
const barTone = pct >= 100 ? 'negative' : pct >= 70 ? 'warning' : 'positive'
const status  = pct >= 100 ? 'Over'     : pct >= 70 ? 'Watch'    : 'Safe'
const statusTone = pct >= 100 ? 'negative' : pct >= 70 ? 'warning' : 'positive'
```

Use `TonalWidget tone="budget"` as the card wrapper. Use `ProgressMeter`, `StatusPill`, `FinancialAmount` from `quiet-ledger`.

**Step 2: Add health summary strip to budgets page**

In `src/app/(app)/budgets/page.tsx`, above the budget card grid, add:

```tsx
<div className="flex flex-wrap gap-3">
  <AmountBox label="Total budgeted" amount={totalBudgetLimit} currency={baseCurrency} icon={Wallet} tone="budget" count={`${budgetList.length} budget${budgetList.length !== 1 ? 's' : ''}`} />
  <AmountBox label="Total spent"    amount={totalBudgetSpent} currency={baseCurrency} icon={TrendingDown} tone={overCount > 0 ? 'negative' : 'positive'} count={`${safeCount} safe · ${watchCount} watch · ${overCount} over`} />
</div>
```

Compute `totalBudgetLimit`, `totalBudgetSpent`, `overCount`, `watchCount`, `safeCount` from `budgetProgress` array already computed in the page.

**Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 4: Commit**

```bash
git add src/components/budgets/BudgetCard.tsx src/app/(app)/budgets/page.tsx
git commit -m "feat(budgets): progress-first BudgetCard + health summary strip"
```

---

### Task 12: Rework `GoalCard` to motivating progress surface

**Files:**
- Modify: `src/components/budgets/GoalCard.tsx`

**Step 1: Rewrite card body**

Lead with goal name + deadline pressure, then current/target fraction, then teal progress bar, then contribute button.

```tsx
const pct       = target > 0 ? Math.min((current / target) * 100, 100) : 0
const achieved  = current >= target
const daysLeft  = deadline ? differenceInDays(new Date(deadline), new Date()) : null
const pressure  = achieved ? 'Achieved!' : daysLeft === null ? null : daysLeft <= 0 ? 'Past deadline' : `${daysLeft} days left`
const pressureTone = achieved ? 'positive' : daysLeft !== null && daysLeft <= 7 ? 'negative' : daysLeft !== null && daysLeft <= 30 ? 'warning' : 'neutral'
```

Use `TonalWidget tone="goal"` wrapper, `ProgressMeter tone="goal"`, `StatusPill` for pressure, `FinancialAmount` for amounts.

**Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

**Step 3: Commit**

```bash
git add src/components/budgets/GoalCard.tsx
git commit -m "feat(goals): motivating GoalCard with deadline pressure + teal progress"
```

---

## Segment 5: Wealth & Obligations

### Task 13: Add `PortfolioSummaryWidget` to investments page

**Files:**
- Modify: `src/app/(app)/investments/page.tsx`

**Step 1: Add a portfolio summary widget above the asset grid**

The page already computes `totalInvested`, `totalCurrent`, `totalPnL`, `totalPnLPct`. Wrap them in a `TonalWidget tone="investment"` with `WidgetHeading` and three `AmountBox` tiles:

```tsx
<TonalWidget tone="investment" className="space-y-4">
  <WidgetHeading icon={TrendingUp} tone="investment" eyebrow="Portfolio" title="Overview" />
  <div className="grid gap-3 sm:grid-cols-3">
    <AmountBox label="Current value" amount={totalCurrent}  currency={baseCurrency} icon={TrendingUp} tone="investment" count="At current prices" />
    <AmountBox label="Cost basis"    amount={totalInvested} currency={baseCurrency} icon={WalletCards} tone="neutral"    count="Total invested" />
    <AmountBox label="Unrealised P&L" amount={totalPnL}    currency={baseCurrency} icon={totalPnL >= 0 ? ArrowUpRight : ArrowDownLeft} tone={totalPnL >= 0 ? 'positive' : 'negative'} sign="always" count={`${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(1)}% return`} />
  </div>
</TonalWidget>
```

Import `AmountBox`, `TonalWidget`, `WidgetHeading` from `@/components/shared/quiet-ledger` and needed icons.

**Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 3: Commit**

```bash
git add src/app/(app)/investments/page.tsx
git commit -m "feat(investments): PortfolioSummaryWidget with P&L"
```

---

### Task 14: Add `DebtSummaryWidget` to loans page + payoff progress on `LoanCard`

**Files:**
- Modify: `src/app/(app)/loans/page.tsx`
- Modify: `src/components/loans/LoanCard.tsx`

**Step 1: Add debt summary widget to loans page**

The page already has `totalOutstanding` and `totalEmi`. Wrap them:

```tsx
<TonalWidget tone="loan" className="space-y-4">
  <WidgetHeading icon={Landmark} tone="loan" eyebrow="Obligations" title="Debt overview" />
  <div className="grid gap-3 sm:grid-cols-3">
    <AmountBox label="Outstanding" amount={totalOutstanding} currency={summaryCurrency} icon={Landmark}   tone="loan"    count={`${loanList.length} active loan${loanList.length !== 1 ? 's' : ''}`} />
    <AmountBox label="Monthly EMI" amount={totalEmi}         currency={summaryCurrency} icon={CreditCard} tone="warning" count="Total EMI this month" />
    <AmountBox label="Avg interest" amount={avgInterest}    currency=""                icon={TrendingDown} tone="neutral" count="Weighted avg rate %" />
  </div>
</TonalWidget>
```

Compute `avgInterest` as `loanList.reduce((s,l) => s + Number(l.interestRate), 0) / Math.max(loanList.length, 1)`.

**Step 2: Add payoff progress bar to `LoanCard`**

In `src/components/loans/LoanCard.tsx`, compute payoff progress:

```tsx
const principal    = Number(loan.principal)
const outstanding  = Number(loan.outstandingBalance ?? principal)
const paidPct      = principal > 0 ? Math.min(((principal - outstanding) / principal) * 100, 100) : 0
const monthsLeft   = loan.emiAmount && Number(loan.emiAmount) > 0
  ? Math.ceil(outstanding / Number(loan.emiAmount))
  : null
```

Render a `ProgressMeter tone="positive"` and a `{monthsLeft} months remaining` label at the bottom of the card.

**Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 4: Commit**

```bash
git add src/app/(app)/loans/page.tsx src/components/loans/LoanCard.tsx
git commit -m "feat(loans): DebtSummaryWidget + payoff progress on LoanCard"
```

---

### Task 15: Add `CoverageSummaryWidget` to insurance page + renewal urgency on `PolicyCard`

**Files:**
- Modify: `src/app/(app)/insurance/page.tsx`
- Modify: `src/components/insurance/PolicyCard.tsx`

**Step 1: Add coverage summary widget**

The page already computes `totalAnnualPremium` and `expiringCount`. Add `totalCoverage`:

```tsx
const totalCoverage = policies.reduce((s, p) => s + Number(p.coverageAmount ?? 0), 0)
```

Render:

```tsx
<TonalWidget tone="insurance" className="space-y-4">
  <WidgetHeading icon={ShieldCheck} tone="insurance" eyebrow="Protection" title="Coverage overview" />
  <div className="grid gap-3 sm:grid-cols-3">
    <AmountBox label="Total coverage"    amount={totalCoverage}      currency={summaryCurrency} icon={ShieldCheck}  tone="insurance" count={`${policies.length} active polic${policies.length !== 1 ? 'ies' : 'y'}`} />
    <AmountBox label="Annual premium"    amount={totalAnnualPremium} currency={summaryCurrency} icon={CreditCard}   tone="neutral"   count="Total yearly cost" />
    <AmountBox label="Renewing soon"     amount={expiringCount}      currency=""                icon={CalendarClock} tone={expiringCount > 0 ? 'warning' : 'positive'} count="Policies due in 30 days" />
  </div>
</TonalWidget>
```

**Step 2: Add renewal urgency state to `PolicyCard`**

In `src/components/insurance/PolicyCard.tsx`, compute days until renewal and use `StatusPill` with the urgency tone (≤7 negative, ≤30 warning, else info).

**Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

**Step 4: Commit**

```bash
git add src/app/(app)/insurance/page.tsx src/components/insurance/PolicyCard.tsx
git commit -m "feat(insurance): CoverageSummaryWidget + renewal urgency on PolicyCard"
```

---

## Segment 6: Reports & Import

### Task 16: Standardise chart containers + add insight copy to each report page

**Files:**
- Modify: `src/app/(app)/reports/cash-flow/page.tsx`
- Modify: `src/app/(app)/reports/category-breakdown/page.tsx`
- Modify: `src/app/(app)/reports/investment-returns/page.tsx`
- Modify: `src/app/(app)/reports/debt-payoff/page.tsx`
- Modify: `src/app/(app)/reports/budget-vs-actual/page.tsx`

**Step 1: Add a `ReportSummaryStrip` above each chart**

For each report page, add 2–3 `AmountBox` tiles (or metric chips) derived from the already-loaded data. Examples:

- **Cash flow**: avg monthly income, avg monthly expenses, net trend direction
- **Category breakdown**: top category name + amount, total categories with spend
- **Investment returns**: total P&L, best performer name
- **Debt payoff**: total outstanding, projected months to clear
- **Budget vs actual**: total over-budget count, total under-budget savings

Render the strip as:

```tsx
<div className="grid gap-3 sm:grid-cols-3">
  <AmountBox ... />
  <AmountBox ... />
  <AmountBox ... />
</div>
```

**Step 2: Add one plain-language insight sentence per report**

Derive from the data, render as a `TonalWidget tone="info"` banner just below the summary strip:

```tsx
<div className="rounded-2xl border bg-sky-50/80 px-4 py-3 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
  {insightText}
</div>
```

Example for cash flow: `"Expenses have exceeded income in 2 of the last 6 months."`

**Step 3: Standardise Recharts chart containers**

In all chart components (`CashFlowChart`, `CategoryPieChart`, `BudgetActualChart`):
- Add `className="rounded-3xl border bg-card/80 p-4"` wrapper div
- Set `CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10"`
- Set `radius={[4,4,0,0]}` on `Bar` elements
- Set chart container height: `height={300}` on mobile, `height={380}` on `sm:` via a responsive wrapper

**Step 4: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

**Step 5: Commit**

```bash
git add src/app/(app)/reports src/components/reports
git commit -m "feat(reports): summary strips, insight copy, standardised chart containers"
```

---

### Task 17: Rework import page to guided 3-step flow

**Files:**
- Modify: `src/app/(app)/import/page.tsx`

**Step 1: Add a step indicator at the top**

Replace the current two-card side-by-side layout with a linear 3-step flow. Add a step state:

```tsx
const [step, setStep] = useState<1 | 2 | 3>(1)
```

Render a simple step pill row:

```tsx
<div className="flex gap-2">
  {[1,2,3].map(s => (
    <div key={s} className={cn(
      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
      step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
    )}>{s}</div>
  ))}
</div>
```

**Step 2: Step 1 — Choose file**

Show a drag-drop zone (`TonalWidget tone="info"`) with the file input and a template download link. On file selected, move to step 2.

**Step 3: Step 2 — Review required columns**

Parse the first line of the CSV client-side to extract detected column headers. Show a checklist of required columns (`date`, `amount`, `type`, `accountId`) with a check or cross per column. Provide a "Back" button and a "Looks good, import" button that triggers the upload and moves to step 3.

**Step 4: Step 3 — Result**

Show the existing result panel (imported count, errors). Add a "Import another file" button that resets to step 1.

**Step 5: Verify**

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

**Step 6: Commit**

```bash
git add src/app/(app)/import/page.tsx
git commit -m "feat(import): guided 3-step flow with column review"
```

---

## Segment 7: Final Verification + PR

### Task 18: Full build + VPS migration verify

**Step 1: Run full validation**

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

Expected: zero errors, zero lint warnings, successful build output.

**Step 2: Push branch + open PR**

```bash
git push -u origin feat/cashew-visual-rework-v2
gh pr create \
  --title "feat: Cashew Visual Rework v2" \
  --body "$(cat <<'EOF'
## Summary

- Adds `accounts.currentBalance` schema column — maintained by transaction actions, eliminates per-account SQL aggregation in networth
- Dashboard: BalanceSnapshotWidget, DailyMoneyWidget, QuickAddStrip, PlanningWidgets (budget health + goal progress tiles)
- Transactions: summary strip, segmented control, category glyphs, overflow delete, richer row metadata
- Budgets: progress-first BudgetCard + health summary strip
- Goals: motivating GoalCard with deadline pressure + teal progress bar
- Investments: PortfolioSummaryWidget with P&L
- Loans: DebtSummaryWidget + payoff progress on LoanCard
- Insurance: CoverageSummaryWidget + renewal urgency on PolicyCard
- Reports: summary strips, insight copy, standardised chart containers
- Import: guided 3-step flow with column review

## Schema change

One migration: `ALTER TABLE accounts ADD COLUMN current_balance NUMERIC NOT NULL DEFAULT 0`

Apply on VPS after deploy:
\`\`\`bash
docker exec ledgerify-db psql -U ledgerify -d ledgerify -c \
  "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0;"
\`\`\`

## No backend/domain logic changes

All changes are UI-only except the schema column and its maintenance in transaction actions.
EOF
)"
```

**Step 3: Apply migration on VPS after merge**

After CI passes and PR is merged:

```bash
ssh deploy@192.3.228.223 \
  "docker exec ledgerify-db psql -U ledgerify -d ledgerify -c \
   'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0;'"
```

---

## Quick reference — key file paths

| Area | File |
|---|---|
| Schema | `src/lib/db/schema/accounts.ts` |
| Migration | `drizzle/0001_accounts_current_balance.sql` |
| Transaction actions | `src/app/actions/transactions.ts` |
| Networth util | `src/lib/utils/networth.ts` |
| Design primitives | `src/components/shared/quiet-ledger.tsx` |
| Dashboard page | `src/app/(app)/dashboard/page.tsx` |
| DashboardSections | `src/components/dashboard/DashboardSections.tsx` |
| NetworthCard | `src/components/dashboard/NetworthCard.tsx` |
| CashFlowSummary | `src/components/dashboard/CashFlowSummary.tsx` |
| QuickAddStrip | `src/components/dashboard/QuickAddStrip.tsx` (new) |
| PlanningWidgets | `src/components/dashboard/PlanningWidgets.tsx` (new) |
| TransactionList | `src/components/transactions/TransactionList.tsx` |
| BudgetCard | `src/components/budgets/BudgetCard.tsx` |
| GoalCard | `src/components/budgets/GoalCard.tsx` |
| Investments page | `src/app/(app)/investments/page.tsx` |
| LoanCard | `src/components/loans/LoanCard.tsx` |
| Loans page | `src/app/(app)/loans/page.tsx` |
| PolicyCard | `src/components/insurance/PolicyCard.tsx` |
| Insurance page | `src/app/(app)/insurance/page.tsx` |
| Report pages | `src/app/(app)/reports/*/page.tsx` |
| Chart components | `src/components/reports/*.tsx` |
| Import page | `src/app/(app)/import/page.tsx` |

