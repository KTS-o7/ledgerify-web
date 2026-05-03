# Credit Card + Summary Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add credit card as a first-class account type, add `credit_payment` transaction type, and enrich `/api/v1/summary` with loans, insurance renewals, and investment P&L so an agent has full financial triage in one call.

**Architecture:** Three independent changes — (1) schema migration adding `credit_card` account type + credit fields + `credit_payment` transaction type, (2) balance logic updated to handle credit card polarity, (3) summary route enriched with data already in existing tables.

**Tech Stack:** Drizzle ORM, Postgres, Next.js 16, date-fns.

---

## Task 1: Schema — add `credit_card` account type + credit fields

**Files:**
- Modify: `src/lib/db/schema/accounts.ts`
- Modify: `src/lib/db/schema/transactions.ts`
- Run: `npm run db:generate && npm run db:migrate`

**Step 1: Edit `src/lib/db/schema/accounts.ts`**

Change `accountTypeEnum` to include `credit_card`:
```ts
export const accountTypeEnum = pgEnum('account_type', ['bank', 'wallet', 'cash', 'savings', 'credit_card'])
```

Add three new optional columns after `openingBalance`:
```ts
creditLimit: numeric('credit_limit', { precision: 18, scale: 4 }),
statementDay: numeric('statement_day', { precision: 2, scale: 0 }), // day of month 1-28
paymentDueDay: numeric('payment_due_day', { precision: 2, scale: 0 }), // day of month 1-28
```

**Step 2: Edit `src/lib/db/schema/transactions.ts`**

Change `transactionTypeEnum` to include `credit_payment`:
```ts
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer', 'credit_payment'])
```

`credit_payment` means: money moved from a bank account TO pay off a credit card balance. It reduces the bank balance and reduces the credit card outstanding. It is NOT an expense.

**Step 3: Generate + apply migration**
```bash
npm run db:generate
npm run db:migrate
```

**Step 4: Verify build**
```bash
npm run build
```
Expected: clean compile, new migration file in `drizzle/`.

**Step 5: Commit**
```bash
git add src/lib/db/schema/accounts.ts src/lib/db/schema/transactions.ts drizzle/
git commit -m "feat(schema): credit_card account type + creditLimit/statementDay/paymentDueDay + credit_payment transaction type"
```

---

## Task 2: Update `accountBalance` util + validation for credit card polarity

**Files:**
- Modify: `src/lib/utils/accountBalance.ts`
- Modify: `src/lib/validations/transaction.ts`

**Step 1: Update `getAccountBalance` in `src/lib/utils/accountBalance.ts`**

For a credit card account, the balance semantics flip:
- `openingBalance` = existing outstanding debt (positive = you owe money)
- `expense` transactions = increase the outstanding (you spent on the card)
- `credit_payment` transactions = decrease the outstanding (you paid the bill)
- `income` is not valid on a credit card

Replace the `txBalance` reduce with:
```ts
const isCreditCard = account.type === 'credit_card'

const txBalance = txs.reduce((sum, t) => {
  if (isCreditCard) {
    // For credit cards: expenses increase debt, credit_payments reduce it
    if (t.type === 'expense') return sum + Number(t.amount)
    if (t.type === 'credit_payment') return sum - Number(t.amount)
    return sum
  } else {
    // Normal accounts
    if (t.type === 'income') return sum + Number(t.amount)
    if (t.type === 'expense') return sum - Number(t.amount)
    if (t.type === 'credit_payment') return sum - Number(t.amount) // paying from this account
    return sum
  }
}, 0)

return Number(account.openingBalance ?? 0) + txBalance
```

Also update `attachRunningBalance` to handle `credit_payment`:
```ts
export function attachRunningBalance(
  txs: Transaction[],
  openingBalance: number,
  isCreditCard = false
): Array<Transaction & { runningBalance: number }> {
  const sorted = [...txs].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  let running = openingBalance
  return sorted.map(t => {
    if (isCreditCard) {
      if (t.type === 'expense') running += Number(t.amount)
      else if (t.type === 'credit_payment') running -= Number(t.amount)
    } else {
      if (t.type === 'income') running += Number(t.amount)
      else if (t.type === 'expense') running -= Number(t.amount)
      else if (t.type === 'credit_payment') running -= Number(t.amount)
    }
    return { ...t, runningBalance: running }
  })
}
```

**Step 2: Update `src/lib/validations/transaction.ts`**

Add `transfer` and `credit_payment` to the type enum (currently only `income`/`expense`):
```ts
type: z.enum(['income', 'expense', 'transfer', 'credit_payment']),
```

Also add optional credit card fields:
```ts
transferToId: z.string().uuid().optional(),
recurrenceInterval: z.coerce.number().int().positive().optional(),
recurrenceUnit: z.enum(['day', 'week', 'month']).optional(),
```

