# Issue #7 Remaining Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining correctness, security, and UX gaps identified in issue #7 that were not addressed by PR #8, making the app production-usable.

**Architecture:** Server-action and API-route hardening (ownership guards, validation, revalidation), auth page redirect, `contributeToGoal` guard, networth `userId` filter, and `updateInvestmentPrice` server-side guard. No schema migrations required.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Zod v4, Auth.js v5 (`auth()`), TypeScript. No test framework exists — manual verification via `pnpm build` (type-check) after each task.

---

## Task 1: Redirect authenticated users away from auth pages

**Problem:** Signed-in users can manually visit `/auth/login` and `/auth/register`.

**Files:**
- Modify: `src/app/auth/layout.tsx`

**Step 1: Add redirect to auth layout**

Replace the layout with a server component that calls `auth()` and redirects if a session exists.

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.id) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
          <div className="hidden space-y-5 lg:block">
            <div className="inline-flex rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-primary">
              Quiet Ledger
            </div>
            <div className="space-y-3">
              <h1
                data-display-text
                className="max-w-xl text-4xl font-bold tracking-tight text-foreground"
              >
                Your private money home for everyday clarity.
              </h1>
              <p className="max-w-lg text-base leading-7 text-muted-foreground">
                Track cash flow, accounts, budgets, goals, wealth, and obligations in
                a calm space built for personal and family use.
              </p>
            </div>
            <div className="grid max-w-lg gap-3 text-sm text-muted-foreground">
              <div className="rounded-3xl border bg-card/70 p-4">
                Daily transactions stay quick to capture.
              </div>
              <div className="rounded-3xl border bg-card/70 p-4">
                Planning, protection, and wealth views stay easy to scan.
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Remove `'use client'` directive** — the layout is now a server component (no directive needed).

**Step 3: Verify**

```bash
pnpm build
```

Expected: no type errors. Visiting `/auth/login` while signed in now redirects to `/dashboard`.

**Step 4: Commit**

```bash
git add src/app/auth/layout.tsx
git commit -m "fix: redirect authenticated users away from auth pages"
```

---

## Task 2: Normalize email in registration and login

**Problem:** `registerUser` stores email as-is; `user@example.com` and `User@Example.com` can create duplicate accounts depending on DB collation.

**Files:**
- Modify: `src/app/actions/auth.ts`
- Modify: `src/lib/auth/config.ts`

**Step 1: Read `src/app/actions/auth.ts` to find the exact lines**

Look for the block that checks for an existing user and inserts. Replace `parsed.data.email` with a normalized form:

```ts
const email = parsed.data.email.toLowerCase().trim()

const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
if (existing.length) return { error: 'Email already registered' }

const hash = await bcrypt.hash(parsed.data.password, 12)
await db.insert(users).values({
  name: parsed.data.name,
  email,
  passwordHash: hash,
})
```

**Step 2: Normalize email in `src/lib/auth/config.ts` authorize callback**

Find the `authorize` function. Before querying the DB for the user, normalize:

```ts
const email = (credentials.email as string).toLowerCase().trim()
// use `email` in eq(users.email, email) instead of credentials.email
```

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/actions/auth.ts src/lib/auth/config.ts
git commit -m "fix: normalize email to lowercase on register and login"
```

---

## Task 3: Guard `contributeToGoal` against negative/NaN amounts and already-achieved goals

**Problem:** `contributeToGoal` in `src/app/actions/budgets.ts:90` accepts any `amount: number` — negative or NaN values can corrupt `currentAmount`. It also allows contributions to already-achieved goals.

**Files:**
- Modify: `src/app/actions/budgets.ts`

**Step 1: Add validation at the top of `contributeToGoal`**

After the `session` check (line 92), add:

```ts
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be a positive number' }
  }
```

**Step 2: Reject contributions to achieved goals**

After the `rows.length` check (line 97), add:

```ts
  if (goal.status === 'achieved') {
    return { error: 'This goal has already been achieved' }
  }
```

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/actions/budgets.ts
git commit -m "fix: guard contributeToGoal against invalid amounts and achieved goals"
```

---

## Task 4: Validate `linkedAccountId` ownership in `createSavingsGoal`

**Problem:** `createSavingsGoal` accepts `linkedAccountId` without checking it belongs to the current user.

**Files:**
- Modify: `src/app/actions/budgets.ts`
- Add import: `accounts` table, `isNull` from drizzle (already imported via `budgets.ts` — check first)

**Step 1: Add accounts to imports if missing**

