# Minimalist Bento UI Revamp — Design Spec

## 1. Overview

Ledgerify's frontend is a SolidJS SPA (`frontend/src/`) styled with a warm terracotta theme (`#c25a3e`) on a near-white surface. This revamp replaces the visual language with a **dark-mode-only "Minimalist Bento"** aesthetic — high-contrast zinc surfaces, neon-lime accents, exaggerated 24px radii, mobile-first bento grids — and applies it across **all 14 current pages**. The stack is unchanged: SolidJS, Solid Router, TanStack Query, Tailwind v4, lucide-solid, Chart.js, Vite. The Stitch HTML mockups (Dashboard, Analytics, Recent Transactions) are the design source of truth; the desktop/web layout is responsive scale-up of the same primitives.

## 2. Goals

- **Glanceable finance, on phone-first.** A user opens the app and sees net worth, cash flow, and recent activity in under 2 seconds.
- **One design language across all 14 pages** (Dashboard, Activity, Accounts, Analytics, Budgets, Investments, Loans, Insurance, NetWorth, Reports, Import, Export, Settings, Login/Register).
- **One responsive codebase**, mobile-first. Same components, breakpoint-driven shell, no separate mobile/desktop code paths.
- **Dark mode only.** Drop the light theme; the bento aesthetic is designed for deep zinc.
- **Preserve existing data contracts** — no backend changes required for this revamp.

## 3. Non-Goals

- Adding new features (Plaid sync, multi-currency conversion, recurring transactions, etc.).
- Rewriting the backend in another language or framework.
- Adding SSR/SSG. The SPA stays a SPA.
- Building a separate mobile app. The web SPA is the only client.
- Restructuring the information architecture. The 14 pages and their routes stay the same; only the navigation chrome is reduced (4 primary tabs + More, instead of 12 sidebar items on mobile).

## 4. Confirmed Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | All 14 pages | Consistency across the app |
| Device strategy | One responsive design, mobile-first | Mobile is the first-class citizen; desktop scales up |
| Navigation | 4 primary tabs (Dashboard, Accounts, Analytics, Activity) + More menu for the remaining 8 pages | Fits 4-icon bottom nav on mobile, full sidebar on desktop |
| Icon library | Keep `lucide-solid` | No new dependency; bento aesthetic comes from layout/type/color, not icon style |
| Theme | Dark mode only | Bento aesthetic is designed for deep zinc surfaces |
| Stack | Unchanged (SolidJS, Tailwind v4, Solid Router, TanStack Query, lucide-solid, Chart.js) | User constraint |
| Build order | Foundation → mockup pages → remaining pages → polish | Cheap primitives, fast page work later |

## 5. Design Tokens

All tokens live in `frontend/src/styles/custom.css` inside Tailwind v4's `@theme` block. Existing terracotta tokens are replaced.

> **Note on the primary color:** the Stitch Dashboard mockup's tailwind config declares `"primary": "#c8f906"` (a slightly different lime), but the PRD and the other two mockups (`#CCFF00`) agree. Treat `#CCFF00` as authoritative; the dashboard mockup's `#c8f906` is a one-off drift.

```css
@import "tailwindcss";

@theme {
  /* Color */
  --color-bg: #09090B;            /* zinc-950, page background */
  --color-surface: #18181B;       /* zinc-900, bento blocks, cards, modals */
  --color-surface-hover: #27272A; /* zinc-800, interactive surface state */
  --color-border: #27272A;        /* zinc-800, default 1px border */
  --color-border-strong: #3F3F46; /* zinc-700, hover border */
  --color-text: #FAFAFA;          /* zinc-50, primary reading */
  --color-muted: #A1A1AA;         /* zinc-400, secondary text, labels */
  --color-primary: #CCFF00;       /* neon lime, action / positive / income */
  --color-primary-press: #B8E000; /* lime 600, pressed state */
  --color-accent: #FF4D4D;        /* electric coral, expenses / alerts */

  /* Typography */
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace;

  /* Radii */
  --radius-bento: 24px;
  --radius-pill: 9999px;
  --radius-button: 12px;
  --radius-input: 12px;

  /* Spacing */
  --spacing-screen: 16px;         /* outer page padding on mobile */
  --spacing-bento-gap: 12px;      /* gap between bento blocks */
  --spacing-bento-pad: 20px;      /* inner padding of bento blocks */
}
```

