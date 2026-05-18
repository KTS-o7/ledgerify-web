# Design Spec: Ledgerify UI Refinement — Terracotta

**Date:** 2026-05-18
**Status:** Approved for implementation planning

## Overview

Stripped the previous Graphite + Lime design. Replaced with a warm, minimal aesthetic inspired by Apple and Notion — terracotta accent, warm neutrals, compact sidebar, borders over shadows, typography-driven hierarchy.

## Constraints

- Same stack: Go + HTMX + Pico.css (v2) + Alpine (minimal)
- No new frontend frameworks, icon libraries, external fonts, image assets, or build steps
- Chart.js scoped to report pages only; dashboard uses inline SVG/CSS charts (zero dependencies)
- Default theme: light; dark mode toggle via `data-theme` attribute
- Verification: `go test ./...`, `go build`, `git diff --check`

## Design Principles

| Principle | Description |
|---|---|
| Typography-driven | Size/weight/color create hierarchy, not boxes |
| Minimal chrome | No card containers wrapping everything |
| Borders over shadows | 1px borders, no drop shadows |
| Terracotta as precise accent | Used sparingly — active nav, primary buttons, links |
| Warm neutrals | Cream undertones, no cool grays |
| Apple/Notion precision | Thin borders, generous whitespace, intentional spacing |

## Color System

### Light Mode

| Token | Hex | Usage |
|---|---|---|
| Canvas | `#f8f7f5` | Page background |
| Surface | `#ffffff` | Tables, forms, charts |
| Surface muted | `#f0eeec` | Badges, subtle fills |
| Text | `#1a1816` | Body text |
| Text muted | `#7a7570` | Labels, secondary |
| Line | `#e8e5e2` | Borders (strong) |
| Line faint | `#f0eeec` | Row separators (subtle) |
| Accent | `#c25a3e` | Primary buttons, active nav, links |
| Accent hover | `#a34730` | Button hover |
| Accent muted | `rgba(194,90,62,0.08)` | Hover fills, chart area |
| Income | `#16835a` | Green amounts |
| Expense | `#bd3e3e` | Red amounts |
| Warning | `#b7791f` | Amber alerts |

### Dark Mode

| Token | Hex | Usage |
|---|---|---|
| Canvas | `#14100e` | Page background |
| Surface | `#0f0c0a` | Tables, forms, charts |
| Surface muted | `#1f1a17` | Badges, subtle fills |
| Text | `#ece3dc` | Body text (warm white) |
| Text muted | `#7a6b63` / `#9a8b82` | Labels, secondary |
| Line | `#1f1a17` | Borders |
| Accent | `#d07a5f` | Buttons, active nav, links (lighter for dark bg) |
| Accent hover | `#e08a6f` | Button hover |
| Accent muted | `rgba(208,122,95,0.12)` | Hover fills, chart area |

### Semantic colors (unchanged across themes)
- Positive: `#16835a`
- Negative: `#bd3e3e`
- Warning: `#b7791f`
- Info: `#2563eb`

## Layout

### Desktop (>768px)
```
┌────┬─────────────────────────────────┐
│    │  Page title            [theme]  │
│ 52 │                                 │
│ px │  Net worth (hero number)        │
│    │                                 │
│ s  │  Income | Expenses | Cash Flow  │
│ i  │  (thin dividers, no cards)      │
│ d  │                                 │
│ e  │  ┌─Transactions──┐ ┌─Budgets──┐ │
│ b  │  │ dot + row     │ │ progress │ │
│ a  │  │ dot + row     │ │ progress │ │
│ r  │  └───────────────┘ └──────────┘ │
│    │  ┌─Net Worth Chart─────────────┐│
│    │  │ SVG line chart              ││
│    │  └─────────────────────────────┘│
└────┴─────────────────────────────────┘
```