At top of `src/app/actions/budgets.ts`, ensure `accounts` is imported from `@/lib/db/schema`.

**Step 2: Add ownership check after schema parse in `createSavingsGoal`**

After `if (!parsed.success)` check (line 73), before the `db.insert`, add:

```ts
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
```

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/actions/budgets.ts
git commit -m "fix: validate linkedAccountId ownership in createSavingsGoal"
```

---

## Task 5: Add `userId` filter to networth transaction balance query

**Problem:** `computeNetworth` in `src/lib/utils/networth.ts:54` queries transactions by `accountId` only, without `transactions.userId`. Practically safe since account IDs are UUIDs, but should be explicit.

**Files:**
- Modify: `src/lib/utils/networth.ts`

**Step 1: Add `userId` to the transactions WHERE clause**

Find the `.where(and(...))` block at line 54–57:

```ts
      .where(and(
        eq(transactions.accountId, account.id),
        isNull(transactions.deletedAt),
      ))
```

Replace with:

```ts
      .where(and(
        eq(transactions.accountId, account.id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ))
```

**Step 2: Verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/lib/utils/networth.ts
git commit -m "fix: add userId filter to networth transaction balance query"
```

---

## Task 6: Guard `updateInvestmentPrice` against invalid values server-side

**Problem:** `updateInvestmentPrice` in `src/app/actions/investments.ts:61` accepts any `currentPrice: number` — negative or NaN values can be stored.

**Files:**
- Modify: `src/app/actions/investments.ts`

**Step 1: Add validation after the session check**

After `if (!session?.user?.id)` (line 63), add:

```ts
  if (!Number.isFinite(currentPrice) || currentPrice < 0) {
    return { error: 'Price must be a non-negative number' }
  }
```

**Step 2: Verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/actions/investments.ts
git commit -m "fix: validate currentPrice in updateInvestmentPrice server action"
```

---

## Task 7: Uppercase currency in investments, loans, and insurance actions

**Problem:** `createInvestment`, `createLoan`, and `createPolicy` do not uppercase the `currency` field, while all other actions do (transactions, accounts, budgets, profile).

**Files:**
- Modify: `src/app/actions/investments.ts`
- Modify: `src/app/actions/loans.ts`
- Modify: `src/app/actions/insurance.ts`

**Step 1: investments.ts — uppercase currency before parsing**

In `createInvestment`, the parse is:
```ts
  const parsed = investmentSchema.safeParse(Object.fromEntries(formData))
```

Replace with:
```ts
  const raw = Object.fromEntries(formData)
  const parsed = investmentSchema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
```

**Step 2: loans.ts — uppercase currency before parsing**

In `createLoan`, replace:
```ts
  const parsed = loanSchema.safeParse(Object.fromEntries(formData))
```
With:
```ts
  const raw = Object.fromEntries(formData)
  const parsed = loanSchema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
```

**Step 3: insurance.ts — uppercase currency before parsing**

In `createPolicy`, replace:
```ts
  const parsed = insuranceSchema.safeParse(Object.fromEntries(formData))
```
With:
```ts
  const raw = Object.fromEntries(formData)
  const parsed = insuranceSchema.safeParse({
    ...raw,
    currency: String(raw.currency ?? '').toUpperCase(),
  })
```

**Step 4: Verify**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add src/app/actions/investments.ts src/app/actions/loans.ts src/app/actions/insurance.ts
git commit -m "fix: uppercase currency in investment, loan, and insurance actions"
```

---

## Task 8: Fix optional numeric coercion (blank → null) in investment schema

**Problem:** `investmentSchema` uses `z.coerce.number().optional()` for `quantity`, `buyPrice`, `currentPrice`, `interestRate`. Empty form strings coerce to `0` via Zod's coerce, not `undefined`/`null`, so blank optional fields are stored as `0`.

**Files:**
- Modify: `src/lib/validations/investment.ts`

**Step 1: Replace coerce-optional fields with a nullable transform**

Replace the four optional numeric fields with a pattern that treats empty string as `undefined`:

```ts
import { z } from 'zod'

const optionalPositiveNumber = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().positive().optional(),
)

export const investmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  assetType: z.enum(['stock', 'mf', 'crypto', 'fd', 'ppf', 'nps', 'gold', 'silver', 'real_estate', 'savings', 'other']),
  currency: z.string().length(3),
  quantity: optionalPositiveNumber,
  buyPrice: optionalPositiveNumber,
  currentPrice: optionalPositiveNumber,
  maturityDate: z.string().optional(),
  interestRate: optionalPositiveNumber,
})
```

Keep `investmentTxSchema` unchanged.

**Step 2: Verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/lib/validations/investment.ts
git commit -m "fix: treat empty optional numeric fields as undefined in investmentSchema"
```

---

## Task 9: Validate timezone in `updateProfile`

**Problem:** `updateProfile` accepts any free-text string for `timezone` and stores it. Invalid values silently persist.

**Files:**
- Modify: `src/app/actions/settings.ts`

**Step 1: Add timezone validation using `Intl.supportedValuesOf`**

In the `updateProfile` schema definition (lines 13–17), add a `.refine` on the timezone field:

```ts
  const schema = z.object({
    name: z.string().min(1),
    defaultCurrency: z.string().length(3),
    timezone: z.string().min(1).refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz })
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid timezone' },
    ),
  })
