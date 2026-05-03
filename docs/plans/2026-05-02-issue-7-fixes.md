# Issue #7 — Audit Route and Ledger Logic Discrepancies: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all correctness and UX discrepancies identified in issue #7 across category ownership, CSV round-trip, conversion fields, transfer UI, mobile quick-add, exchange rate direction, and destructive-action confirmation.

**Architecture:** Fixes are grouped into 7 independent tasks that can be applied sequentially. Each task is self-contained: a data-layer/server fix, followed by any UI wiring needed. No new dependencies are required.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + PostgreSQL, React 19 `useActionState`, Zod v4, Tailwind CSS v4, shadcn/ui components already in `src/components/ui/`.

---

## Task 1: Fix category ownership — scope all category reads to current user + system

**Problem:** Five pages/routes fetch `categories` with no `userId` filter, exposing other users' private categories.

**Files:**
- Modify: `src/app/(app)/transactions/page.tsx:41`
- Modify: `src/app/(app)/dashboard/page.tsx:91`
- Modify: `src/app/(app)/budgets/page.tsx:75`
- Modify: `src/app/(app)/reports/category-breakdown/page.tsx:24`
- Modify: `src/app/api/import/route.ts:46-47`
- Modify: `src/app/actions/transactions.ts` — add ownership guard before insert
- Modify: `src/app/actions/budgets.ts` — add ownership guard before insert

---

### Step 1: Fix category query in `transactions/page.tsx`

Replace line 41:
```ts
// Before
db.select().from(categories).where(isNull(categories.deletedAt)),

// After
db.select().from(categories).where(
  and(
    isNull(categories.deletedAt),
    or(eq(categories.userId, userId), isNull(categories.userId)),
  )
),
```

Add `or` to the import on line 4:
```ts
import { eq, and, isNull, desc, or } from "drizzle-orm";
```

---

### Step 2: Fix category query in `dashboard/page.tsx`

Replace line 91:
```ts
// Before
db.select().from(categories).where(isNull(categories.deletedAt)),

// After
db.select().from(categories).where(
  and(
    isNull(categories.deletedAt),
    or(eq(categories.userId, userId), isNull(categories.userId)),
  )
),
```

Add `or` to the import on line 11:
```ts
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
```

---

### Step 3: Fix category query in `budgets/page.tsx`

Replace line 75:
```ts
// Before
db.select().from(categories).where(isNull(categories.deletedAt)),

// After
db.select().from(categories).where(
  and(
    isNull(categories.deletedAt),
    or(eq(categories.userId, userId), isNull(categories.userId)),
  )
),
```

Add `or` to the import on line 4:
```ts
import { eq, and, isNull, gte, lte, or } from 'drizzle-orm'
```

---

### Step 4: Fix category query in `reports/category-breakdown/page.tsx`

Replace line 24:
```ts
// Before
db.select().from(categories).where(and(isNull(categories.deletedAt))),

// After
db.select().from(categories).where(
  and(
    isNull(categories.deletedAt),
    or(eq(categories.userId, userId), isNull(categories.userId)),
  )
),
```

Add `or` to the import on line 4:
```ts
import { eq, isNull, and, or } from 'drizzle-orm'
```

---

### Step 5: Fix category lookup in `api/import/route.ts`

Replace lines 46-47 (global name lookup):
```ts
// Before
const catRows = await db.select().from(categories)
  .where(and(eq(categories.name, row.category), isNull(categories.deletedAt)))
  .limit(1)

// After — scope to current user + system categories
const catRows = await db.select().from(categories)
  .where(and(
    eq(categories.name, row.category),
    isNull(categories.deletedAt),
    or(eq(categories.userId, userId), isNull(categories.userId)),
  ))
  .limit(1)
```

Add `or` to the import on line 6:
```ts
import { eq, and, isNull, or } from 'drizzle-orm'
```

---

### Step 6: Guard categoryId ownership in `createTransaction`

In `src/app/actions/transactions.ts`, add a check after `parsed.success`, before the insert (around line 38). Add these imports at the top:
```ts
import { categories, accounts } from "@/lib/db/schema";
import { or } from "drizzle-orm";
```

