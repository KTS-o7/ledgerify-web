# Cashew-Inspired Ledgerify Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Ledgerify's UI and accounting logic to match Cashew's quality — account drill-down, budget period cycles with daily allowance, running balances, recurring transactions, auto-categorisation, and a triage dashboard.

**Architecture:** Evolve the existing Next.js 16 + Drizzle + Postgres stack. Add DB columns/tables via migrations, build new pages and components, port Cashew's calculation logic from Dart to TypeScript.

**Tech Stack:** Next.js 16, Drizzle ORM, Postgres, Recharts (already installed), Tailwind v4, shadcn/ui (Base UI), Lucide icons.

---

## Phase 1 — Schema Migrations

### Task 1: Add `opening_balance` to accounts

**Files:**
- Modify: `src/lib/db/schema/accounts.ts`
- Create: `drizzle/0001_opening_balance.sql`

**Step 1: Edit schema**

In `src/lib/db/schema/accounts.ts`, add after `currency`:
```ts
openingBalance: numeric('opening_balance', { precision: 18, scale: 4 }).notNull().default('0'),
```

**Step 2: Generate and apply migration**
```bash
npm run db:generate
# rename the generated file to 0001_opening_balance.sql
npm run db:migrate
```

**Step 3: Verify**
```bash
ssh personal 'docker compose -f /opt/ledgerify/docker-compose.prod.yml exec -T postgres psql -U ledgerify -d ledgerify -c "\d accounts"'
```
Expected: `opening_balance` column present with default 0.

**Step 4: Commit**
```bash
git add src/lib/db/schema/accounts.ts drizzle/
git commit -m "feat(schema): add opening_balance to accounts"
```

---

### Task 2: Add `title` and improved recurrence fields to transactions

**Files:**
- Modify: `src/lib/db/schema/transactions.ts`

**Step 1: Edit schema** — add after `note`:
```ts
title: varchar('title', { length: 255 }),
recurrenceInterval: numeric('recurrence_interval', { precision: 5, scale: 0 }),
recurrenceUnit: varchar('recurrence_unit', { length: 10 }), // 'day' | 'week' | 'month'
parentRecurringId: uuid('parent_recurring_id'),
```
Keep existing `isRecurring` and `recurrenceRule` — don't remove them yet.

**Step 2: Generate and apply migration**
```bash
npm run db:generate && npm run db:migrate
```

**Step 3: Commit**
```bash
git add src/lib/db/schema/transactions.ts drizzle/
git commit -m "feat(schema): add title + structured recurrence fields to transactions"
```

---

### Task 3: Add `period_anchor_date` and `rollover` to budgets

**Files:**
- Modify: `src/lib/db/schema/budgets.ts`

**Step 1: Edit schema** — add after `periodType`:
```ts
periodAnchorDate: date('period_anchor_date'),  // e.g. "2026-05-01" — the day the period resets
rollover: boolean('rollover').notNull().default(false),
```

**Step 2: Generate and apply migration**
```bash
npm run db:generate && npm run db:migrate
```

**Step 3: Commit**
```bash
git add src/lib/db/schema/budgets.ts drizzle/
git commit -m "feat(schema): add period_anchor_date and rollover to budgets"
```

---

### Task 4: Create `category_keywords` table

**Files:**
- Create: `src/lib/db/schema/categoryKeywords.ts`
- Modify: `src/lib/db/schema/index.ts`

**Step 1: Create file**
```ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'
import { categories } from './categories'

export const categoryKeywords = pgTable('category_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  keyword: varchar('keyword', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CategoryKeyword = typeof categoryKeywords.$inferSelect
```

**Step 2: Export from index**
Add to `src/lib/db/schema/index.ts`:
```ts
export * from './categoryKeywords'
```

**Step 3: Generate and apply**
```bash
npm run db:generate && npm run db:migrate
```

**Step 4: Commit**
```bash
git add src/lib/db/schema/categoryKeywords.ts src/lib/db/schema/index.ts drizzle/
git commit -m "feat(schema): add category_keywords table for auto-categorisation"
```

---

## Phase 2 — Core Logic Utilities

### Task 5: Budget period cycle calculator (`src/lib/utils/budgetPeriod.ts`)

This ports Cashew's `getBudgetDate` Dart logic to TypeScript.

**Files:**
- Create: `src/lib/utils/budgetPeriod.ts`