```

**Step 2: Verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/actions/settings.ts
git commit -m "fix: validate timezone against Intl in updateProfile"
```

---

## Task 10: Validate `endDate >= startDate` in budget and insurance schemas

**Problem:** `budgetSchema` and `insuranceSchema` accept `endDate` before `startDate` without error.

**Files:**
- Modify: `src/lib/validations/budget.ts`
- Modify: `src/lib/validations/insurance.ts`

**Step 1: Add `.refine` to `budgetSchema`**

After the existing fields, add a superRefine or wrap in `.refine`:

```ts
export const budgetSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  periodType: z.enum(['monthly', 'weekly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (d) => !d.endDate || d.endDate >= d.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
)
```

**Step 2: Add `.refine` to `insuranceSchema`**

Read `src/lib/validations/insurance.ts` first to see the exact field names, then add:

```ts
}).refine(
  (d) => !d.endDate || !d.startDate || d.endDate >= d.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
)
```

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/lib/validations/budget.ts src/lib/validations/insurance.ts
git commit -m "fix: validate endDate >= startDate in budget and insurance schemas"
```

---

## Task 11: Broaden revalidation after mutations

**Problem:** Most actions only revalidate their own page. Other pages that display the same data (dashboard, reports, networth, budgets) stay stale until navigation.

**Files:**
- Modify: `src/app/actions/transactions.ts`
- Modify: `src/app/actions/settings.ts`
- Modify: `src/app/actions/budgets.ts`
- Modify: `src/app/actions/investments.ts`
- Modify: `src/app/actions/loans.ts`
- Modify: `src/app/actions/insurance.ts`

**Step 1: transactions.ts — add missing revalidations**

`createTransaction`, `updateTransaction`, `deleteTransaction` currently revalidate `/transactions` and `/dashboard`. Add:

```ts
revalidatePath('/reports/cash-flow')
revalidatePath('/reports/category-breakdown')
revalidatePath('/reports/budget-vs-actual')
revalidatePath('/networth')
revalidatePath('/budgets')
```

**Step 2: settings.ts — broaden after account/category mutations**

`deleteAccount` and `createAccount`: add `/dashboard`, `/transactions`, `/networth`, `/reports/cash-flow`.

`deleteCategory` and `createCategory`: add `/dashboard`, `/transactions`, `/budgets`, `/reports/category-breakdown`.

`updateProfile`: add `/dashboard`, `/networth` (default currency change affects conversions).

**Step 3: budgets.ts — broaden budget revalidations**

`createBudget` and `deleteBudget`: add `/dashboard`, `/reports/budget-vs-actual`.

`createSavingsGoal` and `deleteSavingsGoal` and `contributeToGoal`: already revalidate `/budgets/goals` — also add `/dashboard`.

**Step 4: investments.ts — broaden**

`createInvestment`, `updateInvestmentPrice`, `deleteInvestment`: add `/dashboard`, `/networth`, `/reports/investment-returns`.

**Step 5: loans.ts — broaden**

`createLoan`, `recordLoanPayment`, `deleteLoan`: add `/dashboard`, `/networth`, `/reports/debt-payoff`.

**Step 6: insurance.ts — broaden**

`createPolicy`, `recordPremiumPayment`, `deletePolicy`: add `/dashboard`.

**Step 7: Verify**

```bash
pnpm build
```

**Step 8: Commit**

```bash
git add src/app/actions/transactions.ts src/app/actions/settings.ts src/app/actions/budgets.ts src/app/actions/investments.ts src/app/actions/loans.ts src/app/actions/insurance.ts
git commit -m "fix: broaden revalidatePath calls after all mutations to keep dependent pages fresh"
```

---

## Task 12: Expose `recordLoanPayment` and `recordPremiumPayment` via UI

**Problem:** Both actions exist and work, but no UI calls them — users have no way to record loan payments or insurance premium payments.

**Files:**
- Modify: `src/components/loans/LoanCard.tsx`
- Modify: `src/components/insurance/PolicyCard.tsx`
- Read these files first to understand current structure before editing.

**Step 1: Read the existing LoanCard and PolicyCard to understand their structure**

```bash
cat src/components/loans/LoanCard.tsx
cat src/components/insurance/PolicyCard.tsx
```

**Step 2: Add a "Record payment" Dialog to LoanCard**

Inside `LoanCard`, after the existing delete dialog, add a new Dialog that contains a small form:
- Fields: `date` (date input, default today), `amount` (number input), `principalComponent` (number, optional), `interestComponent` (number, optional), `status` (select: paid|partial|missed, default paid)
- On submit: call `recordLoanPayment` as a form action via `useActionState` or a `startTransition` handler
- Show a toast on success/error using `sonner`

Skeleton:

```tsx
import { recordLoanPayment } from '@/app/actions/loans'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

