# Net Worth Tracking Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cashew-like net worth tracking: daily snapshots, historical chart, asset/liability breakdown, and a dedicated Net Worth page.

**Architecture:** New `networth_snapshots` table stores daily snapshots. A background job (or on-demand endpoint) computes net worth from accounts + investments + loans. New API endpoints serve historical data and breakdowns. SolidJS frontend renders the Net Worth page with line chart + donut charts.

**Tech Stack:** Go 1.26, sqlc, PostgreSQL 17, SolidJS, Chart.js

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `schema/001_schema.sql` | Modify | Add `networth_snapshots` table |
| `queries/001_queries.sql` | Modify | Add snapshot queries |
| `internal/db/001_queries.sql.go` | Regenerate | sqlc-generated code |
| `internal/handlers/networth.go` | Create | Net worth API handlers |
| `cmd/server/main.go` | Modify | Mount net worth routes + snapshot job |
| `frontend/src/pages/NetWorth.tsx` | Modify | Full Cashew-like net worth page |

---

## Task 1: Add Net Worth Snapshots Table

**Files:**
- Create: `schema/002_networth_snapshots.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration 002: Net Worth Snapshots
-- Run: psql $DATABASE_URL -f schema/002_networth_snapshots.sql

-- Net Worth Snapshots (daily snapshots for historical charting)
CREATE TABLE IF NOT EXISTS "networth_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "date" date NOT NULL,
    "total_assets" numeric(18,4) NOT NULL DEFAULT 0,
    "total_liabilities" numeric(18,4) NOT NULL DEFAULT 0,
    "networth" numeric(18,4) NOT NULL DEFAULT 0,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "networth_snapshots_user_date UNIQUE"("user_id", "date")
);

ALTER TABLE "networth_snapshots" ADD CONSTRAINT "networth_snapshots_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
```

- [ ] **Step 2: Commit**

```bash
git add schema/002_networth_snapshots.sql
git commit -m "feat: add networth_snapshots migration"
```

---

## Task 2: Add sqlc Queries for Snapshots

**Files:**
- Modify: `queries/001_queries.sql`

- [ ] **Step 1: Add snapshot queries**

```sql
-- Net Worth Snapshots
-- name: UpsertNetworthSnapshot :exec
INSERT INTO networth_snapshots (user_id, date, total_assets, total_liabilities, networth)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, date) DO UPDATE SET
    total_assets = $3, total_liabilities = $4, networth = $5;

-- name: GetNetworthSnapshots :many
SELECT date::text, total_assets, total_liabilities, networth
FROM networth_snapshots
WHERE user_id = $1 AND date >= $2 AND date <= $3
ORDER BY date;

-- name: GetLatestNetworthSnapshot :one
SELECT date::text, total_assets, total_liabilities, networth
FROM networth_snapshots
WHERE user_id = $1
ORDER BY date DESC LIMIT 1;

-- name: GetPreviousNetworthSnapshot :one
SELECT date::text, total_assets, total_liabilities, networth
FROM networth_snapshots
WHERE user_id = $1 AND date < $2
ORDER BY date DESC LIMIT 1;
```

- [ ] **Step 2: Regenerate sqlc**

```bash
sqlc generate
```

- [ ] **Step 3: Commit**

```bash
git add queries/001_queries.sql internal/db/001_queries.sql.go internal/db/querier.go
git commit -m "feat: add networth snapshot sqlc queries"
```

---

## Task 3: Add Breakdown Queries

**Files:**
- Modify: `queries/001_queries.sql`

- [ ] **Step 1: Add breakdown queries**

```sql
-- Asset Breakdown by Account Type
-- name: GetAssetBreakdownByType :many
SELECT a.type::text as account_type,
    COALESCE(a.opening_balance, 0) + COALESCE(SUM(
        CASE WHEN t.type = 'income' THEN t.amount
             WHEN t.type = 'expense' THEN -t.amount
             ELSE 0 END
    ), 0) as balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
WHERE a.user_id = $1 AND a.deleted_at IS NULL
GROUP BY a.id, a.type, a.opening_balance
HAVING COALESCE(a.opening_balance, 0) + COALESCE(SUM(
    CASE WHEN t.type = 'income' THEN t.amount
         WHEN t.type = 'expense' THEN -t.amount
         ELSE 0 END
), 0) > 0
ORDER BY balance DESC;

-- Investment Breakdown by Asset Type
-- name: GetInvestmentBreakdownByType :many
SELECT asset_type::text,
    SUM(COALESCE(quantity, 0) * COALESCE(current_price, 0)) as value
FROM investments
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY asset_type
HAVING SUM(COALESCE(quantity, 0) * COALESCE(current_price, 0)) > 0
ORDER BY value DESC;

-- Liability Breakdown by Loan Type
-- name: GetLiabilityBreakdownByType :many
SELECT loan_type::text,
    SUM(COALESCE(outstanding_balance, 0)) as total
FROM loans
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY loan_type
HAVING SUM(COALESCE(outstanding_balance, 0)) > 0
ORDER BY total DESC;
```