**Step 1: Create file**
```ts
import { addDays, addMonths, addWeeks, startOfDay, isAfter, differenceInDays } from 'date-fns'
import type { Budget } from '@/lib/db/schema'

export interface BudgetPeriod {
  start: Date
  end: Date
  totalDays: number
  daysElapsed: number
  daysRemaining: number
  progressPct: number  // 0-100 time-elapsed pct
}

export function getBudgetPeriod(budget: Budget, today = new Date()): BudgetPeriod {
  const anchor = budget.periodAnchorDate
    ? startOfDay(new Date(budget.periodAnchorDate))
    : startOfDay(new Date(budget.startDate))

  let periodStart = anchor
  let periodEnd: Date

  if (budget.periodType === 'monthly') {
    while (true) {
      periodEnd = addDays(addMonths(periodStart, 1), -1)
      if (!isAfter(periodStart, today) && !isAfter(today, periodEnd)) break
      if (isAfter(periodStart, today)) {
        periodStart = addMonths(periodStart, -1)
        periodEnd = addDays(addMonths(periodStart, 1), -1)
        break
      }
      periodStart = addMonths(periodStart, 1)
    }
  } else {
    while (true) {
      periodEnd = addDays(addWeeks(periodStart, 1), -1)
      if (!isAfter(periodStart, today) && !isAfter(today, periodEnd)) break
      if (isAfter(periodStart, today)) {
        periodStart = addWeeks(periodStart, -1)
        periodEnd = addDays(addWeeks(periodStart, 1), -1)
        break
      }
      periodStart = addWeeks(periodStart, 1)
    }
  }

  const totalDays = differenceInDays(periodEnd, periodStart) + 1
  const daysElapsed = Math.max(0, differenceInDays(today, periodStart) + 1)
  const daysRemaining = Math.max(0, differenceInDays(periodEnd, today))

  return { start: periodStart, end: periodEnd, totalDays, daysElapsed, daysRemaining,
    progressPct: Math.min(100, (daysElapsed / totalDays) * 100) }
}

export function getDailyAllowance(budget: Budget, spent: number, today = new Date()) {
  const period = getBudgetPeriod(budget, today)
  const remaining = Number(budget.amount) - spent
  const isOverspent = remaining < 0
  return {
    dailyAllowance: period.daysRemaining > 0 ? Math.max(0, remaining / period.daysRemaining) : 0,
    daysRemaining: period.daysRemaining,
    isOverspent,
    overspentBy: isOverspent ? Math.abs(remaining) : 0,
  }
}
```

**Step 2: Commit**
```bash
git add src/lib/utils/budgetPeriod.ts
git commit -m "feat(utils): budget period cycle calculator + daily allowance"
```

---

### Task 6: Account running balance utility (`src/lib/utils/accountBalance.ts`)

**Files:**
- Create: `src/lib/utils/accountBalance.ts`

**Step 1: Create file**
```ts
import { db } from '@/lib/db'
import { transactions, accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { Transaction } from '@/lib/db/schema'

export async function getAccountBalance(accountId: string, userId: string): Promise<number> {
  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
  if (!account) return 0

  const txs = await db.select().from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, userId), isNull(transactions.deletedAt)))

  const txBalance = txs.reduce((sum, t) => {
    if (t.type === 'income') return sum + Number(t.amount)
    if (t.type === 'expense') return sum - Number(t.amount)
    return sum
  }, 0)

  return Number(account.openingBalance ?? 0) + txBalance
}

export function attachRunningBalance(
  txs: Transaction[],
  openingBalance: number
): Array<Transaction & { runningBalance: number }> {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
  let running = openingBalance
  return sorted.map(t => {
    if (t.type === 'income') running += Number(t.amount)
    else if (t.type === 'expense') running -= Number(t.amount)
    return { ...t, runningBalance: running }
  })
}
```

**Step 2: Commit**
```bash
git add src/lib/utils/accountBalance.ts
git commit -m "feat(utils): account live balance + running balance per transaction"
```

---

### Task 7: Auto-categorisation matcher (`src/lib/utils/autoCategory.ts`)

**Files:**
- Create: `src/lib/utils/autoCategory.ts`

**Step 1: Create file**
```ts
import { db } from '@/lib/db'
import { categoryKeywords } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function matchCategory(title: string, userId: string): Promise<string | null> {
  if (!title) return null
  const keywords = await db.select().from(categoryKeywords).where(eq(categoryKeywords.userId, userId))
  const lower = title.toLowerCase()
  for (const kw of keywords) {
    if (lower.includes(kw.keyword.toLowerCase())) return kw.categoryId
  }
  return null
}
```

**Step 2: Commit**
```bash
git add src/lib/utils/autoCategory.ts
git commit -m "feat(utils): auto-categorisation keyword matcher"
```

---

## Phase 3 — Design System (Cashew Visual Style)

### Task 8: Update CSS variables to Cashew green palette

**Files:**
- Modify: `src/app/globals.css`

**Step 1:** Replace the `:root` color variables with Cashew's soft green palette:
- `--primary`: `oklch(0.45 0.15 152)` (Cashew's signature green)
- `--background`: `oklch(0.97 0.015 152)` (light green tint)
- `--card`: `oklch(0.99 0.005 152)`
- `--accent`: `oklch(0.88 0.06 152)`
- `--chart-1` through `--chart-5`: use green, pink, yellow, blue, grey to match Cashew's donut colours

Keep dark mode variables. Keep `--radius: 0.875rem` (Cashew uses very rounded corners).

**Step 2:** Commit
```bash
git add src/app/globals.css
git commit -m "feat(design): Cashew green palette — primary, background, accent CSS vars"
```

---

### Task 9: Cashew-style `BudgetProgressBar` component

**Files:**
- Create: `src/components/shared/BudgetProgressBar.tsx`

This is the core Cashew UI element: a progress bar with a "Today" marker pin showing time elapsed vs money spent.

**Step 1: Create file**
```tsx
'use client'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { BudgetPeriod } from '@/lib/utils/budgetPeriod'

interface Props {
  spent: number
  total: number
  period: BudgetPeriod
  currency: string
  dailyAllowance: number
  isOverspent: boolean
  overspentBy: number
  className?: string
}

export function BudgetProgressBar({ spent, total, period, currency, dailyAllowance, isOverspent, overspentBy, className }: Props) {
  const spentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const timePct = period.progressPct
  const isBehind = spentPct > timePct  // spending faster than time passing

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main bar */}
      <div className="relative h-4 w-full overflow-visible rounded-full bg-muted">
        {/* Spent fill */}
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isOverspent ? 'bg-rose-500' : isBehind ? 'bg-amber-400' : 'bg-primary'
          )}
          style={{ width: `${spentPct}%` }}
        />
        {/* Today marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${timePct}%` }}
        >
          <div className="h-6 w-0.5 bg-foreground/60 rounded-full" />
          <span className="mt-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background whitespace-nowrap">
            Today
          </span>
        </div>
      </div>

      {/* Date labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(period.start, 'MMM d')}</span>
        <span>{format(period.end, 'MMM d')}</span>
      </div>

      {/* Daily allowance hint */}
      <p className="text-sm text-muted-foreground text-center">
        {isOverspent
          ? `Overspent by ${currency} ${overspentBy.toFixed(0)} — try to reduce`
          : period.daysRemaining > 0
            ? `You can spend ${currency} ${dailyAllowance.toFixed(0)}/day for ${period.daysRemaining} more day${period.daysRemaining === 1 ? '' : 's'}`
            : 'Last day of this period'}
      </p>
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add src/components/shared/BudgetProgressBar.tsx
git commit -m "feat(ui): BudgetProgressBar with Today marker and daily allowance hint"
```

---

### Task 10: `SpendingDonut` component (Recharts)

**Files:**
- Create: `src/components/shared/SpendingDonut.tsx`

Recharts is already installed. This renders the Cashew-style donut with category breakdown.

**Step 1: Create file**
```tsx
'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