**Step 3: Verify build**
```bash
npm run build
```

**Step 4: Commit**
```bash
git add src/lib/utils/accountBalance.ts src/lib/validations/transaction.ts
git commit -m "feat: credit card balance polarity + credit_payment in validation"
```

---

## Task 3: Update `AccountCard` + `AccountTransactionTable` to handle credit cards

**Files:**
- Modify: `src/components/accounts/AccountCard.tsx`
- Modify: `src/components/accounts/AccountTransactionTable.tsx`
- Modify: `src/app/(app)/accounts/[id]/page.tsx`

**Step 1: Update `AccountCard`**

Add `credit_card` to `TYPE_DOT` map:
```ts
const TYPE_DOT: Record<string, string> = {
  bank: 'bg-sky-500',
  wallet: 'bg-violet-500',
  cash: 'bg-amber-500',
  savings: 'bg-emerald-500',
  credit_card: 'bg-rose-500',
}
```

For credit cards, show the balance differently — outstanding debt is shown in red with "outstanding" label, and show credit limit utilisation if set:
```tsx
// After the balance line, add for credit cards:
{account.type === 'credit_card' && (account as any).creditLimit && (
  <p className="text-xs text-muted-foreground mt-1">
    Limit: {formatCurrency(Number((account as any).creditLimit), account.currency)}
    {' · '}{Math.round((account.balance / Number((account as any).creditLimit)) * 100)}% used
  </p>
)}
```

Also change the balance label for credit cards: show "outstanding" instead of just the number.

**Step 2: Update `AccountTransactionTable`**

Pass `isCreditCard` boolean and use `attachRunningBalance(txs, openingBalance, isCreditCard)`.

**Step 3: Update `/accounts/[id]/page.tsx`**

Pass `isCreditCard = account.type === 'credit_card'` to `attachRunningBalance`.

**Step 4: Verify build + commit**
```bash
npm run build
git add src/components/accounts/AccountCard.tsx src/components/accounts/AccountTransactionTable.tsx src/app/(app)/accounts/[id]/page.tsx
git commit -m "feat: credit card display in AccountCard and transaction table"
```

---

## Task 4: Enrich `/api/v1/summary` with loans, insurance, investments

**Files:**
- Modify: `src/app/api/v1/summary/route.ts`

**Step 1: Add imports**

Add to existing imports:
```ts
import { loans, loanPayments, insurancePolicies, investments } from '@/lib/db/schema'
import { lte } from 'drizzle-orm'
import { addDays, differenceInDays } from 'date-fns'
import { getRate } from '@/lib/utils/currency'
```

**Step 2: Fetch loans, insurance, investments in parallel**

Add to the existing `Promise.all`:
```ts
const [accountList, budgetList, recentTxs, loanList, policyList, investmentList] = await Promise.all([
  db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
  db.select().from(budgets).where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
  db.select().from(transactions).where(and(
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    gte(transactions.date, heatmapStart),
  )),
  db.select().from(loans).where(and(eq(loans.userId, userId), isNull(loans.deletedAt))),
  db.select().from(insurancePolicies).where(and(eq(insurancePolicies.userId, userId), isNull(insurancePolicies.deletedAt))),
  db.select().from(investments).where(and(eq(investments.userId, userId), isNull(investments.deletedAt))),
])
```

**Step 3: Build `upcomingObligations` array**

After the existing budget summary, add:
```ts
const today = new Date()
const in30Days = format(addDays(today, 30), 'yyyy-MM-dd')
const todayStr = format(today, 'yyyy-MM-dd')

// Loan EMIs due in next 30 days
const upcomingEmis = loanList
  .filter(l => Number(l.outstandingBalance ?? 0) > 0)
  .map(l => {
    // Next EMI is on same day-of-month as startDate, next occurrence from today
    const startDate = new Date(l.startDate)
    const emiDay = startDate.getDate()
    const nextEmi = new Date(today.getFullYear(), today.getMonth(), emiDay)
    if (nextEmi < today) nextEmi.setMonth(nextEmi.getMonth() + 1)
    const nextEmiStr = format(nextEmi, 'yyyy-MM-dd')
    if (nextEmiStr > in30Days) return null
    return {
      type: 'loan_emi' as const,
      id: l.id,
      name: l.name,
      amount: Number(l.emiAmount),
      currency: l.currency,
      dueDate: nextEmiStr,
      daysUntil: differenceInDays(nextEmi, today),
      outstandingBalance: Number(l.outstandingBalance ?? 0),
    }
  })
  .filter(Boolean)

// Insurance renewals due in next 30 days
const upcomingRenewals = policyList
  .filter(p => p.renewalDate && p.renewalDate >= todayStr && p.renewalDate <= in30Days)
  .map(p => ({
    type: 'insurance_renewal' as const,
    id: p.id,
    name: p.name,
    amount: Number(p.premiumAmount),
    currency: p.currency,
    dueDate: p.renewalDate!,
    daysUntil: differenceInDays(new Date(p.renewalDate!), today),
    provider: p.provider,
  }))

// FD/bond maturities in next 30 days
const upcomingMaturities = investmentList
  .filter(i => i.maturityDate && i.maturityDate >= todayStr && i.maturityDate <= in30Days)
  .map(i => ({
    type: 'investment_maturity' as const,
    id: i.id,
    name: i.name,
    assetType: i.assetType,
    currency: i.currency,
    dueDate: i.maturityDate!,
    daysUntil: differenceInDays(new Date(i.maturityDate!), today),
    estimatedValue: Number(i.currentPrice ?? i.buyPrice ?? 0) * Number(i.quantity ?? 1),
  }))

const upcomingObligations = [
  ...upcomingEmis,
  ...upcomingRenewals,
  ...upcomingMaturities,
].sort((a, b) => (a!.daysUntil) - (b!.daysUntil))
```