- [ ] **Step 2: Regenerate sqlc**

```bash
sqlc generate
```

- [ ] **Step 3: Commit**

```bash
git add queries/001_queries.sql internal/db/001_queries.sql.go
git commit -m "feat: add asset/investment/liability breakdown queries"
```

---

## Task 4: Create Net Worth Handler

**Files:**
- Create: `internal/handlers/networth.go`

- [ ] **Step 1: Create handler file**

```go
// internal/handlers/networth.go
package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// networthQuerierAdapter wraps *db.Queries and *db.CustomQueries to satisfy
// utils.NetworthQuerier interface (which requires GetAccountBalance).
type networthQuerierAdapter struct {
	*db.Queries
	cq *db.CustomQueries
}

func (a *networthQuerierAdapter) GetAccountBalance(ctx context.Context, accountID pgtype.UUID) (float64, error) {
	return a.cq.GetAccountBalanceForUser(ctx, accountID)
}

type NetworthHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
	cq   *db.CustomQueries
}

func NewNetworthHandler(pool *pgxpool.Pool, q *db.Queries, cq *db.CustomQueries) *NetworthHandler {
	return &NetworthHandler{pool: pool, q: q, cq: cq}
}

type NetworthResponse struct {
	TotalAssets      float64 `json:"total_assets"`
	TotalLiabilities float64 `json:"total_liabilities"`
	Networth         float64 `json:"networth"`
	DailyChange      float64 `json:"daily_change"`
	DailyChangePct   float64 `json:"daily_change_pct"`
}

type SnapshotEntry struct {
	Date             string  `json:"date"`
	TotalAssets      float64 `json:"total_assets"`
	TotalLiabilities float64 `json:"total_liabilities"`
	Networth         float64 `json:"networth"`
}

type BreakdownEntry struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type BreakdownResponse struct {
	Assets      []BreakdownEntry `json:"assets"`
	Liabilities []BreakdownEntry `json:"liabilities"`
}

// numericToFloat64 safely converts pgtype.Numeric to float64
func numericToFloat64(n pgtype.Numeric) float64 {
	v, err := n.Float64Value()
	if err != nil || !v.Valid {
		return 0
	}
	return v.Float64
}

func (h *NetworthHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	latest, err := h.q.GetLatestNetworthSnapshot(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	latestNetworth := numericToFloat64(latest.Networth)
	latestAssets := numericToFloat64(latest.TotalAssets)
	latestLiabilities := numericToFloat64(latest.TotalLiabilities)

	// Get previous snapshot for daily change — need to pass a date before today
	today := pgtype.Date{Time: time.Now(), Valid: true}
	prev, err := h.q.GetPreviousNetworthSnapshot(r.Context(), userID, today)
	if err != nil || !prev.Networth.Valid {
		prev = latest
	}

	prevNetworth := numericToFloat64(prev.Networth)
	dailyChange := latestNetworth - prevNetworth
	dailyChangePct := 0.0
	if prevNetworth != 0 {
		dailyChangePct = (dailyChange / prevNetworth) * 100
	}

	utils.OK(w, NetworthResponse{
		TotalAssets:      latestAssets,
		TotalLiabilities: latestLiabilities,
		Networth:         latestNetworth,
		DailyChange:      dailyChange,
		DailyChangePct:   dailyChangePct,
	})
}

func (h *NetworthHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	period := r.URL.Query().Get("period")
	now := time.Now()
	var fromDate pgtype.Date

	switch period {
	case "1m":
		fromDate = pgtype.Date{Time: now.AddDate(0, -1, 0), Valid: true}
	case "3m":
		fromDate = pgtype.Date{Time: now.AddDate(0, -3, 0), Valid: true}
	case "6m":
		fromDate = pgtype.Date{Time: now.AddDate(0, -6, 0), Valid: true}
	case "1y":
		fromDate = pgtype.Date{Time: now.AddDate(-1, 0, 0), Valid: true}
	default:
		fromDate = pgtype.Date{Time: now.AddDate(-3, 0, 0), Valid: true}
	}

	snapshots, err := h.q.GetNetworthSnapshots(r.Context(), userID, fromDate, pgtype.Date{Time: now, Valid: true})
	if err != nil {
		utils.InternalError(w)
		return
	}

	result := make([]SnapshotEntry, len(snapshots))
	for i, s := range snapshots {
		result[i] = SnapshotEntry{
			Date:             s.Date,
			TotalAssets:      numericToFloat64(s.TotalAssets),
			TotalLiabilities: numericToFloat64(s.TotalLiabilities),
			Networth:         numericToFloat64(s.Networth),
		}
	}

	utils.OK(w, map[string]interface{}{"snapshots": result})
}

func (h *NetworthHandler) GetBreakdown(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	assets, err := h.q.GetAssetBreakdownByType(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	investments, err := h.q.GetInvestmentBreakdownByType(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	liabilities, err := h.q.GetLiabilityBreakdownByType(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	assetEntries := make([]BreakdownEntry, 0)
	for _, a := range assets {
		assetEntries = append(assetEntries, BreakdownEntry{
			Label: a.AccountType,
			Value: numericToFloat64(a.Balance),
		})
	}
	for _, inv := range investments {
		assetEntries = append(assetEntries, BreakdownEntry{
			Label: inv.AssetType,
			Value: numericToFloat64(inv.Value),
		})
	}

	liabilityEntries := make([]BreakdownEntry, 0)
	for _, l := range liabilities {
		liabilityEntries = append(liabilityEntries, BreakdownEntry{
			Label: l.LoanType,
			Value: numericToFloat64(l.Total),
		})
	}

	utils.OK(w, BreakdownResponse{
		Assets:      assetEntries,
		Liabilities: liabilityEntries,
	})
}

func (h *NetworthHandler) GenerateSnapshot(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	adapter := &networthQuerierAdapter{Queries: h.q, cq: h.cq}
	result, err := utils.ComputeNetworth(adapter, userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	date := pgtype.Date{Time: time.Now(), Valid: true}

	// Construct pgtype.Numeric from float64 values
	var assetsNum, liabilitiesNum, networthNum pgtype.Numeric
	assetsNum.Scan(result.TotalAssets)
	liabilitiesNum.Scan(result.TotalLiabilities)
	networthNum.Scan(result.Networth)

	err = h.q.UpsertNetworthSnapshot(r.Context(), userID, date,
		assetsNum, liabilitiesNum, networthNum,
	)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, map[string]interface{}{"message": "snapshot generated", "date": time.Now().Format("2006-01-02")})
}
```