Insert after line 38 (`const { tagIds, ...data } = parsed.data;`):
```ts
  // Verify accountId belongs to the current user
  if (data.accountId) {
    const accountCheck = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, data.accountId), eq(accounts.userId, session.user.id), isNull(accounts.deletedAt)),
    });
    if (!accountCheck) return { error: "Account not found or not yours" };
  }

  // Verify categoryId is current-user-owned or system
  if (data.categoryId) {
    const catCheck = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        isNull(categories.deletedAt),
        or(eq(categories.userId, session.user.id), isNull(categories.userId)),
      ),
    });
    if (!catCheck) return { error: "Category not found or not yours" };
  }
```

---

### Step 7: Guard categoryId ownership in `createBudget`

In `src/app/actions/budgets.ts`, add after line 20 (`if (!parsed.success)...`):
```ts
import { categories } from '@/lib/db/schema'
import { or } from 'drizzle-orm'
```

Insert before the `db.insert(budgets)` call (line 23):
```ts
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
```

---

### Step 8: Commit

```bash
git add src/app/(app)/transactions/page.tsx \
        src/app/(app)/dashboard/page.tsx \
        src/app/(app)/budgets/page.tsx \
        src/app/(app)/reports/category-breakdown/page.tsx \
        src/app/api/import/route.ts \
        src/app/actions/transactions.ts \
        src/app/actions/budgets.ts
git commit -m "fix: scope category reads and writes to current user + system categories"
```

---

## Task 2: Fix exchange rate direction

**Problem:** The cron job stores `INR → USD` (and other pairs). But `getRate(txCurrency, userDefaultCurrency)` for a USD transaction with INR base asks for `USD → INR`, which is absent → falls back to `1`. This breaks all multi-currency `convertedAmount` calculations.

**Files:**
- Modify: `src/lib/utils/currency.ts`
- Modify: `src/app/api/cron/exchange-rates/route.ts`

---

### Step 1: Fix `getRate` to handle inverse lookup

Replace all of `src/lib/utils/currency.ts`:
```ts
import { db } from '@/lib/db'
import { exchangeRates } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function getRate(base: string, target: string): Promise<number> {
  if (base === target) return 1

  // Try direct pair first (e.g. INR → USD stored by cron)
  const direct = await db.query.exchangeRates.findFirst({
    where: and(eq(exchangeRates.base, base), eq(exchangeRates.target, target)),
  })
  if (direct) return Number(direct.rate)

  // Try inverse pair (e.g. asked for USD → INR, cron stored INR → USD)
  const inverse = await db.query.exchangeRates.findFirst({
    where: and(eq(exchangeRates.base, target), eq(exchangeRates.target, base)),
  })
  if (inverse && Number(inverse.rate) !== 0) return 1 / Number(inverse.rate)

  return 1 // unknown pair — caller should treat as same-currency
}

// Re-export for server-side consumers that import from this module
export { formatCurrency } from '@/lib/utils/format'
```

---

### Step 2: Also store inverse rates in the cron to reduce query load (optional but preferred)

In `src/app/api/cron/exchange-rates/route.ts`, after upserting the direct rate, also upsert the inverse inside the same loop:
```ts
// After the existing upsert block, inside the for loop:
const inverseRate = rate !== 0 ? 1 / rate : 0
await db
  .insert(exchangeRates)
  .values({ base: target, target: 'INR', rate: String(inverseRate), fetchedAt: new Date() })
  .onConflictDoUpdate({
    target: [exchangeRates.base, exchangeRates.target],
    set: { rate: String(inverseRate), fetchedAt: new Date() },
  })
updated++
```

---

### Step 3: Commit

```bash
git add src/lib/utils/currency.ts src/app/api/cron/exchange-rates/route.ts
git commit -m "fix: getRate now resolves inverse currency pairs so USD→INR conversions work"
```

---

## Task 3: Fix import — add convertedAmount/baseCurrency + fix CRON_SECRET guard

**Problem A:** Imported transactions miss `convertedAmount` and `baseCurrency`, causing them to appear as zero in cash-flow and category reports which aggregate `convertedAmount`.