// Inside component:
const [payPending, startPayTransition] = useTransition()

function handlePayment(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  fd.set('loanId', loan.id)
  startPayTransition(async () => {
    const result = await recordLoanPayment(null, fd)
    if (result?.error) toast.error(result.error)
    else toast.success('Payment recorded')
  })
}
```

Add a "Record payment" button (secondary/outline style) next to the delete button, opening a Dialog with the form.

**Step 3: Add a "Record payment" Dialog to PolicyCard**

Same pattern using `recordPremiumPayment`:
- Fields: `date` (date input, default today), `amount` (number), `status` (select: paid|due|missed, default paid)
- `policyId` set as hidden/fd field

**Step 4: Verify**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add src/components/loans/LoanCard.tsx src/components/insurance/PolicyCard.tsx
git commit -m "feat: expose recordLoanPayment and recordPremiumPayment via card UI dialogs"
```

---

## Task 13: Replace `"Saving..."` / `"Adding..."` / `"Deleting..."` with unicode ellipsis

**Problem:** Issue #7 audit flagged that several buttons use ASCII `...` instead of the unicode ellipsis character `…` (`\u2026`). This is both a copy standard issue and a web guideline compliance issue.

**Files:** Any component with a pending label using `"..."`.

**Step 1: Search for ASCII ellipsis in pending labels**

```bash
grep -r '\.\.\.' src/components --include="*.tsx" -l
```

**Step 2: Replace all occurrences in those files**

For each file found, replace patterns like:
- `"Saving..."` → `"Saving…"`
- `"Adding..."` → `"Adding…"`
- `"Deleting..."` → `"Deleting…"` (already fixed in PR #8 for some; verify no others remain)
- `"Signing in..."` → `"Signing in…"` (in `src/app/auth/login/page.tsx`)
- `"Submitting..."` → `"Submitting…"` (if present)

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add -u
git commit -m "fix: use unicode ellipsis in all pending button labels"
```

---

## Task 14: Final build verification and push

**Step 1: Run full build**

```bash
pnpm build
```

Expected: zero TypeScript errors, zero build failures.

**Step 2: If build passes, push to PR branch**

```bash
git push
```

**Step 3: Update PR description**

Add a note to PR #8 that the review feedback has been addressed and these additional correctness fixes have been applied.

```bash
gh pr comment 8 --body "All code review fixes applied plus remaining issue #7 correctness gaps resolved (Tasks 1–13 of docs/plans/2026-05-03-issue-7-remaining-fixes.md)."
```

---

## Summary of All Fixes

| Task | Area | Type |
|------|------|------|
| 1 | Auth pages redirect when signed in | Security |
| 2 | Email normalization on register/login | Correctness |
| 3 | `contributeToGoal` guards (negative amount, achieved status) | Correctness |
| 4 | `linkedAccountId` ownership in `createSavingsGoal` | Security |
| 5 | `userId` filter in networth transaction query | Correctness |
| 6 | `updateInvestmentPrice` validates price server-side | Correctness |
| 7 | Currency uppercased in investment/loan/insurance | Consistency |
| 8 | Optional numeric coercion (blank → null) in investmentSchema | Correctness |
| 9 | Timezone validated via `Intl` in `updateProfile` | Correctness |
| 10 | `endDate >= startDate` in budget and insurance schemas | Validation |
| 11 | Broad `revalidatePath` after all mutations | UX/Staleness |
| 12 | Loan payment and premium payment UI | Feature/UX |
| 13 | Unicode ellipsis in pending labels | Polish |
