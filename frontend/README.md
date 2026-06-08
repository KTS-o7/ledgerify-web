# Ledgerify Frontend

A SolidJS SPA for personal finance tracking. Built with Vite and embedded into the Go backend at `cmd/server/main.go` via `//go:embed all:frontend/dist`.

## Stack

- **SolidJS** + `@solidjs/router` — UI framework
- **Tailwind CSS v4** (CSS-first `@theme` config in `src/styles/custom.css`) — styling
- **lucide-solid** — icons
- **Chart.js** — Reports sub-pages (`/reports/cashflow`, `/reports/budget-vs-actual`)
- **Vite** + **Bun** — build tooling and runtime

## Usage

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # production build to ./dist
```

> The Go backend's `vite.config.ts` proxies `/api` to `http://localhost:8080` during dev. Start the backend before running the dev server for full functionality.

## Available Scripts

| Script | Description |
|---|---|
| `bun run dev` | Dev server with HMR |
| `bun run build` | Production build (tsc + vite) |
| `bun run test` | Run vitest unit tests |
| `bun run test:watch` | Vitest in watch mode |
| `bun run lint:colors` | Enforce `text-primary` dark-surface pairing rule (see Design System) |

## Design System — Minimalist Bento

The visual language is a dark-mode-only "Minimalist Bento" aesthetic — high-contrast zinc surfaces, neon-lime primary (`#CCFF00`), 24px bento radii, mobile-first bento grids.

**Spec:** [`docs/superpowers/specs/2026-06-06-minimalist-bento-ui-revamp-design.md`](../docs/superpowers/specs/2026-06-06-minimalist-bento-ui-revamp-design.md)

**Tokens** live in `src/styles/custom.css` under Tailwind v4's `@theme` block. Adding a token (e.g. a new color) propagates to a utility class automatically.

**Type:** Space Grotesk (display), DM Sans (body), JetBrains Mono (data) — self-hosted via `@fontsource/*`.

**Primitives** in `src/components/ui/`: `BentoBlock` (the signature 24px-radius surface), `Stat`, `Sparkline`, `DonutChart`, `CategoryBar`, `SegmentedControl`, `SearchBar`, `EmptyState`, `SkeletonRow`, `SkeletonBlock`, `AccountRow`, `TransactionRow`, `Button`, `Input`, `Select`, `Badge`, `PageHeader`, `BottomNav`, `Sidebar`, `MoreSheet`.

**The `lint:colors` rule:** `text-primary` is only legal when paired with `bg-bg`, `bg-surface`, `bg-surface-hover`, `bg-text`, `bg-primary`, or `bg-accent` (or their `/opacity` variants). This is the mechanical mitigation for the lime-vibration risk. The script lives at `scripts/lint-colors.mjs`.

## Pages

19 routes, all rebuilt to bento:
1. Dashboard (`/dashboard`)
2. Activity (`/activity`, aliased to `/transactions`)
3. Accounts (`/accounts`)
4. Analytics (`/analytics`)
5. Budgets (`/budgets`)
6. Categories (`/categories`)
7. Investments (`/investments`)
8. Loans (`/loans`)
9. SIPs (`/sips`)
10. Insurance (`/insurance`)
11. Savings (`/savings`)
12. Net Worth (`/networth`)
13. Reports (`/reports`, hub for sub-routes)
14. Import (`/import`)
15. Export (`/export`)
16. Settings (`/settings`)
17. MCP Connect (`/mcp`)
18. Login / Register (`/login`, `/register`)

## Known Gaps

- **Outdoor / high-contrast theme:** deferred. The bento aesthetic is designed for deep zinc. A high-contrast option is a future revamp.
- **TanStack Query:** in `package.json` but not used. Per-page data fetching uses Solid's `createResource`. Migrating to TanStack Query is a separate concern.
- **Multi-currency conversion:** not implemented. `formatCurrency` reads `localStorage["ledgerify.currency"]` for display; no FX rate fetching.