- **Sidebar:** 52px wide, warm dark (`#1a1816` light, `#0f0c0a` dark), inline SVG icons, terracotta active state with left indicator bar
- **Content area:** Max ~1080px, padded, warm cream canvas
- **Borders:** 1px `#e8e5e2` (up from 0.5px — real CSS can't do sub-pixel reliably)

### Mobile (<768px)
- Sidebar collapses to bottom tab bar (5 primary nav items, icon + 9px label)
- Content fills full width
- KPI row stacks vertically at <620px
- Tables become stacked card rows

### Breakpoints
| Breakpoint | Behavior |
|---|---|
| >768px | Full sidebar, multi-column layout |
| 620-768px | Bottom tab nav, 2-col grid becomes 1-col |
| <620px | Single column, stacked KPIs, stacked table rows |

## Typography

System font stack (unchanged — performant):
```
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", Roboto, sans-serif
```

| Element | Size | Weight | Notes |
|---|---|---|---|
| Hero number | 38-40px | 550 | Tight letter-spacing |
| Page title | 22-24px | 500 | Apple medium weight |
| KPI value | 16-17px | 500 | Not too large |
| Body text | 13-14px | 400 | Table rows, descriptions |
| Section title | 12-13px | 500 | Compact headers |
| Label | 11px | 500 | Uppercase, 0.5px letter-spacing |
| Badge | 11px | 400 | Tinted background |
| Table header | 11px | 500 | Uppercase, 0.3px letter-spacing |

## Navigation

### Compact Sidebar (52px)
- Inline SVG icons (hand-coded, ~12-15 paths, ~150-200 bytes each)
- Active state: terracotta icon + 3px left indicator bar
- Default state: muted warm gray (`#7a7570` light, `#5a524d` dark)
- Brand mark: "L" letter logo in terracotta fill
- Bottom: settings gear icon in bordered circle
- Tooltip labels on hover (desktop only)

### Icons needed
- Dashboard (grid)
- Transactions (list lines)
- Accounts (building/columns)
- Budgets (chart bars)
- Reports (chart line)
- Settings (gear)
- Theme toggle (sun/moon)

## Components

### Buttons
| Variant | Style |
|---|---|
| Primary | Terracotta fill, white text, 1px inner top highlight (`rgba(255,255,255,0.15)`), 7px radius |
| Secondary | 1px `#d4d0cb` border, white fill, `#1a1816` text, 7px radius |
| Ghost | Terracotta text only |
| Small/icon | 1px border, 6px radius, icon + optional text |
| Active filter | Terracotta fill, white text |
| Inactive filter | White fill, 1px border, `#1a1816` text |

### Forms
- Labels: 11px, 500 weight, `#7a7570`, 0.3px letter-spacing
- Input wrapper: 1px `#d4d0cb`, 8px radius, 9px padding, white fill, subtle inset shadow
- Focus state: 2px terracotta ring
- Inline decorations: `$` prefix, `USD` badge, chevron for selects, calendar icon for dates
- Placeholder: `#7a7570`

### Badges / Category Pills
- Background: `#f0eeec` (light), `#1f1a17` (dark)
- 5px radius, 2-3px padding top/bottom, 7-10px horizontal
- Colored dot (5px, 50% radius) before text — each category gets its own color
- Active/emphasis: terracotta fill, white text, no dot

### Progress Bars
- 3px height, `#f0eeec` track (light), `#1f1a17` track (dark)
- Terracotta fill, 2px radius
- Label above: category name left, amount/percentage right

### Tables
- Bordered container (1px `#e8e5e2`, 8px radius)
- Uppercase header row, 11px, `#7a7570`, border-bottom separator
- Data rows: 13px, `#1a1816` text, `#f0eeec` row separator
- Hover: `rgba(194,90,62,0.03)` tint on row
- Action menu: `⋯` icon in 28px bordered circle on last column

### Filter Chips (segmented control)
- Active: terracotta fill, white text, 6px radius
- Inactive: white fill, 1px `#d4d0cb` border, `#1a1816` text
- 5px padding vertical, 12px horizontal, 12px text

### Empty State
- Dashed border container (1px `#d4d0cb`, 8px radius)
- Centered muted icon (28px), description text, terracotta CTA button

### Toggle / Theme Switch
- In header: pill-style with "Light" / "Dark" labels, active state highlighted
- Border: 1px `#d4d0cb`, 6px radius, 4px padding

## Charts

### Monthly Spending Heatmap
- Pure CSS grid of 12px × 12px cells, 2px radius, 2px gap
- 7 rows (days of week) × ~52 columns (weeks)
- Intensity levels via CSS classes:
  - `.level-0`: `#f0eeec` (no spending)
  - `.level-1`: `#ffe4dd` (low)
  - `.level-2`: `rgba(194,90,62,0.2)` (medium)
  - `.level-3`: `rgba(194,90,62,0.4)` (high)
  - `.level-4`: `#c25a3e` (very high)
  - `.level-5`: `#8a3a2a` (extreme)
- Legend bar at bottom: Less → More with sample cells
- Zero JavaScript. Server-renders cells based on daily totals.

### Net Worth Line Chart (Dashboard)
- Inline SVG `<path>` with `fill="none"` stroke + area fill
- `<polyline>` or `<path>` rendered server-side from data points
- Grid lines: 4 horizontal, light line color
- Y-axis labels (3-4), X-axis labels (months)
- Latest data point: 3px terracotta dot + 5px halo
- Period selector (1M / 3M / 1Y / All) — filter chips above chart

### Category Donut (Dashboard overview)
- Inline SVG `<circle>` segments with `stroke-dasharray`
- Segments: housing (terracotta), food (blue), transport (green), utilities (amber)
- Legend to the right: colored square + name + amount

### Interactive Charts (Report Pages)
- Chart.js loaded via `<script src>` inside `{{if .Data}}` block — never on non-report pages
- Bar charts (income vs expense), line charts (trends), doughnut (category breakdown)
- Same color palette mapped to Chart.js config

## Page Layouts

### Dashboard
- Page title + theme toggle in header
- Net worth hero (38-40px number + trend)
- KPI strip: Income | Expenses | Cash Flow | Savings Rate (thin vertical dividers, no cards)
- Two-column grid: Recent Transactions (left, 1.4fr) | Budgets (right, 1fr)
- Below: Net Worth Trend SVG chart

### Transactions
- Page title + "Add" primary button
- Filter chip row: All | Income | Expenses | This Month + search input with icon
- Full table with action menu (⋯) on each row
- Pagination below table

### Budgets
- Page title + "Set Budget" button
- 2-column grid of budget cards
- Each card: category name, spent amount, total budget, progress bar
- Color-coded progress: green if <60%, amber if 60-85%, terracotta if >85%

### Settings
- Page title
- 3-column tile grid
- Each tile: 1px border, 8px radius, title + description
- No icons on tiles (keeps it clean)

### Accounts / Investments / Loans / Insurance
- Consistent list page pattern: page title + CTA, filter/search bar, table with rows
- Same table component, same badge style

### Reports
- Index page: tile grid matching settings pattern
- Report pages: Chart.js charts inside bordered container, period filter chips

## Dark Mode Implementation

- Toggle via `data-theme="dark"` on `<html>`, persisted to localStorage
- All colors use CSS custom properties, swapped via `[data-theme="dark"]` selector
- Pico.css default theme variables overridden for both light and dark
- No `prefers-color-scheme` media query (user controls toggle)
- Same layout and component structure; only colors invert

## Responsive Behavior

| Element | >768px | 620-768px | <620px |
|---|---|---|---|
| Sidebar | 52px rail | Bottom tab bar | Bottom tab bar |
| KPI row | Horizontal, dividers | 2×2 grid | Stacked vertical |
| Dashboard grid | 2 columns | 1 column | 1 column |
| Budgets grid | 2 columns | 2 columns | 1 column |
| Settings grid | 3 columns | 2 columns | 1 column |
| Tables | Full table | Full table (scroll) | Stacked cards |
| Charts | Full width | Full width | Hidden / stacked |

## Sidebar Icons (Inline SVG)

The following icons are hand-coded as inline SVG `<svg>` elements in `base.html`, served as part of the template (no external HTTP requests):

| Nav item | Icon shape | SVG path description |
|---|---|---|
| Dashboard | 2×2 grid of small squares | 4 `<rect>` elements |
| Transactions | Horizontal lines | 3 `<line>` or `<path>` lines |
| Accounts | Bank/building | `<rect>` + `<path>` columns |
| Budgets | Bar chart | 3 `<rect>` bars at different heights |
| Reports | Chart line | `<path>` with up-trend |
| Settings | Gear/cog | `<circle>` + 6 spokes `<path>`s (sun icon pattern) |
| Theme | Sun/moon | Sun rays or moon crescent |

Each icon is ~150-200 bytes, rendered inline, no HTTP overhead.

## Implementation Notes

- **CSS organization:** Custom CSS continues in `web/static/css/custom.css`. Organize by: custom properties (colors), layout, navigation, components, charts, responsive, dark mode.
- **Pico.css overrides:** Reduce `!important` usage by targeting `[data-theme]` selectors with higher specificity.
- **SVG charts:** Data is passed from Go handlers as JSON or pre-computed path strings. Templates render SVG directly — no JS charting on dashboard.
- **Heatmap:** Handler computes daily totals, passes to template. Template iterates days and assigns CSS level classes.
- **Chart.js remains** on report pages only, loaded conditionally inside `{{if .Data}}` blocks.
- **No icon library** — all icons are inline SVG snippets in the nav partial.
