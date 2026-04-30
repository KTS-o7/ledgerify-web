# Cashew Visual Rework v2 — Design

**Date:** 2026-04-30
**Branch:** `feat/cashew-visual-rework-v2`
**Scope:** Full UI rework across all app surfaces plus one schema ease-of-life change. No backend domain logic changes.

---

## 1. Context

PR #3 shipped Quiet Ledger foundations: design tokens, shared primitives in `quiet-ledger.tsx`, Manrope typography, appearance settings, and transaction toolbar basics. The plan doc `2026-04-29-cashew-inspired-ui-font-plan.md` explicitly flags the next step as Cashew Visual Rework v2 — making the visible app feel meaningfully different, not just adding settings infrastructure.

This document is the approved design for that rework.

---

## 2. Approach

One PR — schema change plus all UI segments together. The schema change is small (one column), and having it land with the UI that uses it is cleaner than a gap between PRs.

---

## 3. Schema Change

### 3.1 `accounts.currentBalance`

Add `current_balance NUMERIC DEFAULT 0 NOT NULL` to the `accounts` table.

**Migration:** New Drizzle migration file. No existing data is lost. Existing accounts start at `0` — users can set an opening balance or it will self-correct as transactions are entered.

**Maintenance:** All transaction server actions (`createTransaction`, `updateTransaction`, `deleteTransaction`) must update the affected account's `currentBalance` atomically in the same DB call:
- Income: `currentBalance += amount`
- Expense: `currentBalance -= amount`
- Transfer: source `currentBalance -= amount`, destination `currentBalance += amount`
- Update: reverse old effect, apply new effect
- Delete: reverse the effect

**Simplification:** `computeNetworth` removes the per-account transaction sum SQL and uses `account.currentBalance` directly. This eliminates N+1 queries per account.

---

## 4. Dashboard Widgets

### 4.1 Balance Snapshot Widget

Replaces current `NetworthCard`. Uses `primary` tonal background.

Content:
- Small eyebrow: "Your money home"
- Large hero number: net worth in Manrope 48–56px bold
- Asset/liability chip strip below: Cash | Investments | Liabilities as colored tonal chips (`cash` sky, `investment` violet, `loan` orange)
- Quick-link row: Overview → Accounts → Investments → Loans

### 4.2 Daily Money Widget

Replaces current `CashFlowSummary`. Uses `cash` tonal background.

Content:
- 3 compact `AmountBox` tiles: Income / Expenses / Net
- Plain-language status line derived from net: "Spending is below income this month" / "Expenses are ahead this month" / "Balanced"
- Month progress bar (days elapsed / total days)
- Expense pace vs income (existing)
- Transaction count

### 4.3 Quick Add Strip

New. Sits between the hero snapshot and the planning widgets on the dashboard.

Content:
- 3 pill/tile action buttons: `+ Expense` (rose), `+ Income` (emerald), `+ Transfer` (sky)
- Each links to `/transactions?type=expense` etc. using existing query-param defaulting on `TransactionForm`

### 4.4 Planning Widgets

New. Requires adding budget + savings goal queries to the dashboard server component loader.

**Budget Health Tile:**
- Total budgets count
- Safe / At-risk / Over counts with colored chips
- Overall spend vs total budget limits as a progress bar

**Goal Progress Tile:**
- Total saved across all goals vs total target
- Percentage ring
- Goals count and active deadline count

### 4.5 Protection & Debt Widget

Replaces/extends current `UpcomingAlerts`. Uses `insurance` indigo tonal background.

Content:
- Loan EMIs and insurance renewals in a unified attention list
- Denser Cashew-style rows: domain icon → name + description → due-date countdown pill → amount
- No structural change to data loading

### 4.6 Recent Activity

Replaces current `RecentTransactions`.

Content:
- Category/account glyph (colored tonal square, first letter of category or transaction type initial)
- Row layout: glyph → note (primary) + category·account (secondary) → date → signed amount
- No visible delete on dashboard surface
- "View all" link preserved

### 4.7 DashboardSections

Add `planning` slot alongside existing slots. Visibility toggle gains "Planning" section button. Section ordering: setup → snapshot → quickAdd → cashFlow → planning → attention → recent.

