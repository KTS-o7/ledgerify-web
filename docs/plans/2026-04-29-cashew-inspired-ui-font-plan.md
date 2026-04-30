# Cashew-Inspired UI and Typography Follow-Up Plan

**Date:** 2026-04-29  
**Branch:** `feedback/quiet-ledger-followups`  
**Reference:** [`jameskokoska/Cashew`](https://github.com/jameskokoska/Cashew), [Cashew website](https://cashewapp.web.app/)  
**Scope:** UI polish, typography, density, personalization, chart presentation, and mobile ergonomics for Ledgerify after the Quiet Ledger refresh. No schema or backend/domain logic changes.

---

## 0. Current Status and Correction

**Status as of PR #3:** A first follow-up pass was implemented and merged, but it was too conservative.

Completed in PR #3:

- Added this Cashew-inspired planning document.
- Added Manrope display typography for headings and large financial values.
- Added local-only accent color and density preferences under Settings.
- Added transaction account/category filters and quick-action type defaults.
- Added basic report chart panels and derived insight copy.
- Added dashboard section visibility preferences stored in `localStorage`.

Important correction:

> PR #3 does **not** yet make Ledgerify visually feel like Cashew.

The work shipped in PR #3 is technically valid and keeps the no-schema-change boundary, but it mostly adds infrastructure and mild polish. It does not sufficiently adopt Cashew’s visible UI language: Material You tonal cards, mobile-first transaction composition, expressive widgets, richer category/account visuals, or graph-forward home surfaces.

The next implementation should be treated as **Cashew Visual Rework v2**, not as a continuation of small polish.

---

## 1. Why Cashew Is a Useful Reference

Cashew is a strong inspiration because it makes a finance app feel personal and adaptable instead of rigid. Its README highlights the qualities most relevant to Ledgerify:

- Material You design language.
- Custom accent color.
- Light and dark mode.
- Customizable home screen widgets.
- Detailed graph visuals.
- Adaptive UI across web and mobile.
- Fast transaction management with search and filters.
- Flexible budgets, accounts, currencies, and goals.

Ledgerify should not copy Cashew directly. Ledgerify should keep the **Quiet Ledger** positioning: private, family-friendly, calm, web-first, and trustworthy. Cashew should influence the next layer of polish: softer personalization, more expressive financial state, better typography, richer mobile ergonomics, and more useful chart surfaces.

### 1.1 Concrete Cashew Code Findings

The next pass should be grounded in the actual Cashew app structure, not only its README or screenshots. Relevant reference points from the local Cashew checkout:

- `budget/lib/colors.dart`: Cashew builds a Material 3 `ColorScheme` from a user accent seed, then derives light/dark backgrounds, navigation colors, splash colors, and local theme extensions from that seed.
- `budget/lib/pages/homePage/homePage.dart`: the home page is assembled from named widgets such as wallet switcher, wallet list, budgets, upcoming transactions, spending summary, net worth, objectives, credit/debts, line graph, pie chart, heatmap, and transactions.
- `budget/lib/pages/editHomePage.dart`: the home screen is not a fixed report; it has a real edit surface with enable/disable controls and per-widget settings.
- `budget/lib/widgets/transactionEntry/transactionEntry.dart`: transaction rows are visually led by category icon, transaction/category labels, tags, note indicator, transaction type affordance, and amount hierarchy.
- `budget/lib/widgets/categoryIcon.dart`: categories have dedicated colored icon containers, optional tinting, tooltip support, labels, and long-press edit affordances.
- `budget/lib/widgets/budgetContainer.dart`: budgets are treated as expressive containers with colored backgrounds, animated values, timeline context, and progress bars.
- `budget/lib/widgets/slidingSelectorIncomeExpense.dart` and `budget/lib/widgets/selectChips.dart`: filtering uses tactile segmented controls and chips, not plain select controls.
- `budget/lib/widgets/transactionsAmountBox.dart`: summary totals are compact tappable boxes with amount, label, and transaction count.
- `budget/lib/widgets/fab.dart` and `budget/lib/widgets/bottomNavBar.dart`: mobile primary action and navigation are first-class surfaces with custom sizes, tonal colors, and long-press/shortcut behavior.
- `budget/lib/widgets/importCSV.dart`: import is a guided mapping flow with progress and explicit required fields.

Translate these ideas into Ledgerify components. Do not copy Flutter code, names, animations, or implementation details directly.

---

## 2. Updated UI Direction

### 2.1 Product Feel

The current Quiet Ledger design should move one step warmer and more adaptive:

> **A calm personal finance home with Material-inspired warmth, precise numbers, and configurable focus.**

The app should feel:

- Less like a static dashboard.
- More like a personal money workspace.
- Warm but still financially serious.
- Mobile-friendly without losing desktop clarity.
- Configurable in appearance without becoming visually chaotic.
- Designed around glanceable financial cards, not generic CRUD panels.

### 2.2 What to Borrow From Cashew

Borrow:

- Soft Material-inspired surfaces.
- Clear accent color usage.
- Rounded, tactile interactive controls.
- Chart-first financial summaries.
- More forgiving empty states.
- More personal setup and preference controls.
- Strong mobile-first transaction flow.
- Dashboard sections that can feel modular.

Do not borrow:

- Overly app-like motion if it hurts desktop utility.
- Excessive customization before core workflows are stable.
- Dense feature sprawl.
- Any schema-heavy concepts that would require backend changes.

### 2.3 Cashew Visual Rework v2 Direction

The next pass must be visibly different at first glance. It should focus on concrete UI composition, not preferences infrastructure.

Primary visual moves:

- Replace generic metric-card grids with larger, colorful, widget-like financial tiles.
- Use Material You-style tonal containers for each domain:
  - Cash/accounts: sky tonal surface.
  - Spending: rose tonal surface.
  - Budgets: amber/teal tonal surface.
  - Goals: teal tonal surface.
  - Investments: emerald/violet tonal surface.
  - Loans: rose/orange tonal surface.
  - Insurance: indigo tonal surface.
- Add stronger icon-led cards with more useful subtitles and progress states.
- Make dashboard feel like a configurable mobile finance home, not a desktop report page.
- Make transaction entry and review feel like the center of the app.
- Make reports chart-first and visually richer.

This v2 pass should modify visible page composition before adding more settings or preferences.

---

## 3. Typography Plan

### 3.1 Recommended Font System

Ledgerify currently uses Geist, which is crisp and technical. For the next polish pass, use a two-font system:

1. **Interface font:** `Geist Sans`
   - Keep for navigation, controls, forms, tables, and dense UI.
   - It keeps Ledgerify precise and modern.

2. **Display/number alternative:** `Inter Tight` or `Manrope`
   - Use only for page titles, dashboard hero numbers, card headline numbers, and report totals.
   - Prefer `Manrope` if we want more warmth.
   - Prefer `Inter Tight` if we want more financial/product sharpness.

Recommended choice:

> Use **Manrope** for financial display text and keep **Geist Sans** for UI.

Why:

- Manrope has friendly geometry and strong numerals.
- It softens the app without making it playful.
- It pairs well with a private/family finance product.

### 3.2 Numeric Typography Rules

All monetary values, percentages, dates, and counts should use:

- `font-variant-numeric: tabular-nums`.
- Tight but readable line-height.
- No negative letter spacing.
- Larger sizes only where the number is the primary decision point.

Suggested scale:

- Hero net worth: `56px`, `700`, Manrope, tabular.
- Page title: `32px`, `700`, Manrope.
- Metric card value: `28px`, `700`, Manrope.
- Row amount: `14px`, `600`, Geist, tabular.
- Table amount: `13px`, `500`, Geist, tabular.
- Metadata: `12px`, `500`, Geist.

### 3.3 Font Implementation Notes

Use `next/font/google` only if build/deploy network behavior remains acceptable. Because local builds currently need Google Fonts fetches, consider one of these:

- Keep existing `next/font/google` and accept network-enabled production builds.
- Vendor self-hosted font files later if builds should be fully offline.

No immediate requirement to change the backend or data model.

---

## 4. Color and Theme Plan

### 4.1 Accent Personalization

Cashew emphasizes custom accent color. Ledgerify can add a simpler version first:

- Add a small theme preference UI under Settings.
- Offer 5 preset accent colors:
  - Ledger Green
  - Teal
  - Sky
  - Indigo
  - Rose
- Store preference client-side initially if avoiding schema changes.
- Apply accent through CSS variables.

No database change needed for the first pass.

### 4.2 Material-Inspired Surface Treatment

Refine cards and controls:

- Use slightly softer surface contrast.
- Add subtle tinted backgrounds based on semantic tone.
- Make active navigation pills feel more tactile.
- Use consistent `rounded-2xl` for controls and `rounded-3xl` for major cards.
- Avoid strong gradients except subtle app background treatment.

### 4.3 Semantic Color Discipline

Keep finance semantics:

- Income/growth: emerald.
- Expense/outflow: rose.
- Budget warning: amber.
- Goal progress: teal.
- Cash/accounts: sky.
- Protection/insurance: indigo.
- Investments: emerald/violet.
- Liabilities: rose/red-orange.

Accent color should style chrome and focus states, not override finance meaning.

---

## 5. Dashboard Follow-Up Plan

### 5.1 Modular Home Screen

Inspired by Cashew’s customizable home screen idea, make Ledgerify’s dashboard feel modular without adding a full widget system yet.

Phase 1:

- Reorder dashboard sections for mobile scanning.
- Add compact section headers with small actions.
- Add “show more / show less” behavior where lists become long.
- Make cards feel more widget-like through consistent dimensions.

Phase 2:

- Client-side local layout preference:
  - Show/hide planning module.
  - Show/hide obligations module.
  - Show/hide recent activity.
- Store in `localStorage`, not database.

### 5.2 Better Visual Rhythm

Dashboard should include:

- Hero snapshot.
- Month in motion.
- Attention queue.
- Recent activity.
- Planning progress.
- Wealth and obligations strip.

Each section should answer one question.

### 5.3 Cashew Visual Dashboard Rework

Replace the current conservative dashboard with a widget-style composition:

1. **Balance Snapshot Widget**
   - Large net worth number.
   - Small asset/liability split chips.
   - Tonal background using the active accent.
   - Quick links to net worth, accounts, investments, and loans.

2. **Daily Money Widget**
   - This month income, expenses, and net.
   - Use a compact visual bar/ring.
   - Show one plain-language status:
     - “Spending is below income this month.”
     - “Expenses are ahead this month.”

3. **Quick Add Strip**
   - Prominent actions:
     - Expense
     - Income
     - Transfer
   - Designed as pill/tile buttons with meaningful colors.

4. **Planning Widgets**
   - Budget health tile.
   - Goal progress tile.
   - Use progress rings/bars and status text.

5. **Protection and Debt Widgets**
   - Next EMI.
   - Next insurance renewal.
   - Show due dates as calm countdowns.

6. **Recent Activity**
   - Denser Cashew-like transaction rows.
   - Category/account context visible.
   - Destructive actions hidden behind overflow.

No schema changes required. Use currently available server data.

---

## 6. Transaction UX Follow-Up Plan

Cashew’s transaction management is a major reference point. Ledgerify should improve speed and scanning:

### 6.1 Add Transaction Toolbar

Add client-side controls first:

- Search by note.
- Filter chips:
  - All
  - Income
  - Expenses
  - Transfers
- Optional account/category dropdowns.

No backend changes required if filtering the already loaded transaction list.

### 6.2 Better Row Interactions

Improve transaction rows:

- Add overflow menu for destructive actions instead of visible delete.
- Add denser mobile rows.
- Make category/account metadata easier to scan.
- Add date grouping refinements.

### 6.3 Mobile Entry Polish

- Keep the quick action sheet.
- Add preselected type when entering from quick action:
  - Expense
  - Income
  - Transfer
- This can be done via query params and form defaults, no schema changes.

### 6.4 Cashew Visual Transaction Rework

The next transaction pass should go beyond filters:

- Add a top summary strip:
  - Income this month.
  - Expenses this month.
  - Net this month.
- Convert type chips into Material-style segmented controls.
- Add category/account filter chips with active color.
- Replace visible delete icon with an overflow menu or secondary inline action.
- Show transaction category/account metadata as the primary scanning line.
- Use compact rows on mobile with:
  - Category icon/tone.
  - Note/category.
  - Account/date.
  - Amount.
- Add a proper empty state with three action tiles:
  - Add expense.
  - Add income.
  - Import CSV.

### 6.5 Cashew-Specific Transaction Targets

Ledgerify should visibly adopt these transaction patterns:

- A reusable category/account glyph component with a colored tonal square or circle, not just text labels.
- Amount boxes above the list that include label, amount, and count, similar in purpose to Cashew's `TransactionsAmountBox`.
- A segmented income/expense/all control with a filled active indicator.
- Horizontal chips for account/category filtering with active tint and optional glyphs.
- Row layout order:
  - category glyph
  - title or category name
  - account/date/note context
  - tags or status chips
  - signed amount
- Mobile entry actions should be reachable from a prominent FAB or equivalent bottom action, with long-press or secondary sheet reserved for advanced add flows.

---

## 7. Reports and Charts Follow-Up Plan

Cashew highlights detailed graph visuals. Ledgerify’s reports should become more visually useful:

### 7.1 Chart Cards

Standardize every chart card:

- Header with report question.
- Main chart.
- Summary stat row.
- Empty state when no data.
- Consistent height at desktop/mobile breakpoints.

### 7.2 Chart Styling

Use:

- Softer grid lines.
- Semantic colors.
- Rounded bars.
- Better tooltip styling.
- Tabular currency in tooltips.
- Responsive height rules.

### 7.3 Insight Copy

Each report should include one short plain-language insight when data exists:

- “Expenses are higher than income over the last 3 months.”
- “Groceries is the largest category this month.”
- “Two budgets are near their limit.”

Implement with derived frontend calculations only.

---

## 8. Settings and Personalization Follow-Up

### 8.1 Appearance Settings

Add an Appearance section under Settings:

- Accent color presets.
- Light/dark/system mode shortcut if current theme provider supports it.
- Compact vs comfortable density.

Use local storage for:

- Accent color.
- Density.

No schema change needed.

### 8.2 Data Safety UI

Improve utility pages:

- Export copy should feel more like backup.
- Import should preview required columns.
- Add CSV template field list.
- Keep errors calm and readable.

### 8.3 Cashew-Inspired Import Polish

Use Cashew's import flow as a UX reference for Ledgerify's existing CSV import, without changing backend behavior:

- Present import as a short guided flow:
  - choose file
  - review required columns
  - map/confirm columns
  - preview import result
- Make required fields visually explicit.
- Show a compact progress indicator when parsing.
- Keep sample/template CSV access close to the error and empty states.

---

## 9. Font and UI Implementation Milestones

### Milestone 1: Font and Token Refinement

Goal: Upgrade typography without changing behavior.

Tasks:

- Add Manrope display font.
- Update CSS variables/classes for display text.
- Apply display font to page headers, metric values, and hero numbers.
- Audit all financial values for tabular numerals.
- Tune card radius, shadows, and surface contrast.

Validation:

- `bunx tsc --noEmit`
- `bun run lint`
- `bun run build`

### Milestone 2: Appearance Personalization

Goal: Add Cashew-style accent flexibility without schema changes.

Tasks:

- Create settings appearance page or section.
- Add accent preset swatches.
- Save selected accent in `localStorage`.
- Apply CSS variables at document root.
- Ensure finance semantic colors remain unchanged.

Validation:

- Manual check light/dark.
- Mobile and desktop screenshot check.

### Milestone 3: Transaction Polish

Goal: Make daily use faster.

Tasks:

- Add search and filter chips.
- Add query-param based transaction form defaults.
- Reduce visible destructive actions.
- Improve row density and grouping.

Validation:

- Client filtering works with current server-loaded data.
- No backend route changes.

### Milestone 4: Chart and Report Polish

Goal: Make reports feel closer to Cashew’s graph-first experience.

Tasks:

- Standardize chart containers.
- Improve chart colors, grid, tooltips, and responsive sizing.
- Add derived insight copy.
- Improve empty states.

Validation:

- Report pages build with empty and populated data.

### Milestone 5: Dashboard Modularity

Goal: Make home feel personal without building a full widget system.

Tasks:

- Add collapsible dashboard sections.
- Add local visibility preferences.
- Tighten mobile ordering.
- Add planning/wealth/obligation mini modules if data exists.

Validation:

- Preferences persist locally.
- Dashboard remains useful on first run.

### Milestone 6: Cashew Visual Rework v2

Goal: make the visible app feel meaningfully Cashew-inspired while preserving Ledgerify's Quiet Ledger identity.

Tasks:

- Replace plain dashboard metric grids with colorful financial widgets for balance, monthly movement, budgets, goals, obligations, and recent activity.
- Build shared visual primitives:
  - tonal finance widget
  - category/account glyph
  - amount summary box
  - segmented transaction selector
  - chip rail
  - progress/timeline bar
- Rework budgets and goals into expressive progress surfaces with clear remaining/spent/saved values.
- Rework accounts, loans, insurance, and investments into domain-colored summary widgets.
- Rework reports around chart-first cards and stronger empty states.
- Rework import/export surfaces into guided utility flows.

Validation:

- `/dashboard`, `/transactions`, `/budgets`, `/goals`, `/reports`, `/accounts`, `/loans`, `/insurance`, and `/settings` should all be visibly upgraded.
- Desktop and mobile screenshots should show Cashew-like widget composition, not only typography and settings changes.
- No schema changes.
- No backend/domain logic changes.
- Existing validation commands must pass:
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run build`

---

## 10. Concrete Design Decisions

### Font

Use:

- `Geist Sans` for UI.
- `Manrope` for display headings and major financial values.

Fallback:

- If Manrope fetch/build behavior is undesirable, use Geist only and create stronger display classes with weight/size changes.

### Shape

Use:

- `rounded-2xl` for buttons, inputs, chips, and small controls.
- `rounded-3xl` for major cards and panels.
- Avoid nested cards.

### Density

Default:

- Comfortable on setup, dashboard, reports.
- Compact on transaction rows and tables.

Later:

- Add density toggle.

### Mobile

Mobile should prioritize:

- Add transaction.
- Recent activity.
- Budget/goal progress.
- Alerts.

Reports and deep settings can remain secondary.

---

## 11. Out of Scope

Do not include in this plan:

- Database schema changes.
- Backend model changes.
- Multi-user sharing.
- Cloud sync.
- Biometric lock.
- Google login.
- Full widget customization stored in database.
- Cashew feature parity.

Also do not substitute preferences for visible product work. Accent settings, density settings, and dashboard visibility toggles are useful, but they do not satisfy the Cashew-inspired UI goal by themselves.

---

## 12. Success Criteria

The follow-up succeeds if:

- Ledgerify keeps the Quiet Ledger identity but feels warmer and more personal.
- Typography makes financial values easier to trust and scan.
- The app has a clearer Material-inspired tactile feel.
- Users can personalize accent/density without risking data complexity.
- Charts and reports become more visual and useful.
- Daily transaction review becomes faster.
- No schema or backend/domain behavior changes are required.

## 13. Next PR Scope: Cashew Visual Rework v2

The next implementation PR should be a UI-only rework on top of latest `main`.

Recommended segments, committed and pushed separately:

1. **Dashboard Widgets**
   - Add shared tonal widget primitives.
   - Rebuild the dashboard as a Cashew-style money home.
   - Keep all data derived from existing loaders/actions.

2. **Transactions**
   - Add category/account glyphs, amount summary boxes, segmented controls, chip rails, and denser rows.
   - Keep existing create/update/delete behavior unchanged.

3. **Budgets and Goals**
   - Rework list/detail cards into progress-first surfaces.
   - Add timeline/remaining/spent visual treatment using existing fields only.

4. **Accounts, Wealth, and Obligations**
   - Rework accounts, investments, loans, and insurance into domain-colored widgets.
   - Improve setup/empty states without new data requirements.

5. **Reports and Import**
   - Make reports chart-first.
   - Turn import/export into clearer guided flows.

Acceptance criteria:

- The UI should be visibly different from PR #3 at first glance.
- Cashew-inspired elements must appear in app surfaces, not only settings.
- No database schema migration.
- No backend/domain logic change.
- Validation must pass with Bun.