- [ ] **Step 2: Commit**

```bash
git add internal/handlers/networth.go
git commit -m "feat: add net worth API handlers"
```

---

## Task 5: Mount Routes in main.go

**Files:**
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Create handler and mount routes**

```go
networthHandler := handlers.NewNetworthHandler(pool, q, cq)

// In the authenticated route group:
r.Get("/api/v1/networth", networthHandler.Get)
r.Get("/api/v1/networth/history", networthHandler.GetHistory)
r.Get("/api/v1/networth/breakdown", networthHandler.GetBreakdown)
r.Post("/api/v1/networth/snapshot", networthHandler.GenerateSnapshot)
```

- [ ] **Step 2: Add daily snapshot generation**

Generate snapshot on-demand when today's snapshot doesn't exist. In `Get` handler, after getting `latest`, if `latest.date != today`, auto-generate:

```go
// In the Get handler, after getting latest snapshot:
today := time.Now().Format("2006-01-02")
if latest.Date != today {
    // Auto-generate today's snapshot
    adapter := &networthQuerierAdapter{Queries: h.q, cq: h.cq}
    result, err := utils.ComputeNetworth(adapter, userID)
    if err == nil {
        date := pgtype.Date{Time: time.Now(), Valid: true}
        var assetsNum, liabilitiesNum, networthNum pgtype.Numeric
        assetsNum.Scan(result.TotalAssets)
        liabilitiesNum.Scan(result.TotalLiabilities)
        networthNum.Scan(result.Networth)
        h.q.UpsertNetworthSnapshot(r.Context(), userID, date, assetsNum, liabilitiesNum, networthNum)
        // Re-fetch latest
        latest, _ = h.q.GetLatestNetworthSnapshot(r.Context(), userID)
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add cmd/server/main.go
git commit -m "feat: mount net worth routes and snapshot generation"
```

---

## Task 6: Build Net Worth Page in SolidJS

**Files:**
- Modify: `frontend/src/pages/NetWorth.tsx`

- [ ] **Step 1: Create full Net Worth page**