**Problem B:** If `CRON_SECRET` env var is unset, the check `secret !== process.env.CRON_SECRET` compares `null !== undefined` which is `true` → request is forbidden even for legitimate callers. But if *both* are undefined, the check passes — meaning any request with no header can hit the cron when the secret is not configured.

**Files:**
- Modify: `src/app/api/import/route.ts`
- Modify: `src/app/api/cron/exchange-rates/route.ts`

---

### Step 1: Add conversion computation to import

In `src/app/api/import/route.ts`, add imports at top:
```ts
import { users } from '@/lib/db/schema'
import { getRate } from '@/lib/utils/currency'
```

After resolving `userId` (line 13), fetch the user's default currency once before the loop:
```ts
const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'
```

Replace the `db.insert(transactions).values(...)` block (lines 68-77) with:
```ts
const amount = parseFloat(row.amount)
const currency = row.currency || 'INR'
const rate = await getRate(currency, baseCurrency)
const convertedAmount = amount * rate

await db.insert(transactions).values({
  userId,
  accountId: accountRows[0].id,
  type: txType,
  amount: String(amount),
  currency,
  convertedAmount: String(convertedAmount),
  baseCurrency,
  categoryId,
  note: row.note || null,
  date: row.date,
})
```

---

### Step 2: Harden CRON_SECRET guard

Replace lines 8-11 of `src/app/api/cron/exchange-rates/route.ts`:
```ts
// Before
const secret = req.headers.get('x-cron-secret')
if (secret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// After
const cronSecret = process.env.CRON_SECRET
if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

### Step 3: Commit

```bash
git add src/app/api/import/route.ts src/app/api/cron/exchange-rates/route.ts
git commit -m "fix: imported transactions now compute convertedAmount/baseCurrency; harden cron secret check"
```

---

## Task 4: Fix CSV export to be import-compatible

**Problem:** Export emits `date,type,amount,currency,note`. The import template and importer require `account` (mandatory) and `category` (optional). Exported files cannot be re-imported.

**Files:**
- Modify: `src/app/api/export/route.ts`

---

### Step 1: Join accounts and categories in the export query

Replace the entire `export/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      date: transactions.date,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      note: transactions.note,
      accountName: accounts.name,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, session.user.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date))

  const header = 'date,type,amount,currency,category,account,note\n'
  const csv = rows
    .map((t) =>
      [
        t.date,
        t.type,
        t.amount,
        t.currency,
        escapeCsvField(t.categoryName ?? ''),
        escapeCsvField(t.accountName ?? ''),
        escapeCsvField(t.note ?? ''),
      ].join(',')
    )
    .join('\n')

  return new NextResponse(header + csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ledgerify-export.csv"',
    },
  })
}
```

---

### Step 2: Commit

```bash
git add src/app/api/export/route.ts
git commit -m "fix: CSV export now includes account and category columns for import round-trip compatibility"
```

---

## Task 5: Fix transfer — disable until fully implemented

**Problem:** Transfer is offered as a first-class transaction type but has no destination account selector in the form, and net worth ignores transfer rows. This makes "Move money between accounts" a no-op that corrupts ledger balances.

**Decision:** Disable Transfer from the UI and CSV import until source/destination + balance math is fully implemented. This is the safe corrective choice per the issue's acceptance criteria.

**Files:**
- Modify: `src/components/transactions/TransactionForm.tsx`
- Modify: `src/components/shared/BottomNav.tsx`
- Modify: `src/app/api/import/route.ts`

---

### Step 1: Remove Transfer option from TransactionForm

In `src/components/transactions/TransactionForm.tsx`, remove the transfer entry from the `transactionTypes` array (lines 48-54):
```ts
// Remove this block entirely:
{
  value: "transfer",
  label: "Transfer",
  icon: ArrowLeftRight,
  tone: "info" as const,
},
```

Also update `defaultType` logic (lines 24-27) — remove `requestedType === "transfer"`:
```ts
// Before
const defaultType =
  requestedType === "income" || requestedType === "transfer"
    ? requestedType
    : "expense";