export interface DonutSlice {
  name: string
  value: number
  color: string
}

interface Props {
  slices: DonutSlice[]
  currency: string
  centerLabel?: string
  centerValue?: string
}

const ROUNDING = 4

export function SpendingDonut({ slices, currency, centerLabel, centerValue }: Props) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      No spending yet
    </div>
  )

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {slices.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatCurrency(value, currency), '']}
            contentStyle={{ borderRadius: '1rem', border: '1px solid var(--border)', fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center text */}
      {centerValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
          <span className="text-lg font-bold">{centerValue}</span>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add src/components/shared/SpendingDonut.tsx
git commit -m "feat(ui): SpendingDonut recharts component"
```

---

### Task 11: `CategoryRow` component (Cashew's per-category breakdown row)

**Files:**
- Create: `src/components/shared/CategoryRow.tsx`

**Step 1: Create file**
```tsx
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  name: string
  color: string
  icon?: string
  spent: number
  limit?: number
  count: number
  currency: string
}

export function CategoryRow({ name, color, icon, spent, limit, count, currency }: Props) {
  const pct = limit && limit > 0 ? Math.min(100, (spent / limit) * 100) : null
  const isOver = pct !== null && pct >= 100

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Icon circle */}
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ background: color + '22', border: `2px solid ${color}` }}
      >
        {icon ?? name[0]}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className={cn('shrink-0 text-sm font-bold', isOver && 'text-rose-600')}>
            {formatCurrency(spent, currency)}
            {limit ? <span className="font-normal text-muted-foreground"> / {formatCurrency(limit, currency)}</span> : null}
          </span>
        </div>
        {/* Progress bar */}
        {pct !== null && (
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', isOver ? 'bg-rose-500' : 'bg-primary')}
              style={{ width: `${pct}%`, background: isOver ? undefined : color }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">{count} transaction{count !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add src/components/shared/CategoryRow.tsx
git commit -m "feat(ui): CategoryRow component with progress bar and limit"
```

---

## Phase 4 — Account Detail Page

### Task 12: Accounts list page (`/accounts`)

**Files:**
- Create: `src/app/(app)/accounts/page.tsx`
- Modify: `src/components/shared/Sidebar.tsx` — add Accounts nav item under Home section

**Step 1: Create page**
```tsx
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { accounts, transactions } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getAccountBalance } from '@/lib/utils/accountBalance'
import { AccountCard } from '@/components/accounts/AccountCard'
import { PageHeader, PageShell, EmptyState } from '@/components/shared/quiet-ledger'
import { WalletCards } from 'lucide-react'

export default async function AccountsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const accountList = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))

  const accountsWithBalance = await Promise.all(
    accountList.map(async (a) => ({
      ...a,
      balance: await getAccountBalance(a.id, userId),
    }))
  )

  return (
    <PageShell size="wide">
      <PageHeader eyebrow="Your money" title="Accounts"
        description="Each account's live balance is computed from all transactions." />
      {accountList.length === 0 ? (
        <EmptyState icon={WalletCards} title="No accounts yet"
          description="Go to Settings → Accounts to add your first account." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accountsWithBalance.map(a => <AccountCard key={a.id} account={a} />)}
        </div>
      )}
    </PageShell>
  )
}
```

**Step 2: Create `AccountCard` component**

Create `src/components/accounts/AccountCard.tsx`:
```tsx
import Link from 'next/link'
import { WalletCards } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Account } from '@/lib/db/schema'

interface Props {
  account: Account & { balance: number }
}

const TYPE_COLORS: Record<string, string> = {
  bank: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  wallet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  cash: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  savings: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
}

