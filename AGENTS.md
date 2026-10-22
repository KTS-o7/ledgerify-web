# Ledgerify Agent Notes

This is a Go + SolidJS app. The frontend lives in `frontend/src/` (SolidJS SPA built with Vite, embedded into the Go binary via `//go:embed all:frontend/dist` in `embedassets.go`). The server entrypoint is `cmd/server/main.go`.

## Stack

- **Backend:** Go, chi router, pgx/PostgreSQL, sqlc
- **Frontend:** SolidJS, `@solidjs/router`, Tailwind CSS v4, lucide-solid, `@tanstack/solid-query` (in deps; not consistently used), Chart.js, Vite
- **Auth:** JWT bearer tokens, refresh token rotation
- **MCP:** Model Context Protocol server at `/api/v1/mcp/*`

## Project History

- The original stack was Next.js/React — **that has been removed**. Do not reintroduce Next.js, React, or any React-only ecosystem (Drizzle, etc.).
- A previous attempt also used HTMX + Pico.css with Go templates — also removed. The `web/templates/` and `web/static/` paths from that attempt no longer exist.
- The current SolidJS frontend is the canonical UI. The active design system is "Luxe" (dark ink + gold, light ivory + bronze, system default) — see `_handoff/README.md` for tokens, type, motion and screens, and `_handoff/design/` for the visual references. It replaced "Minimalist Bento".
- Colour tokens: use only `bg`, `sunken`, `surface`, `raised`, `border`, `border-strong`, `text`, `muted`, `faint`, `signal`, `signal-soft`, `btn`, `btn-text`, `pos`, `neg`, `warn`, `cat-1..6`, `nav`, `scrim`, `rail`. The legacy names `primary`, `accent`, `surface-hover` and raw Tailwind palette colours fail `bun run lint:colors`.
- Amounts render through `components/ui/money.tsx` (Geist Mono, tabular). Expenses stay in `text`; `neg` is for debt, negative balances and overspend.
- The app is a PWA: `public/sw.js` (cache + offline outbox + share target), `public/manifest.webmanifest`, `src/lib/pwa.ts`. Bump `VERSION` in `sw.js` when its caching rules change.

## Before Claiming Completion

```bash
# Frontend typecheck + build (catches TS / Vite / CSS regressions)
cd frontend && bun run build

# Backend (catches embed breakage, regression in Go tests)
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server

# Token rules
cd frontend && bun run lint:colors

# Diff sanity
git diff --check
```

For UI work, also run a smoke test of the affected pages at 375px (mobile) and 1280px (desktop) viewports before reporting done.