// After
const defaultType = requestedType === "income" ? "income" : "expense";
```

Remove unused `ArrowLeftRight` import from line 4 (only if no other usage exists in the file — it is not used elsewhere in this file after the change).

---

### Step 2: Remove Transfer quick-action from BottomNav

In `src/components/shared/BottomNav.tsx`, remove the transfer entry from the `quickActions` array (lines 54-60):
```ts
// Remove this block entirely:
{
  href: "/transactions?type=transfer",
  label: "Transfer",
  description: "Move money between accounts",
  icon: ArrowLeftRight,
  tone: "text-sky-600 bg-sky-50 border-sky-200",
},
```

Remove `ArrowLeftRight` from the lucide-react import if it is no longer used elsewhere in the file. Check: `ArrowLeftRight` is used in `primaryTabs[1].icon` (Activity tab) — so keep the import, just remove it from `quickActions`.

---

### Step 3: Reject transfer type in CSV import

In `src/app/api/import/route.ts`, update the type validation (around line 62):
```ts
// Before
const txType = row.type as 'income' | 'expense' | 'transfer'
if (!['income', 'expense', 'transfer'].includes(txType)) {
  errors.push(`Row ${rowNum}: invalid type "${row.type}"`)
  continue
}

// After — transfers are not yet supported in import
const txType = row.type as 'income' | 'expense'
if (!['income', 'expense'].includes(txType)) {
  errors.push(`Row ${rowNum}: type "${row.type}" is not supported. Use "income" or "expense".`)
  continue
}
```

---

### Step 4: Commit

```bash
git add src/components/transactions/TransactionForm.tsx \
        src/components/shared/BottomNav.tsx \
        src/app/api/import/route.ts
git commit -m "fix: disable transfer type in UI and CSV import until full source/destination semantics are implemented"
```

---

## Task 6: Fix mobile quick-add — open sheet directly with type pre-selected

**Problem:** Quick-add links go to `/transactions?type=expense` which lands on the transactions list page with the sheet closed. The `TransactionForm` reads `type` from URL params but is only visible after the user manually clicks "Add transaction".

**Solution:** Convert `TransactionPage` to a client-aware shell that auto-opens the sheet when a `type` query param is present. Use a `defaultOpen` prop on the `Sheet` component driven by the URL param.

**Files:**
- Modify: `src/app/(app)/transactions/page.tsx`
- Create: `src/components/transactions/TransactionSheetTrigger.tsx`

---

### Step 1: Create `TransactionSheetTrigger` client component

Create `src/components/transactions/TransactionSheetTrigger.tsx`:
```tsx
"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { Account, Category } from "@/lib/db/schema";

interface Props {
  accounts: Account[];
  categories: Category[];
}