export function AccountCard({ account }: Props) {
  return (
    <Link href={`/accounts/${account.id}`}
      className="group rounded-3xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow space-y-4">
      <div className="flex items-start justify-between">
        <div className={cn('flex size-11 items-center justify-center rounded-2xl', TYPE_COLORS[account.type] ?? TYPE_COLORS.bank)}>
          <WalletCards className="size-5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{account.type}</span>
      </div>
      <div>
        <p className="text-base font-semibold">{account.name}</p>
        <p className={cn('text-2xl font-bold mt-1', account.balance < 0 ? 'text-rose-600' : 'text-foreground')}>
          {formatCurrency(account.balance, account.currency)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{account.currency}</p>
      </div>
    </Link>
  )
}
```

**Step 3: Add Accounts to sidebar nav**

In `src/components/shared/Sidebar.tsx`, add to the Home section items:
```ts
{ href: '/accounts', label: 'Accounts', icon: WalletCards },
```

**Step 4: Commit**
```bash
git add src/app/(app)/accounts/page.tsx src/components/accounts/AccountCard.tsx src/components/shared/Sidebar.tsx
git commit -m "feat: accounts list page with live balances"
```

---

### Task 13: Account detail page (`/accounts/[id]`)

**Files:**
- Create: `src/app/(app)/accounts/[id]/page.tsx`
- Create: `src/components/accounts/AccountTransactionTable.tsx`

**Step 1: Create page**
```tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { accounts, transactions, categories } from '@/lib/db/schema'
import { eq, and, isNull, desc, or } from 'drizzle-orm'
import { attachRunningBalance } from '@/lib/utils/accountBalance'
import { AccountTransactionTable } from '@/components/accounts/AccountTransactionTable'
import { PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { formatCurrency } from '@/lib/utils/format'

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user!.id!

  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
  if (!account) notFound()

  const [txList, categoryList] = await Promise.all([
    db.select().from(transactions)
      .where(and(eq(transactions.accountId, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.date)),
    db.select().from(categories)
      .where(and(isNull(categories.deletedAt), or(eq(categories.userId, userId), isNull(categories.userId)))),
  ])

  const withBalance = attachRunningBalance(txList, Number(account.openingBalance ?? 0))
  const currentBalance = withBalance.length > 0
    ? withBalance[withBalance.length - 1].runningBalance
    : Number(account.openingBalance ?? 0)

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow={account.type}
        title={account.name}
        description={`Live balance: ${formatCurrency(currentBalance, account.currency)}`}
      />
      <AccountTransactionTable
        transactions={withBalance.reverse()} // newest first
        categories={categoryList}
        currency={account.currency}
      />
    </PageShell>
  )
}
```

**Step 2: Create `AccountTransactionTable`**

Create `src/components/accounts/AccountTransactionTable.tsx`:
```tsx
'use client'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Array<Transaction & { runningBalance: number }>
  categories: Array<{ id: string; name: string; color?: string | null }>
  currency: string
}