**Type usage:**
- Display (Space Grotesk 700): balances, screen titles, large numbers (`text-3xl`–`text-5xl`)
- Body (DM Sans 400/500): transaction names, list copy, form labels (`text-base`, `text-sm`)
- Small (DM Sans 500, uppercase tracking): labels, dates, table headers (`text-[13px]`)
- Mono (JetBrains Mono 500): table data columns where alignment matters, transaction amounts in tables
- Buttons: Space Grotesk 600, 15px, no uppercase (mockup shows regular case)

**Font loading:** add `@fontsource/space-grotesk` and `@fontsource/dm-sans` to `frontend/package.json` devDependencies, import once in `custom.css` (`@import "@fontsource/space-grotesk/400.css"; @import "@fontsource/space-grotesk/700.css"; @import "@fontsource/dm-sans/400.css"; @import "@fontsource/dm-sans/500.css";`). The @fontsource packages self-host — no Google Fonts CDN, no FOUT on production builds.

**Motion:**
- Default: 150ms ease-out for hover/active states
- Block press: `scale(0.96)` (mockup uses 0.95; tighter 0.96 reads better with 24px radii)
- Block entrance: `translateY(8px) → 0` + opacity, 400ms ease-out, 50ms stagger per block
- No spring physics; no drop shadows

## 6. Layout & Navigation Architecture

### Breakpoints

| Token | Range | Shell |
|---|---|---|
| `mobile` | `< 768px` | Bottom nav, edge-to-edge content, 2-col bento |
| `desktop` | `≥ 768px` | Sidebar, 3-col bento, max-width 1280px centered |

Implementation: a single `MainLayout` component reads `window.matchMedia("(min-width: 768px)")` (or a Solid signal synced to a resize observer) and renders either the mobile shell or desktop shell. Both shells share the same `<Outlet>` and the same page-content components.

### Mobile shell (`< 768px`)

```
┌─────────────────────────┐
│  PageHeader (sticky)    │  ← h-14, bg-bg, bottom border
├─────────────────────────┤
│                         │
│   <Outlet />            │  ← page content, 16px screen padding
│                         │
├─────────────────────────┤
│  BottomNav (sticky)     │  ← h-16 + safe-area, 4 tabs
└─────────────────────────┘
```

BottomNav (4 tabs):

| # | Tab | Route | Icon (lucide-solid) |
|---|---|---|---|
| 1 | Home | `/dashboard` | `LayoutDashboard` |
| 2 | Accounts | `/accounts` | `Wallet` |
| 3 | Analytics | `/analytics` | `PieChart` |
| 4 | Activity | `/activity` | `Receipt` |

Long-press on any tab or a 5th-icon overflow affordance (top-right of the BottomNav) opens the **More sheet** — a bottom drawer listing the 8 secondary routes (Budgets, Investments, Loans, Insurance, NetWorth, Reports, Import, Export, Settings) plus Logout. The More sheet uses the same bento surface color with 24px top corners.

### Desktop shell (`≥ 768px`)

```
┌──────────┬──────────────────────────────┐
│          │  PageHeader                  │
│ Sidebar  ├──────────────────────────────┤
│ (240px)  │                              │
│          │   <Outlet />                 │
│  Logo    │   max-w-[1280px] mx-auto     │
│  ──────  │                              │
│  Home    │                              │
│  Accts   │                              │
│  Anlytc  │                              │
│  Actvty  │                              │
│  ──────  │                              │
│  More ▾  │                              │
│  ──────  │                              │
│  Logout  │                              │
└──────────┴──────────────────────────────┘
```

Sidebar structure:
1. Logo block (32x32 lime square + "Ledgerify" wordmark, top, 16px vertical padding)
2. Primary group (4 items, same icons as BottomNav, `text-muted` default, `text-text` + `bg-surface` active, 8px vertical gap, 8px horizontal margin so active highlight is inset)
3. Divider (`1px` `--color-border`)
4. **More** expand toggle — collapsed by default. Expanded state shows the 8 secondary items as a nested list (12px indent, 14px font). The expanded state persists in `localStorage`.
5. Footer: Settings cog (icon-only, 9x9 button matching current MainLayout style) + Logout button

### PageHeader

Sticky top bar on every page, 56px height, `bg-bg` with `border-b border-border`. Contains:
- Mobile: optional back button (40x40 circle, `bg-surface`) on focused views (Activity detail, Account detail); otherwise just the page title
- Page title: `font-display text-xl` (mobile) / `text-2xl` (desktop), `text-text`
- Right side: optional action buttons (icon-only, 40x40 circles)

## 7. Component Primitives

All primitives live in `frontend/src/components/ui/`. Existing files (`button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`) are refactored to the new visual language; new files are added below. The terracotta `#c25a3e` references are removed everywhere.