---

## 5. Transactions

### 5.1 Summary Strip

New. Above the transaction list, show 3 compact `AmountBox` tiles: Income / Expenses / Net computed client-side from the currently visible (filtered) transaction set.

### 5.2 Segmented Control

Replace current type filter chips with a Material-style segmented selector: `All | Income | Expenses | Transfers`. Active segment has filled tonal background.

### 5.3 Category/Account Glyph

Each transaction row gets a colored tonal square: first letter of category name if available, else transaction type initial. Color driven by transaction type tone (`positive` for income, `negative` for expense, `info` for transfer).

### 5.4 Row Layout

Order: glyph → note (primary) + category·account (secondary) → date·tags → signed amount.

Delete moved to overflow `⋯` menu. No visible destructive action in normal list view.

### 5.5 Empty State

3 action tiles: *Add expense*, *Add income*, *Import CSV*.

---

## 6. Budgets & Goals

### 6.1 Budget Cards

Progress-first surface:
- Budget name + category name
- Period badge (Monthly / Weekly)
- Spent / Limit as large fraction
- Colored progress bar: emerald (< 70%), amber (70–99%), rose (≥ 100%)
- Status badge: Safe / Watch / Over
- Days remaining in period

### 6.2 Budgets Page Header

Health summary strip:
- Total budget count
- Safe / Watch / Over counts as tonal chips
- Total spent vs total budget

### 6.3 Goal Cards

Progress-first motivating surface:
- Goal name + deadline
- Current / Target as large fraction
- Percentage progress bar (teal)
- Deadline pressure label: "X days left" or "Achieved"
- Contribute action button

---

## 7. Wealth & Obligations

### 7.1 Investments Page

Add portfolio summary widget at top (`investment` violet tonal):
- Total current value
- Total cost basis
- Unrealized P&L (amount + percentage, signed color)
- Asset-type allocation chips

Asset cards: domain-colored violet tonal treatment, P&L badges.

### 7.2 Loans Page

Add debt summary widget at top (`loan` orange tonal):
- Total outstanding balance
- Monthly EMI total
- Active loan count

Loan cards: payoff progress bar, months remaining label.

### 7.3 Insurance Page

Add coverage summary widget at top (`insurance` indigo tonal):
- Total coverage amount
- Annual premium total
- Next renewal countdown

Policy cards: indigo tonal treatment, renewal urgency states.

---

## 8. Reports

### 8.1 Summary Cards Strip

Each report page gets a 3-card summary strip above the chart showing the most useful derived stats (e.g., cash flow: avg monthly income, avg monthly expenses, net trend).

### 8.2 Chart Standards

- Softer grid lines (`stroke-muted-foreground/20`)
- Rounded bars (`radius={4}`)
- Semantic tooltip colors matching Quiet Ledger tones
- Consistent chart container height (300px mobile, 380px desktop)
- Each report gets one derived plain-language insight sentence

### 8.3 Reports Index

Replace card grid with featured insight tiles, each showing a key stat from the underlying data.

---

## 9. Import Page

Restructure as 3-step guided flow:
1. **Choose file** — drag-drop zone + file picker, template download link
2. **Review columns** — visual checklist of required CSV columns with check/cross per column detected in the file
3. **Import** — progress indicator during parse, success/error summary

No backend changes to `/api/import` route.

---

## 10. Constraints

- No additional schema changes beyond `accounts.currentBalance`
- No backend domain logic changes
- No new DB tables
- All filtering/computation that can run client-side stays client-side
- Validation must pass: `bunx tsc --noEmit`, `bun run lint`, `bun run build`

---

## 11. Success Criteria

- Dashboard looks visibly Cashew-inspired at first glance: large tonal widgets, not a metrics grid
- Transaction list has glyph icons, segmented control, summary strip
- Budget and goal cards are progress-first
- Investment, loan, insurance pages have domain-colored summary widgets
- Reports have chart-standard containers and insight copy
- Import has guided flow
- All pages pass the UX Quality Checklist from `2026-04-29-ux-ui-refresh.md`
- No schema migrations other than `accounts.currentBalance`
- CI passes: typecheck + lint + build