export function AccountTransactionTable({ transactions, categories, currency }: Props) {
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  if (transactions.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">No transactions on this account yet.</p>
  )

  return (
    <div className="rounded-3xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Title / Note</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map(t => {
            const cat = t.categoryId ? catMap[t.categoryId] : null
            return (
              <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {format(parseISO(t.date), 'dd MMM yyyy')}
                </td>
                <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                  {t.title || t.note || '—'}
                </td>
                <td className="px-4 py-3">
                  {cat ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: (cat.color ?? '#888') + '22', color: cat.color ?? '#888' }}>
                      {cat.name}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className={cn('px-4 py-3 text-right font-semibold whitespace-nowrap',
                  t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-muted-foreground')}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                  {formatCurrency(Number(t.amount), currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                  {formatCurrency(t.runningBalance, currency)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add src/app/(app)/accounts/ src/components/accounts/AccountTransactionTable.tsx
git commit -m "feat: account detail page with running balance statement view"
```

---

## Phase 5 — Budget Overhaul

### Task 14: Rebuild budget detail page (`/budgets/[id]`)

**Files:**
- Create: `src/app/(app)/budgets/[id]/page.tsx`
- Create: `src/components/budgets/BudgetDetail.tsx`

**Step 1: Create page**
```tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { budgets, transactions, categories } from '@/lib/db/schema'
import { eq, and, isNull, gte, lte, or } from 'drizzle-orm'
import { format } from 'date-fns'
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
import { BudgetDetail } from '@/components/budgets/BudgetDetail'

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user!.id!

  const [budget] = await db.select().from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId), isNull(budgets.deletedAt)))
  if (!budget) notFound()

  const period = getBudgetPeriod(budget)

  const periodTxs = await db.select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.type, 'expense'),
      isNull(transactions.deletedAt),
      gte(transactions.date, format(period.start, 'yyyy-MM-dd')),
      lte(transactions.date, format(period.end, 'yyyy-MM-dd')),
      budget.categoryId ? eq(transactions.categoryId, budget.categoryId) : undefined,
    ))

  const categoryList = await db.select().from(categories)
    .where(and(isNull(categories.deletedAt), or(eq(categories.userId, userId), isNull(categories.userId))))

  const spent = periodTxs.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
  const allowance = getDailyAllowance(budget, spent)

  // Build category breakdown slices
  const COLORS = ['#4ade80','#f472b6','#facc15','#60a5fa','#94a3b8','#fb923c','#a78bfa']
  const catSpend: Record<string, number> = {}
  for (const t of periodTxs) {
    const key = t.categoryId ?? '__none__'
    catSpend[key] = (catSpend[key] ?? 0) + Number(t.amount)
  }
  const slices = Object.entries(catSpend).map(([catId, value], i) => ({
    name: categoryList.find(c => c.id === catId)?.name ?? 'Other',
    value,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <BudgetDetail
      budget={budget}
      period={period}
      spent={spent}
      allowance={allowance}
      slices={slices}
      categories={categoryList}
      periodTxs={periodTxs}
    />
  )
}
```

**Step 2: Create `BudgetDetail` client component**

Create `src/components/budgets/BudgetDetail.tsx`:
```tsx
'use client'
import { format } from 'date-fns'
import { BudgetProgressBar } from '@/components/shared/BudgetProgressBar'
import { SpendingDonut } from '@/components/shared/SpendingDonut'
import { CategoryRow } from '@/components/shared/CategoryRow'
import { PageHeader, PageShell } from '@/components/shared/quiet-ledger'
import { formatCurrency } from '@/lib/utils/format'
import type { Budget, Transaction } from '@/lib/db/schema'
import type { BudgetPeriod } from '@/lib/utils/budgetPeriod'
import type { DonutSlice } from '@/components/shared/SpendingDonut'

interface Props {
  budget: Budget
  period: BudgetPeriod
  spent: number
  allowance: ReturnType<typeof import('@/lib/utils/budgetPeriod').getDailyAllowance>
  slices: DonutSlice[]
  categories: Array<{ id: string; name: string; color?: string | null; icon?: string | null }>
  periodTxs: Transaction[]
}

export function BudgetDetail({ budget, period, spent, allowance, slices, categories, periodTxs }: Props) {
  const total = Number(budget.amount)
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  // Category rows
  const catSpend: Record<string, { spent: number; count: number }> = {}
  for (const t of periodTxs) {
    const key = t.categoryId ?? '__none__'
    if (!catSpend[key]) catSpend[key] = { spent: 0, count: 0 }
    catSpend[key].spent += Number(t.amount)
    catSpend[key].count++
  }
  const catRows = Object.entries(catSpend)
    .sort((a, b) => b[1].spent - a[1].spent)

  return (
    <PageShell size="default">
      <PageHeader
        eyebrow={budget.periodType}
        title={budget.name}
        description={`${format(period.start, 'MMM d')} — ${format(period.end, 'MMM d, yyyy')}`}
      />

      {/* Budget amount hero */}
      <div className="rounded-3xl bg-primary/10 border border-primary/20 p-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Budget</p>
        <p className="text-4xl font-bold">{formatCurrency(total, budget.currency)}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(spent, budget.currency)} spent · {formatCurrency(Math.max(0, total - spent), budget.currency)} remaining
        </p>
      </div>

      {/* Progress bar with Today marker */}
      <div className="rounded-3xl border bg-card p-6">
        <BudgetProgressBar
          spent={spent}
          total={total}
          period={period}
          currency={budget.currency}
          dailyAllowance={allowance.dailyAllowance}
          isOverspent={allowance.isOverspent}
          overspentBy={allowance.overspentBy}
        />
      </div>

      {/* Donut + category rows */}
      {slices.length > 0 && (
        <div className="rounded-3xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Spending breakdown</h3>
          <SpendingDonut
            slices={slices}
            currency={budget.currency}
            centerLabel="Spent"
            centerValue={formatCurrency(spent, budget.currency)}
          />
          <div className="divide-y">
            {catRows.map(([catId, { spent: catSpent, count }]) => {
              const cat = catMap[catId]
              return (
                <CategoryRow
                  key={catId}
                  name={cat?.name ?? 'Uncategorised'}
                  color={cat?.color ?? '#94a3b8'}
                  icon={cat?.icon ?? undefined}
                  spent={catSpent}
                  count={count}
                  currency={budget.currency}
                />
              )
            })}
          </div>
        </div>
      )}
    </PageShell>
  )
}
```

**Step 3: Make budget cards link to detail page**

In `src/components/budgets/BudgetCard.tsx`, wrap the card in a `Link href={/budgets/${budget.id}}` or add a "View details" link at the bottom.

**Step 4: Commit**
```bash
git add src/app/(app)/budgets/[id]/ src/components/budgets/BudgetDetail.tsx src/components/budgets/BudgetCard.tsx
git commit -m "feat: budget detail page with period cycles, Today marker, donut, category breakdown"
```

---

### Task 15: Update budgets list page to use real period logic

**Files:**
- Modify: `src/app/(app)/budgets/page.tsx`

**Step 1:** Replace the hardcoded `monthlyTxs`/`weeklyTxs` with period-aware queries.

For each budget, call `getBudgetPeriod(budget)` to get the current `start`/`end`, then query transactions in that window. Replace `computeSpent` with a per-budget query using the period dates.

Key change in `budgetProgress` mapping:
```ts
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
// ...
const budgetProgress = await Promise.all(budgetList.map(async (budget) => {
  const period = getBudgetPeriod(budget)
  const txs = await db.select().from(transactions).where(and(
    eq(transactions.userId, userId),
    eq(transactions.type, 'expense'),
    isNull(transactions.deletedAt),
    gte(transactions.date, format(period.start, 'yyyy-MM-dd')),
    lte(transactions.date, format(period.end, 'yyyy-MM-dd')),
    budget.categoryId ? eq(transactions.categoryId, budget.categoryId) : undefined,
  ))
  const spent = txs.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
  const amount = Number(budget.amount)
  const allowance = getDailyAllowance(budget, spent)
  return { budget, spent, amount, period, allowance, percentage: amount > 0 ? (spent / amount) * 100 : 0 }
}))
```

Pass `period` and `allowance` down to `BudgetCard` so it can show the daily hint.

**Step 2: Commit**
```bash
git add src/app/(app)/budgets/page.tsx
git commit -m "feat: budgets page uses real period cycle logic per budget"
```

---

## Phase 6 — Recurring Transactions

### Task 16: Recurring transactions page (`/recurring`)

**Files:**
- Create: `src/app/(app)/recurring/page.tsx`
- Create: `src/components/recurring/RecurringList.tsx`
- Modify: `src/components/shared/Sidebar.tsx` — add Recurring nav item

**Step 1: Create page**
```tsx
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { RecurringList } from '@/components/recurring/RecurringList'
import { PageHeader, PageShell, EmptyState } from '@/components/shared/quiet-ledger'
import { Repeat } from 'lucide-react'