### 7.1 `BentoBlock` (new, `bento-block.tsx`)

The signature primitive. A 24px-radius surface that fills a grid cell and can be tapped as a whole.

```tsx
type BentoBlockProps = JSX.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "button" | "a";
  variant?: "default" | "pressable" | "dashed";   // dashed for the Add-Account / Drop-CSV placeholders
  size?: "sm" | "md" | "lg";                        // min-height: sm=120, md=160, lg=220
  span?: 1 | 2 | 3;                                 // col-span for the bento grid
};
```

Styles:
- `bg-surface rounded-[24px] p-[20px] border border-border transition-all duration-150`
- `variant="pressable"`: `active:scale-[0.96] active:bg-surface-hover cursor-pointer`
- `variant="dashed"`: `bg-transparent border-dashed` (used for Add Account, Add Transaction, Drop CSV)
- Hover (non-mobile): `lg:hover:border-border-strong lg:hover:bg-surface-hover`

### 7.2 `PageHeader` (new, `page-header.tsx`)

```tsx
type PageHeaderProps = {
  title: string;
  back?: boolean;                    // shows back button on the left
  actions?: JSX.Element;             // right-side icon buttons
};
```

Sticky, 56px (mobile) / 64px (desktop), `bg-bg/95 backdrop-blur-sm border-b border-border`, z-30 (below BottomNav z-40, above content).

### 7.3 `Stat` (new, `stat.tsx`)

A value-and-label unit used in bento blocks. Two layouts:

- **Vertical** (default): label on top, value below. Used in dashboard's Income/Expense blocks.
- **Inline** (`inline`): label on left, value on right. Used in account rows.

```tsx
type StatProps = {
  label: string;
  value: string | number;
  trend?: { dir: "up" | "down" | "flat"; value: string };   // optional, renders below value with arrow
  tone?: "default" | "primary" | "accent";                  // value text color
  size?: "sm" | "md" | "lg" | "xl";                         // text-size scale
  layout?: "vertical" | "inline";
  format?: "currency" | "percent" | "number" | "raw";
};
```

Sizes: `sm` = `text-base`, `md` = `text-xl`, `lg` = `text-3xl`, `xl` = `text-5xl`. Display font for values, body font for labels.

### 7.4 `AccountRow` (new, `account-row.tsx`)

80px height, full-width row inside a BentoBlock. Layout: 40x40 icon-circle | bank name + sub-label | balance (right-aligned, mono optional).

```tsx
type AccountRowProps = {
  icon: Component;                   // lucide-solid icon
  name: string;
  sublabel?: string;                 // institution / account number •••• 1234
  balance: number;
  currency?: string;                 // default "INR"
  status?: "connected" | "syncing" | "error" | "disconnected";
  onClick?: () => void;
};
```

Status badge (right of balance, 8px dot + text):
- `connected`: `--color-muted` dot, "Connected" (default hidden — only show on hover/active)
- `syncing`: animated `--color-primary` dot, "Syncing…"
- `error`: `--color-accent` dot, "Sync failed"

### 7.5 `TransactionRow` (new, `transaction-row.tsx`)

72px height, full-width row. Layout: 40x40 icon-tile (rounded-lg, `bg-surface`) | merchant name + category | amount (right-aligned, mono).

```tsx
type TransactionRowProps = {
  icon: Component;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;                      // ISO, formatted by parent
  onClick?: () => void;
};
```

- `type="income"`: amount in `--color-primary` with `+` prefix
- `type="expense"`: amount in `--color-text` with `-` prefix (mockup uses off-white; coral is reserved for explicit alerts)
- `type="transfer"`: amount in `--color-muted` with no prefix

Border: `border-b border-border last:border-0`. Active state on touch: `active:bg-surface`.

### 7.6 `DonutChart` (new, `donut-chart.tsx`)

The signature Analytics component. 280px diameter SVG donut with 32px stroke, no labels in the donut itself, center value as overlay.

```tsx
type DonutSegment = { label: string; value: number; color?: string };
type DonutChartProps = {
  segments: DonutSegment[];
  centerLabel?: string;              // small uppercase text above center value
  centerValue?: string;              // main number in the middle
  centerTrend?: { dir: "up" | "down"; value: string; tone?: "primary" | "accent" };
  size?: number;                     // default 280
  thickness?: number;                // default 32
  highlightIndex?: number | null;    // dims non-highlighted segments to 30% opacity
  onSegmentHover?: (index: number | null) => void;
};
```

