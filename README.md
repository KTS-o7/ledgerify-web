# Ledgerify

Personal finance tracker — Go + SolidJS, PostgreSQL-backed, Docker-deployed. Self-hosted, single binary, embedded SPA.

Live at: [money.shenthar.me](https://money.shenthar.me)

## Stack

- **Backend:** Go, chi router, pgx/PostgreSQL, sqlc
- **Frontend:** SolidJS, `@solidjs/router`, Tailwind CSS v4, lucide-solid, Chart.js, Vite
- **Embed:** `//go:embed all:frontend/dist` — single binary serves both API and SPA
- **Auth:** JWT bearer tokens with refresh token rotation
- **AI:** Optional LLM categorization (self-hosted) with keyword-rule fallback
- **MCP:** Model Context Protocol SSE server at `/api/v1/mcp/sse` for AI assistants (Claude Desktop, etc.)
- **Deploy:** Docker multi-stage (golang:alpine → scratch)

## Quick Start

### Local Dev

```bash
# Set up PostgreSQL
createdb ledgerify
psql ledgerify < schema/001_schema.sql

# Run backend
cp .env.example .env   # edit DB credentials, JWT secret, optional LLM config
go run ./cmd/server
# → http://localhost:8080

# Run frontend (in another terminal, for HMR)
cd frontend
bun install
bun run dev
# → http://localhost:5173 (proxies /api to :8080)
```

### Database

The canonical schema lives in `schema/001_schema.sql`. The migration is intentionally a single combined file (Drizzle history was flattened when we moved to Go-only). All migrations since then (e.g. SIP/recalc) ship as additive DDL applied manually and documented in commit messages.

Use sqlc to generate Go query code from `queries/001_queries.sql`:
```bash
sqlc generate
```

> **Note:** Drizzle ORM was removed in the Go-only migration. The Go stack uses raw SQL via `pgx` + `sqlc`. Do not add Drizzle back.

### Docker

```bash
docker build -t ledgerify .
docker run -p 8080:8080 --env-file .env ledgerify
```

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `DATABASE_URL` | `postgres://localhost/ledgerify` | PostgreSQL connection string |
| `JWT_SECRET` | (required) | Signing key for auth tokens |
| `PORT` | `8080` | HTTP listen port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin for the SPA |
| `LLM_API_URL` | (optional) | Self-hosted LLM endpoint for AI categorization |
| `LLM_API_KEY` | (optional) | Bearer token for the LLM |
| `LLM_MODEL` | (optional) | Model name to send in requests |
| `LLM_USER_AGENT` | `ledgerify/1.0` | User-Agent header for LLM calls |
| `LLM_QUEUE_SIZE` | `128` | Max queued LLM jobs |
| `LLM_WORKERS` | `2` | Concurrent LLM workers |

## Features

### Core
- Multi-account transaction tracking (bank, wallet, cash, savings, credit card, investment)
- Income / expense / transfer / credit-payment transaction types
- AI-powered transaction categorization (LLM) with keyword-rule override
- CSV import with column auto-mapping
- CSV / JSON export

### Planning
- Budgets with monthly / weekly / yearly periods, rollover support, category-scoped
- Savings goals with progress tracking and status (active / achieved / abandoned)
- Auto-categorization keyword rules

### Investments & Loans
- **FDs, bonds, PPF, NPS, savings** — store interest rate (decimal-friendly, e.g. 7.75%), compounding frequency (monthly / quarterly / semi-annual / annual), maturity date. Current value is auto-computed using `A = P × (1 + r/n)^(n×t)` and written to the DB. Stale value indicator on each card.
- **Stocks, mutual funds, crypto, gold, silver, real estate** — quantity × current price model
- **Loans** — principal, interest rate, tenure → EMI auto-calculated using the standard formula. Outstanding balance auto-decrements when payments are recorded.
- **SIPs** — first-class entity, debt/equity/hybrid/other. Debt/hybrid SIPs compute corpus via the SIP future-value formula. Equity SIPs use NAV × units (user-supplied). Linear accumulation fallback for partial data.

### Reports
- Dashboard with summary cards, recent transactions, top categories
- Analytics with month selector
- Cashflow report
- Category breakdown report
- Budget vs actual report
- Net worth tracker with snapshots

### MCP (Model Context Protocol)
- SSE endpoint at `/api/v1/mcp/sse` exposing ~55 tools
- Categories, transactions, accounts, budgets, savings goals, investments, loans, SIPs, insurance, exchange rates, keyword rules
- Connect from Claude Desktop, Cursor, or any MCP-compatible client — see `/mcp` in the UI for a one-click config

### UX
- "Minimalist Bento" design system — dark mode, neon-lime primary, 24px bento radii
- Mobile-first bento grids
- Edit + delete on every entity card
- Inline keyboard-friendly sheets for all forms
- Per-account transaction filter (click an account card → filtered activity)
- Month selector on dashboard + analytics
- Date format and currency preferences (localStorage)

## Architecture

```
cmd/server/main.go        # chi router, SPA handler, cron startup
internal/
  auth/                   # JWT, password hashing, refresh tokens
  handlers/               # HTTP handlers per resource
  db/                     # sqlc-generated code
  llm/                    # LLM client + categorization queue
  mcp/                    # MCP server + tool registry
  middleware/             # auth, body limit, request ID
  recalc/                 # Investment/loan/SIP value engine
  utils/                  # net worth, JWT helpers, formatters
schema/                   # canonical SQL schema
queries/                  # sqlc input
frontend/src/
  pages/                  # 15+ route components
  components/
    ui/                   # design system primitives
    forms/                # add/edit forms
  lib/                    # api client, store, formatters
```

## License

Personal project. Not currently open-source.
