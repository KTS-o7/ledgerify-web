# Ledgerify Full Revamp — Design Spec

## Overview

Ledgerify is a personal finance + net worth tracking app. The revamp has 4 pillars:

1. **LLM Categorization** — auto-categorize transactions via a fast self-hosted LLM
2. **Frontend Rewrite** — Go/HTMX → SolidJS SPA with Bun
3. **MCP Server** — let AI agents CRUD transactions via Model Context Protocol
4. **Net Worth Tracking** — Cashew-like asset/liability dashboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      SolidJS SPA (Bun)                   │
│  Router: @solidjs/router  │  Build: Vite  │  UI: Pico   │
│  pages: dashboard, transactions, accounts, investments,  │
│  loans, insurance, budgets, reports, networth, settings  │
└───────────────────────┬─────────────────────────────────┘
                        │ fetch() / WebSocket
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Go API Server (chi)                     │
│                                                           │
│  /api/v1/*         — REST CRUD (existing, 67 queries)    │
│  /api/v1/mcp       — MCP endpoint (SSE transport)        │
│  /static/*         — serves built SPA dist/              │
│  /health           — health check                        │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ LLM Clien│  │ LLM Queue│  │ MCP Srvr │              │
│  │ (net/http│  │ (async)  │  │ (go-sdk) │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────────────┬─────────────────────────────────┘
                        │ pgx pool
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    PostgreSQL 17                          │
│  16 tables, 67+ queries, sqlc-generated                  │
└─────────────────────────────────────────────────────────┘
```

---

## Pillar 1: LLM Categorization

See separate spec: `2026-05-30-llm-categorization-design.md`. Core pieces:
- `internal/llm/client.go` — OpenAI-compatible client
- `internal/llm/queue.go` — async background queue
- Hybrid keyword-first, LLM-fallback in batch categorise
- Auto-categorize on transaction creation (async)

---

## Pillar 2: Frontend Rewrite (SolidJS + Bun)

### Why SolidJS

| Metric | SolidJS | React | Vue 3 | Svelte |
|--------|---------|-------|-------|--------|
| Bundle | ~7kb | ~42kb | ~34kb | ~12kb |
| No VDOM | Yes | No | No | No |
| React-like JSX | Yes | Yes | No | No |
| Fine-grained reactivity | Signals | Hooks | Refs | Runes |

SolidJS is ideal: tiny bundle, no virtual DOM, familiar JSX syntax, great for data-heavy dashboards.

### Stack

- **Runtime:** Bun (package manager + dev server)
- **Framework:** SolidJS
- **Router:** `@solidjs/router`
- **Build:** Vite (via `vite-plugin-solid`)
- **Styling:** Pico.css + custom CSS (keep Terracotta theme)
- **HTTP:** `@solidjs/query` for data fetching + cache
- **Charts:** Chart.js or ApexCharts (solid wrapper)
- **Forms:** `@solidjs/form` or native
- **Auth:** JWT in localStorage, sent via Authorization header

### Directory Structure

```
frontend/
├── src/
│   ├── index.tsx              # Entry point
│   ├── App.tsx                # Router setup
│   ├── api/
│   │   ├── client.ts          # fetch wrapper with JWT
│   │   ├── auth.ts            # login, register, me
│   │   ├── transactions.ts    # CRUD + categorise
│   │   ├── accounts.ts
│   │   ├── categories.ts
│   │   ├── budgets.ts
│   │   ├── investments.ts
│   │   ├── loans.ts
│   │   ├── insurance.ts
│   │   ├── savings.ts
│   │   ├── summary.ts         # Dashboard data
│   │   └── networth.ts        # Net worth history
│   ├── components/
│   │   ├── Layout.tsx          # Sidebar + topbar shell
│   │   ├── Sidebar.tsx         # Icon sidebar (like current)
│   │   ├── TransactionForm.tsx
│   │   ├── TransactionList.tsx
│   │   ├── AccountCard.tsx
│   │   ├── BudgetProgress.tsx
│   │   ├── KPI.tsx
│   │   ├── Chart.tsx           # Chart.js wrapper
│   │   └── ...
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Transactions.tsx
│   │   ├── Accounts.tsx
│   │   ├── AccountDetail.tsx
│   │   ├── Budgets.tsx
│   │   ├── BudgetDetail.tsx
│   │   ├── Investments.tsx
│   │   ├── Loans.tsx
│   │   ├── Insurance.tsx
│   │   ├── NetWorth.tsx        # Cashew-like full page
│   │   ├── Reports.tsx
│   │   ├── Reports/CashFlow.tsx
│   │   ├── Reports/Category.tsx
│   │   ├── Reports/BudgetVsActual.tsx
│   │   ├── Reports/NetWorth.tsx
│   │   ├── Reports/InvestmentReturns.tsx
│   │   ├── Reports/DebtPayoff.tsx
│   │   ├── Import.tsx
│   │   ├── Export.tsx
│   │   ├── Settings.tsx
│   │   ├── Settings/Categories.tsx
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── lib/
│   │   ├── store.ts            # SolidJS stores
│   │   ├── currency.ts         # Formatting helpers
│   │   └── date.ts
│   └── styles/
│       └── custom.css          # Terracotta theme (port from Go)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── bun.lockb
```

### Go Backend Changes

- **Remove:** All `internal/templates/` page handlers, `web/templates/`, `embedassets.go`
- **Add:** Serve `frontend/dist/` as static files for SPA routing
- **Keep:** All `/api/v1/*` handlers unchanged (they're already JSON)
- **Add:** CORS config for dev (`localhost:5173`)

### SPA Routing

```
/login          → Login.tsx
/register       → Register.tsx
/dashboard      → Dashboard.tsx
/transactions   → Transactions.tsx
/accounts       → Accounts.tsx
/accounts/:id   → AccountDetail.tsx
/budgets        → Budgets.tsx
/investments    → Investments.tsx
/loans          → Loans.tsx
/insurance      → Insurance.tsx
/networth       → NetWorth.tsx
/reports        → Reports.tsx
/reports/*      → Report sub-pages
/import         → Import.tsx
/export         → Export.tsx
/settings       → Settings.tsx
/settings/categories → Settings/Categories.tsx
```

### Auth Flow

1. Login → `POST /api/v1/auth/login` → receive JWT
2. Store JWT in `localStorage`
3. All API calls include `Authorization: Bearer {jwt}`
4. Auth middleware on Go side validates JWT
5. SolidJS route guard: redirect to `/login` if no valid JWT

---

## Pillar 3: MCP Server

### What is MCP

Model Context Protocol (MCP) is an open standard (JSON-RPC 2.0) that lets AI assistants (Claude, Cursor, etc.) interact with external tools via a standardized interface. Agents discover tools, call them, and get structured results.

### Implementation

- **SDK:** `github.com/modelcontextprotocol/go-sdk` (official Go SDK)
- **Transport:** SSE over HTTP, served at `/api/v1/mcp`
- **Auth:** Bearer token (same JWT as REST API)

### MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_transactions` | List user's transactions with filters | `type?`, `account_id?`, `category_id?`, `from_date?`, `to_date?`, `limit?` |
| `get_transaction` | Get single transaction by ID | `transaction_id` |
| `create_transaction` | Create a new transaction | `account_id`, `type`, `amount`, `currency`, `title`, `category_id?`, `date`, `note?` |
| `update_transaction` | Update an existing transaction | `transaction_id`, fields to update |
| `delete_transaction` | Soft-delete a transaction | `transaction_id` |
| `list_accounts` | List all accounts with balances | — |
| `create_account` | Create a new account | `name`, `type`, `currency`, `opening_balance?` |
| `list_categories` | List user's categories | — |
| `get_summary` | Dashboard summary (income/expenses/networth) | `from_date?`, `to_date?` |
| `list_investments` | List investments with current values | — |
| `list_budgets` | List budgets with spent amounts | — |
| `categorise_transactions` | Auto-categorise uncategorised transactions | `transaction_ids?` (optional, all if empty) |

### MCP Resources

| Resource | URI | Description |
|----------|-----|-------------|
| `user_profile` | `ledgerify://user/profile` | Current user info |
| `accounts` | `ledgerify://accounts` | All accounts |
| `categories` | `ledgerify://categories` | All categories |
| `net_worth` | `ledgerify://networth` | Current net worth breakdown |

### Go Integration

```go
// In cmd/server/main.go
mcpServer := mcp.NewMCPServer("ledgerify", "1.0.0")

// Register tools
mcpServer.AddTool(listTransactionsTool, handleMCPListTransactions)
mcpServer.AddTool(createTransactionTool, handleMCPCreateTransaction)
// ... etc

// Mount at /api/v1/mcp
r.Handle("/api/v1/mcp/*", mcpHandler)
```

The MCP handler uses the same `db.Queries` and `pgxpool.Pool` as the REST handlers — no new data layer needed.

### Agent Configuration

Users connect their AI agents by adding to their MCP client config:

```json
{
  "mcpServers": {
    "ledgerify": {
      "url": "http://localhost:8080/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer <jwt-token>"
      }
    }
  }
}
```

---

## Pillar 4: Net Worth Tracking (Cashew-like)

### What Cashew Does

Cashew is a popular personal finance app focused on:
- Net worth dashboard with asset/liability breakdown
- Account-level balance tracking over time
- Historical net worth chart (daily/monthly)
- Investment portfolio with gain/loss
- Debt tracking with payoff projections
- Multi-currency support

### Current State

- `networth` page is a placeholder
- `GetMonthlyNetworth` custom query exists (daily trend from transactions)
- `ListAccountsWithBalance` exists (computed balances)
- Investment, loan, insurance tables exist with CRUD

### What We Build

**Net Worth Page (`/networth`):**
- Hero number: total net worth (assets - liabilities)
- Asset breakdown: accounts grouped by type (bank, investment, savings, etc.)
- Liability breakdown: loans + credit cards
- Historical chart: net worth over time (1M, 3M, 6M, 1Y, all)
- Daily delta: change from yesterday
- Account-level drill-down

**Dashboard Enhancement:**
- Net worth trend chart (already partially there)
- Asset allocation pie chart
- Top 5 accounts by balance
- Monthly net worth change indicator

**New Queries Needed:**
- `GetNetWorthHistory(userID, fromDate, toDate)` — daily net worth snapshots
- `GetAssetBreakdown(userID)` — assets grouped by account type
- `GetLiabilityBreakdown(userID)` — liabilities grouped by type

**New API Endpoints:**
- `GET /api/v1/networth` — current breakdown
- `GET /api/v1/networth/history?period=3m` — historical data points
- `GET /api/v1/networth/breakdown` — asset/liability detail

---

## Implementation Order

### Phase 1: LLM Categorization (Ready Now)
- Create `internal/llm/client.go` + `queue.go`
- Modify `import_export.go` for batch LLM fallback
- Modify `transactions.go` for async auto-categorize on creation
- Wire in `main.go`

### Phase 2: MCP Server
- Add `github.com/modelcontextprotocol/go-sdk` dependency
- Create `internal/mcp/` package with tool definitions
- Mount SSE handler at `/api/v1/mcp`
- Auth middleware for MCP endpoint

### Phase 3: Frontend Rewrite
- Scaffold SolidJS + Bun project in `frontend/`
- Port all pages from Go templates to SolidJS components
- Port Terracotta CSS theme
- Wire API calls to Go backend
- Remove old Go template code

### Phase 4: Net Worth Enhancement
- Add new net worth queries
- Add new API endpoints
- Build rich NetWorth page in SolidJS
- Enhance dashboard with net worth widgets

---

## Testing Strategy

- **LLM:** Unit test with `httptest.Server` mock, curl smoke test, accuracy benchmark
- **MCP:** Unit test tool handlers, integration test with MCP client SDK
- **Frontend:** Component tests with `vitest` + `@solidjs/testing-library`
- **E2E:** Manual testing of full flow (login → create transaction → see category → check net worth)
- **API:** Existing Go tests + new MCP endpoint tests

---

## Key Decisions Summary

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Frontend framework | SolidJS | Tiny bundle, no VDOM, React-like, great for dashboards |
| Build tool | Bun | Fast, replaces npm/yarn/webpack |
| MCP transport | SSE over HTTP | Embedded in Go server, easy agent connection |
| MCP auth | Same JWT as REST | Single auth system, no extra complexity |
| Styling | Pico.css + custom | Keep existing Terracotta theme, minimize porting effort |
| Net worth | New dedicated page | Cashew-like full-page experience, not just a chart |
| LLM fallback | Keyword first, LLM second | Zero-cost fast path, smart fallback |