Default segment palette (in render order):
1. `--color-text`
2. `--color-muted`
3. `--color-border-strong`
4. (cycles back to `--color-text` for the 4th, 7th, etc.)

Auto-color: if a `color` is not provided, segments are colored by **descending value**: the largest segment always gets `--color-primary` (the "win" is always lime), the second-largest gets `--color-text`, the third gets `--color-muted`, the fourth gets `--color-border-strong`, and additional segments cycle through the muted tones. If a `color` is explicitly provided for a segment, that overrides the default assignment. Implementation: pure inline SVG with stroke-dasharray math (mockup shows the technique). No Chart.js for this — Chart.js is heavyweight for one chart and would not match the bento aesthetic.

### 7.7 `CategoryBar` (new, `category-bar.tsx`)

A 4px-tall progress bar with rounded ends, used in the Analytics category list and Budgets.

```tsx
type CategoryBarProps = {
  value: number;                     // 0-1 or 0-100 (auto-detected by range)
  color?: string;                    // default --color-text
  trackColor?: string;               // default --color-surface-hover
};
```

### 7.8 `SegmentedControl` (new, `segmented-control.tsx`)

Pill-shaped toggle used in Analytics (Income/Expense).

```tsx
type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";                // default md
};
```

Styles: container `bg-surface p-1 rounded-pill`; active button `bg-text text-bg rounded-pill`; inactive `text-muted`. Equal flex distribution.

### 7.9 `SearchBar` (new, `search-bar.tsx`)

Sticky search input for the Activity screen.

```tsx
type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};
```

Styles: `h-12 bg-surface rounded-input pl-12 pr-4 text-text placeholder:text-muted` with a 20x20 `Search` icon absolutely positioned at `left-4`. Focus ring: `focus-within:ring-1 focus-within:ring-primary`.

### 7.10 `EmptyState` (new, `empty-state.tsx`)

A centered empty state with optional icon, title, body, and CTA. Used everywhere data could be empty.

```tsx
type EmptyStateProps = {
  icon?: Component;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
};
```

### 7.11 `SkeletonRow` + `SkeletonBlock` (new, `skeleton.tsx`)

Loading placeholders that pulse on `--color-surface-hover`. No spinners anywhere in the app — only skeleton shapes that match the final layout's footprint.

### 7.12 `BottomNav`, `Sidebar`, `MoreSheet` (new, `nav.tsx`)

Navigation chrome. `BottomNav` and `Sidebar` both consume a shared `nav-items.ts` data file (single source of truth for route + label + icon + section). `MoreSheet` is a Solid `Portal`-rendered bottom drawer on mobile, an expandable accordion section in the Sidebar on desktop.

### 7.13 Refactored primitives

- `Button` — keep CVA-based variant API; replace `#c25a3e` default with `--color-primary` (`bg-primary text-bg hover:bg-primary-press`); add new `lime` / `outline-lime` variants; size `default` becomes `h-11 rounded-button px-5`
- `Input` / `Select` — replace terracotta focus ring with `focus:border-primary focus:ring-primary`; `bg-surface border-border text-text placeholder:text-muted`; `h-12` (was 9); `rounded-input` (12px)
- `Badge` — replace `gray-100/emerald-50/red-50/amber-50` with `bg-surface text-muted` (default) / `bg-primary/10 text-primary` (success) / `bg-accent/10 text-accent` (destructive) / `border border-border text-muted` (outline)
- `Card` / `CardHeader` / `CardTitle` / `CardContent` — deprecate. Pages migrate to `BentoBlock` + direct padding. These files are removed in Phase 4 once no page imports them. Keep them around as re-exports of `BentoBlock` shims during the migration so the lint stays clean.

## 8. Screen Specifications — Detailed (4 mockup screens)

These four are the visual reference for everything else. Built first in Phase 2.

### 8.1 Dashboard (`/dashboard`)

**Mobile layout** (2-col bento grid, 12px gap, 16px screen padding):