export default async function RecurringPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [recurringTxs, accountList, categoryList] = await Promise.all([
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      eq(transactions.isRecurring, true),
      isNull(transactions.deletedAt),
    )),
    db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(categories).where(and(isNull(categories.deletedAt), or(eq(categories.userId, userId), isNull(categories.userId)))),
  ])

  return (
    <PageShell size="wide">
      <PageHeader eyebrow="Scheduled" title="Recurring Transactions"
        description="Salary, rent, subscriptions — money that moves on a schedule." />
      {recurringTxs.length === 0 ? (
        <EmptyState icon={Repeat} title="No recurring transactions"
          description="When adding a transaction, toggle 'Recurring' and set an interval." />
      ) : (
        <RecurringList transactions={recurringTxs} accounts={accountList} categories={categoryList} />
      )}
    </PageShell>
  )
}
```

**Step 2: Create `RecurringList`**

Create `src/components/recurring/RecurringList.tsx`:
```tsx
'use client'
import { addDays, addWeeks, addMonths, format, parseISO } from 'date-fns'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { Repeat } from 'lucide-react'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Transaction[]
  accounts: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string; color?: string | null }>
}

function getNextDate(tx: Transaction): Date | null {
  if (!tx.recurrenceInterval || !tx.recurrenceUnit) return null
  const last = parseISO(tx.date)
  const n = Number(tx.recurrenceInterval)
  if (tx.recurrenceUnit === 'day') return addDays(last, n)
  if (tx.recurrenceUnit === 'week') return addWeeks(last, n)
  if (tx.recurrenceUnit === 'month') return addMonths(last, n)
  return null
}