```tsx
// frontend/src/pages/NetWorth.tsx
import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../lib/api";

interface NetworthData {
  total_assets: number;
  total_liabilities: number;
  networth: number;
  daily_change: number;
  daily_change_pct: number;
}

interface Snapshot {
  date: string;
  networth: number;
  total_assets: number;
  total_liabilities: number;
}

interface BreakdownEntry {
  label: string;
  value: number;
}

interface BreakdownData {
  assets: BreakdownEntry[];
  liabilities: BreakdownEntry[];
}

export default function NetWorth() {
  const [period, setPeriod] = createSignal("1y");

  const [networth] = createResource(() => api.get<NetworthData>("/v1/networth"));
  const [history] = createResource(
    () => period(),
    (p) => api.get<{ snapshots: Snapshot[] }>(`/v1/networth/history?period=${p}`)
  );
  const [breakdown] = createResource(() => api.get<BreakdownData>("/v1/networth/breakdown"));

  return (
    <div>
      <h1>Net Worth</h1>

      <Show when={networth()}>
        <div class="networth-hero">
          <div class="networth-total">
            <span class="label">Net Worth</span>
            <span class="value">{formatCurrency(networth()!.networth)}</span>
          </div>
          <div class={`networth-change ${networth()!.daily_change >= 0 ? "positive" : "negative"}`}>
            {networth()!.daily_change >= 0 ? "↑" : "↓"}{" "}
            {formatCurrency(Math.abs(networth()!.daily_change))}{" "}
            ({networth()!.daily_change_pct.toFixed(2)}%) today
          </div>
        </div>

        <div class="networth-summary">
          <div class="summary-card assets">
            <span class="label">Assets</span>
            <span class="value">{formatCurrency(networth()!.total_assets)}</span>
          </div>
          <div class="summary-card liabilities">
            <span class="label">Liabilities</span>
            <span class="value">{formatCurrency(networth()!.total_liabilities)}</span>
          </div>
        </div>
      </Show>

      <div class="period-selector">
        <For each={["1m", "3m", "6m", "1y", "all"]}>
          {(p) => (
            <button
              classList={{ active: period() === p }}
              onClick={() => setPeriod(p)}
            >
              {p.toUpperCase()}
            </button>
          )}
        </For>
      </div>

      <Show when={history()}>
        <div class="chart-container">
          <canvas id="networth-chart" ref={(el) => renderChart(el, history()!.snapshots)} />
        </div>
      </Show>

      <Show when={breakdown()}>
        <div class="breakdown-grid">
          <div class="breakdown-section">
            <h3>Assets</h3>
            <For each={breakdown()!.assets}>
              {(item) => (
                <div class="breakdown-item">
                  <span>{item.label}</span>
                  <span>{formatCurrency(item.value)}</span>
                </div>
              )}
            </For>
          </div>
          <div class="breakdown-section">
            <h3>Liabilities</h3>
            <For each={breakdown()!.liabilities}>
              {(item) => (
                <div class="breakdown-item">
                  <span>{item.label}</span>
                  <span>{formatCurrency(item.value)}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function renderChart(canvas: HTMLCanvasElement, snapshots: Snapshot[]) {
  // Chart.js line chart with gradient fill
  import("chart.js").then(({ Chart, registerables }) => {
    Chart.register(...registerables);
    new Chart(canvas, {
      type: "line",
      data: {
        labels: snapshots.map((s) => s.date),
        datasets: [
          {
            label: "Net Worth",
            data: snapshots.map((s) => s.networth),
            borderColor: "#c25a3e",
            backgroundColor: "rgba(194, 90, 62, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false },
        },
      },
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/NetWorth.tsx
git commit -m "feat: add Cashew-like net worth page with charts"
```

---

## Task 7: Build and Test

- [ ] **Step 1: Run sqlc generate**

```bash
sqlc generate
```

- [ ] **Step 2: Run database migration**

```bash
# Apply the new table to the database
psql $DATABASE_URL -f schema/001_schema.sql
```

- [ ] **Step 3: Build Go server**

```bash
go build -o /tmp/ledgerify-server ./cmd/server
```

- [ ] **Step 4: Build frontend**

```bash
cd frontend && bun run build && cd ..
```

- [ ] **Step 5: Run all tests**

```bash
go test ./...
```

- [ ] **Step 6: Manual test**

- Call `POST /api/v1/networth/snapshot` to generate a snapshot
- Call `GET /api/v1/networth` — verify returns correct data
- Call `GET /api/v1/networth/history?period=3m` — verify snapshots
- Call `GET /api/v1/networth/breakdown` — verify asset/liability breakdown
- Open Net Worth page in browser — verify chart renders

- [ ] **Step 7: Commit any fixes**

```bash
git add -A && git commit -m "fix: net worth integration fixes"
```

---

## Verification Checklist

- [ ] `networth_snapshots` table exists in database
- [ ] `sqlc generate` succeeds
- [ ] `go build ./cmd/server` succeeds
- [ ] `go test ./...` passes
- [ ] `GET /api/v1/networth` returns current net worth
- [ ] `GET /api/v1/networth/history` returns snapshots
- [ ] `GET /api/v1/networth/breakdown` returns asset/liability breakdown
- [ ] `POST /api/v1/networth/snapshot` generates today's snapshot
- [ ] Net Worth page renders hero number with daily change
- [ ] Line chart renders historical data
- [ ] Asset/liability breakdown shows correctly
- [ ] Period selector (1M/3M/6M/1Y/All) works