```
┌────────────────────────────────────┐
│  [Profile]            Dashboard   │  ← PageHeader
├────────────────────────────────────┤
│ ┌──────────────────────────────┐   │
│ │  TOTAL BALANCE               │   │  ← BentoBlock, span 2
│ │  $12,450.00                  │   │     size=lg
│ │  +2.4% this month ↑          │   │
│ └──────────────────────────────┘   │
│ ┌──────────┐ ┌──────────────────┐  │
│ │ Income ↓ │ │ Expenses ↑       │  │  ← span 1 each, size=md
│ │ $4,200   │ │ $1,850           │  │
│ └──────────┘ └──────────────────┘  │
│ ┌──────────────────────────────┐   │
│ │ ACTIVE CARD   >              │   │  ← span 2, size=sm
│ │ VISA •••• 4242      Credit   │   │
│ └──────────────────────────────┘   │
│ ┌──────────────────────────────┐   │
│ │ Recent            View all → │   │
│ │ ─ Whole Foods    -$84.20     │   │  ← span 2, TransactionRow x N
│ │ ─ Netflix        -$15.99     │   │
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

**Desktop layout** (3-col bento grid, 16px gap, 24px screen padding, max-w 1280px):

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│  TOTAL BALANCE       │  Income              │  Expenses            │
│  $12,450.00          │  ↓ $4,200            │  ↑ $1,850            │
│  +2.4%               │  trend               │  trend               │
├──────────────────────┴──────────────────────┴──────────────────────┤
│  ACTIVE CARD (full width row)                                       │
├──────────────────────────────────────┬──────────────────────────────┤
│  Recent Transactions (last 5)        │  Spending Chart (30d spark) │
│  ...                                  │  ┌────────────────────┐    │
│                                       │  │   /\    /\__/      │    │
│                                       │  └────────────────────┘    │
└──────────────────────────────────────┴──────────────────────────────┘
```

The desktop's "Spending Chart" is a lightweight inline SVG sparkline (no Chart.js, no library — just a path element). ~80 lines of code, drop into a new `Sparkline` primitive alongside `DonutChart`.

**Floating action (mobile only):** Quick Send pill button, fixed bottom-right at `bottom-20 right-4` (sits above BottomNav), `bg-primary text-bg rounded-pill px-5 py-3.5`. Hidden on desktop.

**Empty state:** Net Worth block renders `Add Account` CTA, Income/Expense blocks render `—`.

**Loading:** SkeletonBlock placeholders matching each block's exact dimensions (160, 140, 140, 120, dynamic). 600ms pulse.

### 8.2 Accounts (`/accounts`)

**Mobile:** PageHeader "Accounts" + "Add" icon button. Body is a vertical stack of bento cards (no grid), 12px gap. Each card is a `BentoBlock variant="pressable"` containing an `AccountRow` per sub-account (e.g., a Chase card contains Checking + Savings rows). Below the connected accounts: an "Add Account" `BentoBlock variant="dashed"` with a `+` icon and "Connect Institution" text.

**Desktop:** Same data, but in a 2-col grid of institution cards (each card spans 1 col). On `lg+` (1024+), 3-col grid.

**Detail route (`/accounts/:id`):** Slide-in route, back button in PageHeader. Shows the institution header + list of sub-accounts with current balance + last 10 transactions for that account (using the same `TransactionRow` primitive).

### 8.3 Analytics (`/analytics`)

**Mobile:** PageHeader "Analytics" + sticky SegmentedControl (Income | Expense). Body:
1. BentoBlock with the `DonutChart` (280px, centered) + center label/value/trend
2. BentoBlock with the category list — each row is icon-tile + name + amount + % + `CategoryBar` (4px)

**Desktop:** Donut on the left half (centered, max-w 360px), category list on the right half. SegmentedControl remains top, full width above both columns.

**Date scrubber:** New row above the SegmentedControl on desktop, hidden on mobile (the mobile donut chart picks up the time range from a separate "This Month" pill at the top of the PageHeader, tappable to open a bottom-sheet date picker). On desktop, a row of pill buttons `1M | 3M | YTD | ALL` follows the SegmentedControl, with the active button in `bg-primary text-bg`.

**Interactions:**
- Hover a category list row → that row's `CategoryBar` widens 2px and brightens; the donut's other segments dim to 30% opacity. (Implemented via `highlightIndex` state shared between the chart and the list.)
- Tap a category → bottom sheet with all transactions in that category for the selected period

**Empty state:** Dashed empty circle where the donut would be, body text "No data for this period."

### 8.4 Activity (`/activity`)

Replaces the current `/transactions` page. The route URL stays `/transactions` for backward compat; `/activity` is registered as an alias so the BottomNav label matches the URL.

**Mobile:** PageHeader with back button + "Transactions" title. Sticky `SearchBar` directly below the PageHeader, edge-to-edge. Body is a flat list grouped by date. Each date group starts with a sticky `DateHeader` (uppercase muted, 13px, `bg-bg/95 backdrop-blur-sm`, 32px height) that stacks under the SearchBar on scroll. Below each header, the transactions for that date are a column of `TransactionRow`s with `border-b border-border last:border-0`.

**No bottom nav on this screen** — focused view. A back button in the PageHeader returns to wherever the user came from (router state).

