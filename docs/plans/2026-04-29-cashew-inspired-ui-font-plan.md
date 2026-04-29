# Cashew-Inspired UI and Typography Follow-Up Plan

**Date:** 2026-04-29  
**Branch:** `feedback/quiet-ledger-followups`  
**Reference:** [`jameskokoska/Cashew`](https://github.com/jameskokoska/Cashew), [Cashew website](https://cashewapp.web.app/)  
**Scope:** UI polish, typography, density, personalization, chart presentation, and mobile ergonomics for Ledgerify after the Quiet Ledger refresh. No schema or backend/domain logic changes.

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

