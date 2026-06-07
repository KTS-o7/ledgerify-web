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
- The current SolidJS frontend is the canonical UI. The active design system is "Minimalist Bento" — see `docs/superpowers/specs/2026-06-06-minimalist-bento-ui-revamp-design.md`.

## Before Claiming Completion

```bash
# Frontend typecheck + build (catches TS / Vite / CSS regressions)
cd frontend && bun run build

# Backend (catches embed breakage, regression in Go tests)
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server

# Diff sanity
git diff --check
```

For UI work, also run a smoke test of the affected pages at 375px (mobile) and 1280px (desktop) viewports before reporting done.
