# Graphite Lime UI Refresh Design

**Date:** 2026-05-17
**Target branch:** `feat/graphite-lime-ui-refresh`
**Status:** Approved for implementation planning

## Context

Ledgerify is now a lightweight Go + HTMX personal finance app. The active UI is rendered from `web/templates/` and styled by `web/static/css/custom.css`, with Pico.css, HTMX, Alpine.js, and Chart.js loaded from `web/templates/base.html`. Older Next.js files remain in the repository, but the README and recent history identify the Go-rendered app as the production surface.

The current UI is intentionally light, but visually plain: a heavy full sidebar, emoji navigation, basic cards, sparse table hierarchy, inconsistent page treatments, and visible defaults from Pico. The refresh must make the app feel premium without changing the core stack or adding a heavy frontend layer.

The chosen visual direction is **Graphite + Lime Console**: a compact dark graphite shell, a light work surface, dense finance-oriented components, and one energetic lime accent used sparingly.

## Goals

- Make the visible app feel polished across all shipped Go-rendered pages.
- Preserve the lightweight philosophy: no new frontend framework, no build step, no heavy icon package, no large image assets.
- Keep most of the work in shared CSS and small template adjustments.
- Make dashboard, transactions, tables, forms, reports, auth, settings, import, and export feel part of one system.
- Improve mobile navigation and density without making the app decorative or marketing-like.

## Non-Goals

- No migration from Pico.css to another library in this pass.
- No replacement of HTMX, Alpine, or Chart.js.
- No new backend product features.
- No schema changes.
- No dashboard data model expansion beyond what existing handlers already provide.
- No SVG illustration system or external icon dependency.

## Architecture

The implementation stays inside the Go-rendered UI layer:

- `web/templates/base.html` owns the shell structure, page header, theme toggle, and global script includes.
- `web/templates/partials/nav.html` owns app navigation and mobile menu behavior.
- `web/templates/pages/*.html` own visible page content and should use shared classes consistently.
- `web/static/css/custom.css` owns the visual system, tokens, layout, navigation, buttons, cards, forms, tables, report tiles, auth pages, responsive behavior, and chart shells.

No new client-side state framework is introduced. Alpine remains only for the existing theme and mobile navigation behavior. HTMX remains enabled globally. Chart.js remains available for existing reports.

## Visual System

### Color

Use a restrained graphite/lime palette:

- Graphite shell: near-black green/gray for sidebar and dark emphasis cards.
- Lime accent: active nav, primary CTA, focus rings, selected states, key progress highlights.
- Light canvas: off-white/green-tinted page background for readability.
- White surfaces: cards, tables, forms, and chart containers.
- Semantic money colors: green for income/positive, red for expenses/negative, amber for warning, blue only for neutral information.

The UI should not become a one-note lime theme. Lime is an accent, not the main background color.

### Typography

Use system fonts to avoid new asset weight. Improve hierarchy through weight, size, spacing, and case:

- Page titles are compact and strong.
- Metric values are large only where they need to anchor a dashboard or summary card.
- Tables and forms use smaller dense text.
- Labels use muted color and modest uppercase treatment only where it aids scanability.

### Shape and Depth

- Cards and controls use 8px radius.
- Prefer borders and tonal contrast over shadows.
- Avoid nested cards.
- Avoid decorative gradients, blobs, and image backgrounds.
- Use stable dimensions for nav buttons, KPI cards, chips, form controls, and tables to prevent layout shift.

### Icons and Markers

Remove the current emoji-heavy feel where possible. Use lightweight alternatives:

- Brand mark: a simple `L` tile.
- Navigation: short text labels with compact CSS markers or single-character glyphs.
- Transaction/category rows: initials or colored chips instead of emoji.
- Keep any remaining symbols simple, monochrome, and functional.

## Page Scope

### Global Shell

Replace the current heavy sidebar with a compact graphite rail on desktop. The rail contains the brand tile, grouped navigation, active lime state, and logout/settings at the bottom. Main content sits on a light canvas with a compact page header.

On mobile, use a top graphite bar with a menu toggle. The menu opens as a dense vertical list below the top bar. It should not consume an excessive first viewport when closed.

### Dashboard

Dashboard receives the strongest polish:

- A compact KPI strip for income, spend, net, and balance.
- A dark net/balance emphasis card using graphite.
- Budget/progress cards with lime progress and semantic warning states.
- Recent transactions rendered as dense finance rows.
- Net worth chart shell updated to the shared chart surface.

Use existing dashboard data only.

### Transactions

Transactions become the reference dense data page:

- Filter bar becomes a bordered toolbar with compact inputs.
- Add transaction form becomes a polished disclosure panel.
- Table rows gain clearer date/title/category/account/amount hierarchy.
- Amounts remain strongly signed and colored.
- Delete action becomes visually quieter while still available.
- Empty state uses the shared empty surface.

### Accounts, Budgets, Investments, Loans, Insurance

These pages move from plain tables toward consistent operational list surfaces:

- Add forms use the same disclosure panel and grid form styling.
- Tables use shared dense data table styling.
- Type/category/status badges use shared chip classes.
- Empty states are consistent.
- Existing data stays unchanged.

### Reports

Reports index becomes a clean tile grid with compact descriptions and visible affordance. Chart pages use a consistent chart container with muted explanatory copy and stable canvas sizing.

### Settings, Import, Export, Auth

Settings and export cards use the same tile language as reports. Import uses a polished upload panel. Login/register use the graphite/lime visual language without becoming a marketing landing page.

## Lightweight Budget

The refresh should avoid meaningful runtime weight increases:

- No new package dependency.
- No new external font.
- No new icon library.
- No image assets.
- No additional JS file unless a verified bug requires it.
- CSS can grow, but should remain one readable hand-authored file with grouped sections.

## Accessibility and Responsiveness

- Preserve semantic buttons, links, labels, tables, and form controls.
- Maintain visible focus states with the lime accent.
- Keep color contrast strong in both light and dark contexts.
- Ensure mobile nav, tables, and forms do not overlap or overflow incoherently.
- Avoid relying on color alone for signed amounts; signs remain visible.

## Verification

Implementation is complete only after:

- Go formatting is run if Go files change.
- The Go app builds with `go test ./...` or the nearest repository-supported verification command.
- Template parsing/build succeeds.
- A local server is started if environment permits, and key pages are manually inspected in browser or via screenshot.
- At minimum, inspect dashboard, transactions, accounts, budgets, reports, login/register, settings, import, and a report chart page.