**Step 4: Build `investmentSummary`**

```ts
const investmentSummary = await Promise.all(investmentList.map(async inv => {
  const rate = await getRate(inv.currency, baseCurrency)
  const currentValue = Number(inv.currentPrice ?? inv.buyPrice ?? 0) * Number(inv.quantity ?? 1) * rate
  const costBasis = Number(inv.buyPrice ?? 0) * Number(inv.quantity ?? 1) * rate
  const unrealisedPnl = currentValue - costBasis
  const unrealisedPnlPct = costBasis > 0 ? (unrealisedPnl / costBasis) * 100 : 0
  return {
    id: inv.id,
    name: inv.name,
    assetType: inv.assetType,
    currency: inv.currency,
    currentValue: Math.round(currentValue),
    costBasis: Math.round(costBasis),
    unrealisedPnl: Math.round(unrealisedPnl),
    unrealisedPnlPct: Math.round(unrealisedPnlPct * 10) / 10,
    maturityDate: inv.maturityDate,
  }
}))
```

**Step 5: Add `creditCards` section**

```ts
// Credit card outstanding summary
const creditCardSummary = accountSummary
  .filter(a => a.type === 'credit_card')
  .map(a => ({
    id: a.id,
    name: a.name,
    outstanding: a.balance, // positive = you owe this much
    currency: a.currency,
  }))
```

**Step 6: Return enriched response**

Update the `return NextResponse.json(...)` to include:
```ts
return NextResponse.json({
  generatedAt: new Date().toISOString(),
  baseCurrency,
  networth,
  accounts: accountSummary,
  creditCards: creditCardSummary,
  budgets: budgetSummary,
  upcomingObligations,   // ← NEW: EMIs, renewals, maturities in next 30 days
  investments: investmentSummary,  // ← NEW: P&L per investment
  anomalies,
  meta: {
    dailyAvgSpend30d: Math.round(dailyAvg),
    totalSpent30d: Math.round(totalSpent30),
    totalCreditOutstanding: creditCardSummary.reduce((s, c) => s + c.outstanding, 0),
    totalUpcomingObligations30d: upcomingObligations.reduce((s, o) => s + (o?.amount ?? 0), 0),
  },
})
```

**Step 7: Verify build**
```bash
npm run build
```

**Step 8: Commit**
```bash
git add src/app/api/v1/summary/route.ts
git commit -m "feat(api): enrich /api/v1/summary with loans, insurance renewals, investment P&L, credit cards"
```

---

## Task 5: Update Settings > Accounts form to support credit card fields

**Files:**
- Modify: `src/components/settings/AccountsClient.tsx`

**Step 1: Read the file** — find the account creation form.

**Step 2: Add `credit_card` as a selectable type option**

In whatever select/enum the form uses for account type, add `credit_card` as an option with label "Credit Card".

**Step 3: Show credit card fields conditionally**

When `type === 'credit_card'` is selected, show three additional fields:
- **Credit Limit** (number input, optional)
- **Statement Day** (number 1–28, "Day of month your statement is generated")
- **Payment Due Day** (number 1–28, "Day of month your payment is due")

**Step 4: Update the server action** (`src/app/actions/settings.ts` or wherever account creation is handled) to accept and save `creditLimit`, `statementDay`, `paymentDueDay`.

**Step 5: Verify build + commit**
```bash
npm run build
git add src/components/settings/AccountsClient.tsx src/app/actions/settings.ts
git commit -m "feat: credit card fields in account settings form"
```

---

## Task 6: Final build + push PR

**Step 1: Full build**
```bash
npm run build
```

**Step 2: Push**
```bash
git push origin feat/credit-card-and-summary
```

**Step 3: PR**
Title: `feat: credit card account type, credit_payment transactions, enriched /api/v1/summary`