**Desktop:** Same content, two-pane layout. Left pane (60%): the date-grouped list as on mobile. Right pane (40%): the currently-selected transaction's detail (merchant, amount, category pill, account, note, "Edit category" inline dropdown). Click a row → right pane updates.

## 9. Screen Specifications — Brief (10 other pages)

Each of these uses the established primitives; no screen-specific component is added. Where a screen needs a small unique affordance, it's called out.

### 9.1 Budgets (`/budgets`)

PageHeader "Budgets" + "Add" icon. Vertical stack of `BentoBlock`s, one per budget. Each block shows budget name (display, 20px), `CategoryBar` (current spend / limit), and a small "X% used" label. Empty state: dashed block with "Create your first budget" CTA. Tapping a block opens a sheet to edit limit/period.

### 9.2 Investments (`/investments`)

PageHeader "Investments" + "Add" icon. Same shape as Accounts: vertical stack of `BentoBlock`s, one per holding. Each block: ticker (mono, 18px), name (body, 14px), quantity × current price = market value (right-aligned, mono). Sparkline per holding (reuse the `Sparkline` primitive from Dashboard, 240×40).

### 9.3 Loans (`/loans`)

PageHeader "Loans" + "Add" icon. Same as Accounts: one `BentoBlock` per loan. Each block: lender name, loan type pill, outstanding principal, EMI, next-due date. Tapping → loan detail with payment schedule.

### 9.4 Insurance (`/insurance`)

PageHeader "Insurance" + "Add" icon. Same shape. One `BentoBlock` per policy: provider, policy type, premium, renewal date, "Active" / "Expiring soon" badge.

### 9.5 NetWorth (`/networth`)

PageHeader "NetWorth" + "Add snapshot" icon. Top: large `Stat` block with the latest net worth (xl size, primary tone if positive, accent if negative). Below: full-width `Sparkline` (640×120 on desktop, full-width on mobile) showing the historical series. Below: a "Top movers" BentoBlock listing the 3 biggest asset/liability changes this month.

### 9.6 Reports (`/reports`)

PageHeader "Reports". The current Reports page is a hub for `/reports/cashflow`, `/reports/category-breakdown`, `/reports/budget-vs-actual`, `/reports/networth`. The new design shows this as a 2-col grid (mobile: 1 col) of `BentoBlock variant="pressable"` cards, each with an icon, title, and one-line description. **However**, the donut chart and category breakdown from the Stitch mockup *migrate into this page* — `/reports/category-breakdown` becomes the full Analytics-style page with the DonutChart. The `/analytics` tab is the same data, just the at-a-glance donut. The full category report is one click deeper.

### 9.7 Import (`/import`)

PageHeader "Import". Single full-width `BentoBlock variant="dashed"` with a `FileUp` icon (lucide), "Drop a CSV here or click to browse" body, and a primary "Choose File" button. Below: a collapsible "Mapping" `BentoBlock` that appears after a file is selected, showing column-to-field mapping. Bottom: an "Import" primary button.

### 9.8 Export (`/export`)

PageHeader "Export". Single `BentoBlock` with a date range picker (segmented control: 1M / 3M / YTD / ALL / Custom), a multi-select for which fields to include, and a primary "Download CSV" button. Below: a "Recent exports" list of the last 5 exports with download links.

### 9.9 Settings (`/settings`)

PageHeader "Settings". Vertical stack of `BentoBlock`s, grouped by section: Account (email, change password, logout), Preferences (currency — default INR, date format), Data (export all, import, delete account — accent color for destructive). Each row inside a block is 56px high with a chevron on the right.

### 9.10 Login / Register (`/login`, `/register`)

Centered card, max-w 360px, on the dark `bg-bg` (no light surface). Single `BentoBlock` containing:
- Logo + product name at top (centered)
- Form fields (stacked, `Input` primitive)
- Primary submit button (full-width, lime)
- Footer link ("Don't have an account? Sign up" / "Already have an account? Sign in")

No bento grid on auth — auth is intentionally simpler than the app. The bento language is preserved through the colors, type, and the rounded card.

## 10. Implementation Phases

Each phase ends with a green `go test ./... && go build -o /tmp/ledgerify-server ./cmd/server` per AGENTS.md plus a manual smoke test of the affected pages on a 375px viewport and a 1280px viewport.

### Phase 1 — Foundation (3-4 days)