export function RecurringList({ transactions, accounts, categories }: Props) {
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]))
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const today = new Date()

  const sorted = [...transactions].sort((a, b) => {
    const na = getNextDate(a)
    const nb = getNextDate(b)
    if (!na || !nb) return 0
    return na.getTime() - nb.getTime()
  })

  return (
    <div className="space-y-3">
      {sorted.map(tx => {
        const next = getNextDate(tx)
        const cat = tx.categoryId ? catMap[tx.categoryId] : null
        const acc = accMap[tx.accountId]
        const daysUntil = next ? Math.ceil((next.getTime() - today.getTime()) / 86400000) : null
        const isUrgent = daysUntil !== null && daysUntil <= 3

        return (
          <div key={tx.id} className="flex items-center gap-4 rounded-3xl border bg-card p-4">
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl',
              tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
              <Repeat className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{tx.title || tx.note || 'Recurring'}</p>
              <p className="text-xs text-muted-foreground">
                {acc?.name} · {cat?.name ?? 'Uncategorised'} · every {tx.recurrenceInterval} {tx.recurrenceUnit}(s)
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={cn('font-semibold', tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
                {tx.type === 'income' ? '+' : '−'}{formatCurrency(Number(tx.amount), tx.currency)}
              </p>
              {next && (
                <p className={cn('text-xs mt-0.5', isUrgent ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                  {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due ${format(next, 'MMM d')}`}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 3: Add Recurring to sidebar** under Home section:
```ts
{ href: '/recurring', label: 'Recurring', icon: Repeat },
```

**Step 4: Commit**
```bash
git add src/app/(app)/recurring/ src/components/recurring/ src/components/shared/Sidebar.tsx
git commit -m "feat: recurring transactions page with next-due dates"
```

---

## Phase 7 — Triage Dashboard

### Task 17: Rebuild dashboard as control tower

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/dashboard/BudgetHealthBar.tsx`
- Create: `src/components/dashboard/UpcomingRecurring.tsx`
- Create: `src/components/dashboard/SpendingHeatmap.tsx`

**Step 1: Create `BudgetHealthBar`**

Create `src/components/dashboard/BudgetHealthBar.tsx`:
```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Budget } from '@/lib/db/schema'
import type { BudgetPeriod } from '@/lib/utils/budgetPeriod'

interface Props {
  budget: Budget
  spent: number
  period: BudgetPeriod
}

export function BudgetHealthBar({ budget, spent, period }: Props) {
  const total = Number(budget.amount)
  const spentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const timePct = period.progressPct
  const isBehind = spentPct > timePct + 10
  const isOver = spentPct >= 100

  return (
    <Link href={`/budgets/${budget.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium truncate">{budget.name}</span>
          <span className={cn('text-xs font-semibold', isOver ? 'text-rose-600' : isBehind ? 'text-amber-600' : 'text-emerald-600')}>
            {formatCurrency(spent, budget.currency)} / {formatCurrency(total, budget.currency)}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full', isOver ? 'bg-rose-500' : isBehind ? 'bg-amber-400' : 'bg-primary')}
            style={{ width: `${spentPct}%` }} />
          {/* time marker */}
          <div className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${timePct}%` }} />
        </div>
      </div>
    </Link>
  )
}
```

**Step 2: Create `UpcomingRecurring`**

Create `src/components/dashboard/UpcomingRecurring.tsx`:
```tsx
import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Transaction } from '@/lib/db/schema'

interface Props {
  transactions: Transaction[]
}

function getNextDate(tx: Transaction): Date | null {
  if (!tx.recurrenceInterval || !tx.recurrenceUnit) return null
  const last = parseISO(tx.date)
  const n = Number(tx.recurrenceInterval)
  if (tx.recurrenceUnit === 'day') return addDays(last, n)
  if (tx.recurrenceUnit === 'week') return addWeeks(last, n)
  if (tx.recurrenceUnit === 'month') return addMonths(last, n)
  return null
}

export function UpcomingRecurring({ transactions }: Props) {
  const today = new Date()
  const upcoming = transactions
    .map(tx => ({ tx, next: getNextDate(tx) }))
    .filter(({ next }) => next && next.getTime() - today.getTime() <= 7 * 86400000 && next >= today)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime())
    .slice(0, 5)

  if (upcoming.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Due in 7 days</h3>
      {upcoming.map(({ tx, next }) => {
        const daysUntil = Math.ceil((next!.getTime() - today.getTime()) / 86400000)
        return (
          <div key={tx.id} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
            <Repeat className={cn('size-4 shrink-0', tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500')} />
            <span className="flex-1 text-sm font-medium truncate">{tx.title || tx.note || 'Recurring'}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : format(next!, 'MMM d')}
            </span>
            <span className={cn('text-sm font-semibold whitespace-nowrap', tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
              {formatCurrency(Number(tx.amount), tx.currency)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 3: Create `SpendingHeatmap`**

Create `src/components/dashboard/SpendingHeatmap.tsx`:
```tsx
'use client'
import { eachDayOfInterval, subDays, format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  // map of 'yyyy-MM-dd' → total spent
  dailySpend: Record<string, number>
  currency: string
  days?: number
}

export function SpendingHeatmap({ dailySpend, currency, days = 84 }: Props) {
  const today = new Date()
  const start = subDays(today, days - 1)
  const allDays = eachDayOfInterval({ start, end: today })
  const values = allDays.map(d => dailySpend[format(d, 'yyyy-MM-dd')] ?? 0)
  const max = Math.max(...values, 1)

  // Group into weeks (columns)
  const weeks: Array<typeof allDays> = []
  let week: typeof allDays = []
  for (const day of allDays) {
    week.push(day)
    if (day.getDay() === 6 || day === allDays[allDays.length - 1]) {
      weeks.push(week)
      week = []
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Spending heatmap</h3>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((wk, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {wk.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const val = dailySpend[key] ?? 0
              const intensity = val === 0 ? 0 : Math.max(0.15, val / max)
              const isToday = key === format(today, 'yyyy-MM-dd')
              return (
                <div key={key} title={`${key}: ${formatCurrency(val, currency)}`}
                  className={cn('size-3 rounded-sm transition-colors', isToday && 'ring-1 ring-primary')}
                  style={{ background: val === 0 ? 'var(--muted)' : `rgba(34,197,94,${intensity})` }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Update dashboard page**

In `src/app/(app)/dashboard/page.tsx`, add:
- Fetch all recurring transactions
- Compute daily spend map for last 84 days
- Fetch all budgets with their period-aware spent amounts
- Render: `UpcomingRecurring`, `BudgetHealthBar` list, `SpendingHeatmap`, existing `CashFlowSummary` + `RecentTransactions`

Replace the top of the file with:
```tsx
// ... existing imports ...
import { getBudgetPeriod } from '@/lib/utils/budgetPeriod'
import { BudgetHealthBar } from '@/components/dashboard/BudgetHealthBar'
import { UpcomingRecurring } from '@/components/dashboard/UpcomingRecurring'
import { SpendingHeatmap } from '@/components/dashboard/SpendingHeatmap'
import { budgets } from '@/lib/db/schema'
import { format, subDays } from 'date-fns'
```

Add data fetching for budgets and recurring txs alongside existing queries. Compute:
```ts
// Daily spend map
const heatmapStart = format(subDays(now, 83), 'yyyy-MM-dd')
const heatmapTxs = await db.select().from(transactions).where(and(
  eq(transactions.userId, userId),
  eq(transactions.type, 'expense'),
  isNull(transactions.deletedAt),
  gte(transactions.date, heatmapStart),
))
const dailySpend: Record<string, number> = {}
for (const t of heatmapTxs) {
  dailySpend[t.date] = (dailySpend[t.date] ?? 0) + Number(t.convertedAmount ?? t.amount)
}
```

**Step 5: Commit**
```bash
git add src/app/(app)/dashboard/page.tsx src/components/dashboard/BudgetHealthBar.tsx src/components/dashboard/UpcomingRecurring.tsx src/components/dashboard/SpendingHeatmap.tsx
git commit -m "feat: triage dashboard — budget health bars, upcoming recurring, spending heatmap"
```

---

## Phase 8 — Agent Summary API + Auto-categorisation Wire-up

### Task 18: `GET /api/v1/summary` endpoint

**Files:**
- Create: `src/app/api/v1/summary/route.ts`

**Step 1: Create file**
```ts
import { NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { transactions, accounts, budgets, categories } from '@/lib/db/schema'
import { eq, and, isNull, gte, or } from 'drizzle-orm'
import { getBudgetPeriod, getDailyAllowance } from '@/lib/utils/budgetPeriod'
import { getAccountBalance } from '@/lib/utils/accountBalance'
import { computeNetworth } from '@/lib/utils/networth'
import { format, subDays } from 'date-fns'

export async function GET(req: Request) {
  const session = await resolveSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) })
  const baseCurrency = user?.defaultCurrency ?? 'INR'

  const [accountList, budgetList, recentTxs] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(budgets).where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, format(subDays(new Date(), 30), 'yyyy-MM-dd')),
    )),
  ])

  // Account balances
  const accountSummary = await Promise.all(accountList.map(async a => ({
    id: a.id, name: a.name, type: a.type, currency: a.currency,
    balance: await getAccountBalance(a.id, userId),
  })))

  // Budget health
  const budgetSummary = await Promise.all(budgetList.map(async b => {
    const period = getBudgetPeriod(b)
    const periodTxs = recentTxs.filter(t =>
      t.type === 'expense' &&
      t.date >= format(period.start, 'yyyy-MM-dd') &&
      t.date <= format(period.end, 'yyyy-MM-dd') &&
      (!b.categoryId || t.categoryId === b.categoryId)
    )
    const spent = periodTxs.reduce((s, t) => s + Number(t.convertedAmount ?? t.amount), 0)
    const allowance = getDailyAllowance(b, spent)
    return {
      id: b.id, name: b.name, amount: Number(b.amount), currency: b.currency,
      spent, remaining: Number(b.amount) - spent,
      spentPct: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0,
      periodStart: format(period.start, 'yyyy-MM-dd'),
      periodEnd: format(period.end, 'yyyy-MM-dd'),
      daysRemaining: allowance.daysRemaining,
      dailyAllowance: allowance.dailyAllowance,
      isOverspent: allowance.isOverspent,
    }
  }))

  // Networth
  const networth = await computeNetworth(userId, baseCurrency)

  // Anomalies: txs > 2x 30-day daily average
  const expenseTxs = recentTxs.filter(t => t.type === 'expense')
  const totalSpent30 = expenseTxs.reduce((s, t) => s + Number(t.amount), 0)
  const dailyAvg = totalSpent30 / 30
  const anomalies = expenseTxs
    .filter(t => Number(t.amount) > dailyAvg * 2)
    .slice(0, 5)
    .map(t => ({ id: t.id, date: t.date, amount: Number(t.amount), title: t.title, note: t.note }))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    baseCurrency,
    networth,
    accounts: accountSummary,
    budgets: budgetSummary,
    anomalies,
  })
}
```

**Step 2: Commit**
```bash
git add src/app/api/v1/summary/route.ts
git commit -m "feat(api): GET /api/v1/summary — single-call financial state for agents"
```

---

### Task 19: Wire auto-categorisation into `createTransaction` action

**Files:**
- Modify: `src/app/actions/transactions.ts`

**Step 1:** In `createTransaction`, after parsing the form data and before inserting, add:
```ts
import { matchCategory } from '@/lib/utils/autoCategory'

// Auto-suggest category if title given and no category selected
if (data.title && !data.categoryId) {
  const suggestedCat = await matchCategory(data.title, session.user.id)
  if (suggestedCat) data.categoryId = suggestedCat
}
```

Also update the insert to include `title`:
```ts
.values({
  ...data,
  title: data.title ?? null,
  userId: session.user.id,
  // ... rest unchanged
})
```

**Step 2: Commit**
```bash
git add src/app/actions/transactions.ts
git commit -m "feat: auto-categorise transactions by title keyword match"
```

---

## Phase 9 — Deploy

### Task 20: Deploy to production

**Step 1: Build locally to catch type errors**
```bash
npm run build
```
Fix any TypeScript errors before deploying.

**Step 2: Push to main and deploy**
```bash
git push origin main
ssh personal 'cd /opt/ledgerify && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d --build'
```

**Step 3: Run migrations on production**
```bash
ssh personal 'bash /opt/ledgerify/run-migration.sh'
```

**Step 4: Verify**
- Visit `https://money.shenthar.me/accounts` → should show account list
- Visit `https://money.shenthar.me/budgets` → should show period-aware progress
- Visit `https://money.shenthar.me/recurring` → should show recurring items
- `curl -H "Cookie: ..." https://money.shenthar.me/api/v1/summary` → should return JSON

---

## Summary of all changes

| Phase | What changes |
|---|---|
| Schema | `accounts.opening_balance`, `transactions.title/recurrenceInterval/recurrenceUnit`, `budgets.period_anchor_date/rollover`, new `category_keywords` table |
| Utils | `budgetPeriod.ts`, `accountBalance.ts`, `autoCategory.ts` |
| Design | Cashew green CSS vars, `BudgetProgressBar`, `SpendingDonut`, `CategoryRow` |
| Pages | `/accounts`, `/accounts/[id]`, `/budgets/[id]` (new), `/recurring` (new) |
| Dashboard | `BudgetHealthBar`, `UpcomingRecurring`, `SpendingHeatmap` |
| API | `GET /api/v1/summary` |
| Actions | Auto-categorisation in `createTransaction` |