export function TransactionSheetTrigger({ accounts, categories }: Props) {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const shouldAutoOpen = typeParam === "expense" || typeParam === "income";
  const [open, setOpen] = useState(false);

  // Auto-open the sheet when a ?type= param is present on mount
  useEffect(() => {
    if (shouldAutoOpen) {
      setOpen(true);
    }
  }, [shouldAutoOpen]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
        <Plus className="h-4 w-4" />
        Add transaction
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
          <SheetDescription>
            Capture the basics first. You can keep it simple and add more detail
            later.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <TransactionForm accounts={accounts} categories={categories} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

### Step 2: Replace the inline Sheet in `transactions/page.tsx` with the new component

In `src/app/(app)/transactions/page.tsx`, replace the imports for `Sheet`, `SheetContent`, `SheetDescription`, `SheetHeader`, `SheetTitle`, `SheetTrigger` and add the new component import:
```ts
import { TransactionSheetTrigger } from "@/components/transactions/TransactionSheetTrigger";
```

Remove the individual Sheet-component imports that are no longer used at the top level.

Replace the `hasAccounts` ternary in the `action` prop (lines 53-82):
```tsx
// Before
action={
  hasAccounts ? (
    <Sheet>
      <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
        <Plus className="h-4 w-4" />
        Add transaction
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
          <SheetDescription>
            Capture the basics first...
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <TransactionForm accounts={accountList} categories={categoryList} />
        </div>
      </SheetContent>
    </Sheet>
  ) : (
    <HeaderActionLink href="/settings/accounts">
      <Plus className="h-4 w-4" />
      Add account
    </HeaderActionLink>
  )
}

// After
action={
  hasAccounts ? (
    <TransactionSheetTrigger accounts={accountList} categories={categoryList} />
  ) : (
    <HeaderActionLink href="/settings/accounts">
      <Plus className="h-4 w-4" />
      Add account
    </HeaderActionLink>
  )
}
```

Also remove the now-unused `Button` import from this page (it was only used inside the sheet trigger).

---

### Step 3: Wrap `TransactionSheetTrigger` in a `Suspense` boundary (required for `useSearchParams`)

`useSearchParams()` requires a `Suspense` boundary in the Next.js App Router. In `transactions/page.tsx`, add at the top:
```ts
import { Suspense } from "react";
```

Wrap the component usage:
```tsx
action={
  hasAccounts ? (
    <Suspense fallback={
      <Button size="lg" className="rounded-2xl" disabled>
        <Plus className="h-4 w-4" />
        Add transaction
      </Button>
    }>
      <TransactionSheetTrigger accounts={accountList} categories={categoryList} />
    </Suspense>
  ) : (
    <HeaderActionLink href="/settings/accounts">
      <Plus className="h-4 w-4" />
      Add account
    </HeaderActionLink>
  )
}
```

---

### Step 4: Commit

```bash
git add src/components/transactions/TransactionSheetTrigger.tsx \
        src/app/(app)/transactions/page.tsx
git commit -m "fix: mobile quick-add now auto-opens the transaction sheet with correct type pre-selected"
```

---

## Task 7: Add confirmation dialogs for all destructive delete actions

**Problem:** Delete actions for transactions, accounts, categories, budgets, goals, investments, loans, and policies all execute immediately on click with no confirmation or undo.

**Solution:** Use the existing `Dialog` component (already in `src/components/ui/dialog.tsx`) to wrap each delete button in an "Are you sure?" confirmation. Apply the same pattern to all 8 affected components.

**Files:**
- Modify: `src/components/transactions/TransactionList.tsx` — `DeleteButton` component (lines 49-68)
- Modify: `src/components/budgets/BudgetCard.tsx` (lines 85-94)
- Modify: `src/components/budgets/GoalCard.tsx` (lines 175-184)
- Modify: `src/components/settings/AccountsClient.tsx`
- Modify: `src/components/settings/CategoriesClient.tsx`
- Modify: `src/components/investments/AssetCard.tsx`
- Modify: `src/components/loans/LoanCard.tsx`
- Modify: `src/components/insurance/PolicyCard.tsx`

The pattern is identical for all: wrap the delete trigger in a `Dialog`, show a confirmation message, and only call the server action on confirm.

---

### Step 1: Update `DeleteButton` in `TransactionList.tsx`

Replace the `DeleteButton` component (lines 49-68) with:
```tsx
function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      await deleteTransaction(id);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete transaction"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete transaction?</DialogTitle>
          <DialogDescription>
            This transaction will be permanently removed. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Add Dialog imports at the top of `TransactionList.tsx`:
```ts
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
```

Also add `useState` to the existing React import.

---

### Step 2: Update `BudgetCard.tsx` delete button

Replace the `handleDelete` function and button (lines 32-94) in `BudgetCard.tsx`:

Add `useState` to the React import:
```ts
import { useState, useTransition } from 'react'
```

Add Dialog imports:
```ts
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
```

Replace the delete button (lines 85-94):
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      className="mt-5 w-full rounded-2xl text-destructive hover:text-destructive"
      disabled={isPending}
    >
      <Trash2 className="size-4" />
      Delete budget
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete budget?</DialogTitle>
      <DialogDescription>
        "{budget.name}" will be permanently removed. This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button
        variant="destructive"
        onClick={() => startTransition(async () => { await deleteBudget(budget.id) })}
        disabled={isPending}
      >
        {isPending ? "Deleting…" : "Delete"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Step 3: Update `GoalCard.tsx` delete button

`GoalCard.tsx` already imports `Dialog` components. Replace the delete `Button` (lines 175-184) with:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button
      variant="destructive"
      size="sm"
      className={goal.status === 'active' ? 'rounded-2xl' : 'flex-1 rounded-2xl'}
      disabled={isPending}
    >
      <Trash2 className="size-4" />
      Delete
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete goal?</DialogTitle>
      <DialogDescription>
        "{goal.name}" will be permanently removed. This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button
        variant="destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? "Deleting…" : "Delete"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Also add `DialogDescription` to the existing Dialog import in `GoalCard.tsx`.

---

### Step 4: Update `AccountsClient.tsx`, `CategoriesClient.tsx`, `AssetCard.tsx`, `LoanCard.tsx`, `PolicyCard.tsx`

For each of these files, apply the same pattern:
1. Add `useState` to the React import if not present.
2. Add Dialog imports from `@/components/ui/dialog`.
3. Wrap the existing delete button in a `<Dialog>` with confirm/cancel.
4. Move the server action call from `onClick` of the trigger button into the `DialogFooter` confirm button.

The confirmation messages should be contextual:
- Accounts: "Delete account? All transaction history will remain but this account will no longer appear in dropdowns."
- Categories: "Delete category? Existing transactions will keep their category label but you won't be able to select it for new ones."
- Investments: "Delete investment? This record will be permanently removed."
- Loans: "Delete loan? All payment history for this loan will also be removed."
- Policies: "Delete policy? This insurance policy record will be permanently removed."

> **Note:** Read each file before editing to get exact line numbers. The pattern is the same for all.

---

### Step 5: Fix "Deleting..." → "Deleting…" ellipsis in all modified files

The Web Interface Guidelines require `…` (Unicode ellipsis) not `...` (three dots). While editing each component for the dialog, update the pending label text:
- `"Deleting..."` → `"Deleting…"`
- `"Saving..."` → `"Saving…"`
- `"Adding..."` → `"Adding…"`

Files already correct: `TransactionForm.tsx` (line 207) already uses `"Saving…"`.

---

### Step 6: Commit

```bash
git add src/components/transactions/TransactionList.tsx \
        src/components/budgets/BudgetCard.tsx \
        src/components/budgets/GoalCard.tsx \
        src/components/settings/AccountsClient.tsx \
        src/components/settings/CategoriesClient.tsx \
        src/components/investments/AssetCard.tsx \
        src/components/loans/LoanCard.tsx \
        src/components/insurance/PolicyCard.tsx
git commit -m "fix: add confirmation dialogs for all destructive delete actions"
```

---

## Summary of all changes

| Task | Files changed | Risk |
|------|--------------|------|
| 1. Category ownership | 7 files | Low — additive filter only |
| 2. Exchange rate direction | 2 files | Medium — affects all convertedAmount calc |
| 3. Import conversion fields | 2 files | Low — fills previously-null fields |
| 4. Export round-trip | 1 file | Low — additive columns |
| 5. Disable transfer | 3 files | Low — removes incomplete feature |
| 6. Mobile quick-add | 2 files + 1 new | Low — additive client component |
| 7. Delete confirmations | 8 files | Low — wraps existing buttons |

## Manual verification checklist

After implementing all tasks, verify:

- [ ] Creating a transaction only shows categories you own or system categories in the dropdown.
- [ ] A second user's custom category is not visible in any dropdown or report.
- [ ] A manually entered USD transaction gets a non-1 `convertedAmount` when user default currency is INR.
- [ ] Import a CSV with `currency=USD` rows; verify `convertedAmount` is populated in DB (`SELECT converted_amount FROM transactions WHERE currency='USD'`).
- [ ] Export a CSV, re-import it — no errors about missing `account` column.
- [ ] The "Transfer" option does not appear in the transaction form or quick-add sheet.
- [ ] Tapping "Add expense" from the bottom nav opens the transaction sheet directly, pre-set to Expense.
- [ ] Tapping delete on any transaction/budget/goal/account/category/investment/loan/policy shows a confirmation dialog.
- [ ] Cron endpoint returns 403 when called with no `x-cron-secret` header.