1. Update `frontend/src/styles/custom.css`: replace `@theme` block with the bento tokens from §5. Add fontsource imports. Remove `index.css` (it's dead — `index.tsx` imports `custom.css`, not `index.css`).
2. Add `@fontsource/space-grotesk`, `@fontsource/dm-sans`, `@fontsource/jetbrains-mono` to `frontend/package.json`. Run `bun install`.
3. Refactor `button.tsx`, `input.tsx`, `select.tsx`, `badge.tsx` to the new color/type tokens (§7.13). Card primitives stay (for now) as re-exports of bento shims.
4. Build new primitives in `frontend/src/components/ui/`: `bento-block.tsx`, `page-header.tsx`, `stat.tsx`, `account-row.tsx`, `transaction-row.tsx`, `donut-chart.tsx`, `category-bar.tsx`, `segmented-control.tsx`, `search-bar.tsx`, `empty-state.tsx`, `skeleton.tsx`, `sparkline.tsx`.
5. Build `nav.tsx` (`BottomNav` + `Sidebar` + `MoreSheet`) and `nav-items.ts` (single source of truth for primary + secondary routes, including a `section: "primary" | "secondary"` field per item).
6. Rewrite `frontend/src/layouts/MainLayout.tsx` to use the breakpoint-driven shell. Remove the icon-only 60px sidebar.
7. Add `frontend/src/lib/format.ts` with `formatCurrency(n, currency)`, `formatDate(iso)`, `formatDateGroup(iso)` helpers. The app currently inlines `Intl.NumberFormat` in every page — consolidate.
8. Smoke test: app loads, BottomNav shows 4 tabs on mobile, Sidebar shows 4 primary + More on desktop.

### Phase 2 — Mockup pages (4-5 days)

For each of Dashboard, Accounts, Analytics, Activity: rebuild to match the Stitch mockups using the Phase 1 primitives. Activity replaces the current Transactions page (or aliases to it).

Order: Dashboard → Activity → Accounts → Analytics. Dashboard establishes the bento grid and the Stat usage. Activity establishes the search bar, sticky date headers, and TransactionRow. Accounts is mostly `BentoBlock` + `AccountRow`. Analytics is the first use of `DonutChart` and `SegmentedControl`.

### Phase 3 — Remaining pages (3-4 days)

Apply §9 to Budgets, Investments, Loans, Insurance, NetWorth, Reports, Import, Export, Settings, Login, Register. Order by data density (NetWorth and Reports have charts; Login/Register are quick). Each page should be a single session's work — primitives handle 80% of the layout.

### Phase 4 — Polish + docs (1-2 days)

1. Micro-interactions: block entrance animation, hover/press states, skeleton→content crossfade.
2. Accessibility: focus rings on every interactive element (the mockups use `ring-1 ring-primary`); `aria-label` on icon-only buttons; color contrast checked (lime on zinc-900 = 14:1, well above WCAG AAA).
3. Remove the dead `index.css` file. Remove the unused `card.tsx` exports if no page imports them.
4. Update `frontend/README.md` with the new design language + link to this spec.
5. **Fix `AGENTS.md`:** it incorrectly says the stack is "Go + HTMX + Pico.css" with templates in `web/templates/`. The actual stack (per `frontend/package.json`, `cmd/server/main.go:252`, and `embedassets.go`) is SolidJS + Tailwind v4, embedded via `//go:embed all:frontend/dist`. The `web/templates/` directory does not exist. Update AGENTS.md to reflect reality.
6. Final smoke test on iPhone SE (375px), iPhone 15 Pro (393px), iPad Mini (768px), 1280px desktop, 1920px desktop.

## 11. Technical Decisions

### Chart library

`DonutChart` is hand-rolled inline SVG (mockup technique). `Sparkline` is hand-rolled inline SVG. `Chart.js` stays for the existing Reports sub-pages (`/reports/cashflow`, `/reports/budget-vs-actual`) where it currently renders real charts with axes, tooltips, and date adapters. Don't port those — they're already working. The bento aesthetic is enforced through the **chrome** around the chart (the bento block container), not the chart itself. Charts in bento blocks get `bg-transparent` (no inner border), with the surrounding block providing the surface.

### Currency

Current app uses `en-IN` / INR throughout (`frontend/src/pages/Dashboard.tsx:16`). The mockup uses `$` (USD). The new `formatCurrency` helper respects a user-configurable default in Settings (per §9.9) and falls back to `en-IN` / INR. The mockup's `$12,450.00` is a styling reference, not a hardcoded value.

### Routing changes

- `/transactions` route stays; the page now renders the new Activity design.
- New route `/analytics` registered. Current `/reports` becomes a hub; the four sub-routes (`/reports/cashflow`, etc.) are reachable from there and from the More menu.
- New route `/activity` registered as an alias of `/transactions` to match the BottomNav label.

### State management

The current app uses Solid signals + `createResource` per page. TanStack Query is in `package.json` but the code doesn't use it consistently. **This revamp does not migrate to TanStack Query** — out of scope, risky to bundle with a UI revamp. If TanStack Query is desired, that's a separate spec.

### Backward compatibility

The backend (`cmd/server/main.go`, `/api/v1/*`) is untouched. The data contracts are unchanged. The frontend is the only thing being modified.

## 12. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Tailwind v4 `@theme` block is a 2024 syntax; some users may not know it | Reference the existing usage in `frontend/src/styles/custom.css:4`; document the v3→v4 differences inline |
| Hand-rolling the donut math (stroke-dasharray) is fiddly | Write 3 component tests covering: equal segments, single segment, 6-segment case |
| 12px bento gap on small screens leaves very little breathing room | Test on 320px viewport (smallest supported). If cramped, drop to 8px gap on `< 375px` via container query |
| Lime `#CCFF00` on text-heavy surfaces may vibrate | Use lime only for: primary CTAs, active state of the donut, +income amounts. Body text stays zinc-50 |
| The "View all" link in Dashboard's Recent block → where does it go? Mockup shows it on Dashboard; the full list is on Activity. | It links to `/activity` (current `/transactions` route) |
| Sparkline needs historical data the backend may not have for new users | Empty state: dashed `BentoBlock` with "Add data to see trends" CTA |
| Card primitives are used by ~6 pages; removing them in Phase 4 might miss a usage | Phase 1 keeps the shim exports; Phase 4 grep-verifies `card` imports are 0 before deleting |

## 13. Files Touched (Reference)

New files:
- `frontend/src/components/ui/bento-block.tsx`
- `frontend/src/components/ui/page-header.tsx`
- `frontend/src/components/ui/stat.tsx`
- `frontend/src/components/ui/account-row.tsx`
- `frontend/src/components/ui/transaction-row.tsx`
- `frontend/src/components/ui/donut-chart.tsx`
- `frontend/src/components/ui/category-bar.tsx`
- `frontend/src/components/ui/segmented-control.tsx`
- `frontend/src/components/ui/search-bar.tsx`
- `frontend/src/components/ui/empty-state.tsx`
- `frontend/src/components/ui/skeleton.tsx`
- `frontend/src/components/ui/sparkline.tsx`
- `frontend/src/components/ui/nav.tsx`
- `frontend/src/components/ui/nav-items.ts`
- `frontend/src/lib/format.ts`

Refactored:
- `frontend/src/styles/custom.css` (replace `@theme` block, add fontsource imports)
- `frontend/src/layouts/MainLayout.tsx` (breakpoint-driven shell)
- `frontend/src/components/ui/button.tsx` (terracotta → lime)
- `frontend/src/components/ui/input.tsx` (terracotta → lime, surface bg)
- `frontend/src/components/ui/select.tsx` (terracotta → lime, surface bg)
- `frontend/src/components/ui/badge.tsx` (gray/emerald/red/amber → surface/primary/accent)
- `frontend/src/components/ui/card.tsx` (kept as shims during migration; deleted Phase 4)
- `frontend/src/pages/Dashboard.tsx` (Phase 2)
- `frontend/src/pages/Accounts.tsx` (Phase 2)
- `frontend/src/pages/Transactions.tsx` (Phase 2 — becomes Activity)
- `frontend/src/pages/Reports.tsx` (Phase 3 — keeps hub role, links to Analytics)
- `frontend/src/pages/Analytics.tsx` (new, Phase 2)
- `frontend/src/pages/Budgets.tsx` (Phase 3)
- `frontend/src/pages/Investments.tsx` (Phase 3)
- `frontend/src/pages/Loans.tsx` (Phase 3)
- `frontend/src/pages/Insurance.tsx` (Phase 3)
- `frontend/src/pages/NetWorth.tsx` (Phase 3)
- `frontend/src/pages/Import.tsx` (Phase 3)
- `frontend/src/pages/Export.tsx` (Phase 3)
- `frontend/src/pages/Settings.tsx` (Phase 3)
- `frontend/src/pages/Login.tsx`, `Register.tsx` (Phase 3)
- `frontend/src/App.tsx` (add `/analytics` and `/activity` routes; update nav)
- `frontend/package.json` (add fontsource packages)
- `frontend/README.md` (document new design)
- `AGENTS.md` (correct the stack description — see §10.5)
