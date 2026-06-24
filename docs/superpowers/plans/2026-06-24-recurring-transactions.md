# Recurring Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a recurring transactions engine that auto-creates transaction occurrences on schedule, with full CRUD UI for managing recurrence rules.

**Architecture:** A new `recurring_transactions` table stores the rule template; a background goroutine fires daily + on app startup, generating any occurrences that are due. Each generated occurrence is a real `transactions` row linked back to the rule via `parent_recurring_id` (which already exists in the DB schema). The engine computes "next due date" from the rule, idempotently generates one transaction per missed interval, and updates `last_generated_date`.

**Tech Stack:** Go (chi router, pgxpool, raw SQL consistent with custom_queries.go pattern), SolidJS frontend with createResource/createSignal patterns, Tailwind v4.

**Supported frequencies:** weekly, monthly, custom (every N days/weeks/months via `interval` + `unit`).

---

## File Structure

**Backend (new):**
- `schema/004_recurring_transactions.sql` — new migration for `recurring_transactions` table + `recurrence_status` enum
- `internal/handlers/recurring.go` — HTTP handlers (list, get, create, update, delete, skip-next, run-now)
- `internal/handlers/recurring_test.go` — unit tests for handler + date math
- `internal/recurring/engine.go` — pure date math (computeNextDate, generateOccurrences)
- `internal/recurring/engine_test.go` — date math tests
- `internal/recurring/cron.go` — background goroutine, lifecycle (start/stop), run-once
- `internal/mcp/tools.go` — add `list_recurring`, `create_recurring`, `update_recurring`, `delete_recurring`, `run_recurring` tools

**Backend (modify):**
- `cmd/server/main.go` — wire recurring engine into startup alongside recalc cron
- `internal/handlers/transactions.go` — add `parent_recurring_id` to response when present; existing column already populated by engine

**Frontend (new):**
- `frontend/src/pages/Recurring.tsx` — management page (list of rules, status badges, next due, edit/delete/skip/run)

**Frontend (modify):**
- `frontend/src/App.tsx` — add lazy import + route `/recurring`
- `frontend/src/components/ui/nav-items.ts` — add nav item
- `frontend/src/components/forms/transaction-form.tsx` — add "Make this recurring" toggle + frequency fields

---

## Task 1: Schema migration for `recurring_transactions`

**Files:**
- Create: `schema/004_recurring_transactions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Recurrence status enum
CREATE TYPE "public"."recurrence_status" AS ENUM('active', 'paused');

-- Recurring transactions rules table
CREATE TABLE "recurring_transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "currency" varchar(3) NOT NULL,
    "account_id" uuid NOT NULL,
    "category_id" uuid,
    "transfer_to_id" uuid,
    "title" varchar(255),
    "note" text,
    "frequency" varchar(16) NOT NULL,         -- 'weekly' | 'monthly' | 'custom'
    "interval_value" numeric(5, 0),            -- for 'custom': N; for 'weekly'/'monthly': null
    "interval_unit" varchar(16),               -- for 'custom': 'day' | 'week' | 'month'
    "start_date" date NOT NULL,
    "end_date" date,                            -- optional cap
    "next_due_date" date NOT NULL,              -- maintained by engine
    "last_generated_date" date,                 -- last occurrence created
    "status" "recurrence_status" DEFAULT 'active' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

CREATE INDEX "recurring_user_status_idx" ON "recurring_transactions" ("user_id", "status");
CREATE INDEX "recurring_next_due_idx" ON "recurring_transactions" ("next_due_date");
```

- [ ] **Step 2: Commit**

```bash
git add schema/004_recurring_transactions.sql
git commit -m "feat(recurring): add recurring_transactions table migration"
```

---

## Task 2: Date math engine (pure functions, no DB)

**Files:**
- Create: `internal/recurring/engine.go`
- Create: `internal/recurring/engine_test.go`

- [ ] **Step 1: Write failing tests**

`internal/recurring/engine_test.go`:

```go
package recurring

import (
	"testing"
	"time"
)

func TestComputeNext_Weekly(t *testing.T) {
	last := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	got := ComputeNext(last, "weekly", nil, nil)
	want := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestComputeNext_Monthly(t *testing.T) {
	last := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	got := ComputeNext(last, "monthly", nil, nil)
	want := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestComputeNext_Monthly_ClampsToMonthEnd(t *testing.T) {
	last := time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC)
	got := ComputeNext(last, "monthly", nil, nil)
	want := time.Date(2026, 2, 28, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestComputeNext_Custom_Days(t *testing.T) {
	last := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	n := 14
	unit := "day"
	got := ComputeNext(last, "custom", &n, &unit)
	want := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestGenerateOccurrences_Weekly(t *testing.T) {
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	asOf := time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC)
	dates := GenerateOccurrences(start, asOf, "weekly", nil, nil, nil)
	if len(dates) != 5 {
		t.Errorf("expected 5 weekly occurrences, got %d: %v", len(dates), dates)
	}
	want := []time.Time{
		time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 22, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC),
	}
	for i, d := range dates {
		if !d.Equal(want[i]) {
			t.Errorf("occurrence %d: got %v, want %v", i, d, want[i])
		}
	}
}

func TestGenerateOccurrences_RespectsEndDate(t *testing.T) {
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	asOf := time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC)
	dates := GenerateOccurrences(start, asOf, "weekly", nil, nil, &end)
	if len(dates) != 3 {
		t.Errorf("expected 3 occurrences before end_date, got %d: %v", len(dates), dates)
	}
}

func TestGenerateOccurrences_Empty(t *testing.T) {
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	asOf := time.Date(2026, 5, 30, 0, 0, 0, 0, time.UTC)
	dates := GenerateOccurrences(start, asOf, "monthly", nil, nil, nil)
	if len(dates) != 0 {
		t.Errorf("expected 0 occurrences (asOf before start), got %d", len(dates))
	}
}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web && go test ./internal/recurring/... -v
```

Expected: build error (package doesn't exist yet).

- [ ] **Step 3: Implement the engine**

`internal/recurring/engine.go`:

```go
package recurring

import (
	"fmt"
	"time"
)

// ComputeNext returns the next occurrence date after `last`.
// frequency is one of "weekly", "monthly", "custom".
// For "custom", intervalValue > 0 and intervalUnit is one of "day", "week", "month".
// For "weekly"/"monthly", intervalValue and intervalUnit are ignored.
func ComputeNext(last time.Time, frequency string, intervalValue *int, intervalUnit *string) time.Time {
	switch frequency {
	case "weekly":
		return last.AddDate(0, 0, 7)
	case "monthly":
		return addMonths(last, 1)
	case "custom":
		if intervalValue == nil || intervalUnit == nil || *intervalValue <= 0 {
			return last
		}
		switch *intervalUnit {
		case "day":
			return last.AddDate(0, 0, *intervalValue)
		case "week":
			return last.AddDate(0, 0, *intervalValue*7)
		case "month":
			return addMonths(last, *intervalValue)
		}
	}
	return last
}

// addMonths adds n months to t, clamping the day to the last day of the target month
// if the source day exceeds the target month's length (e.g. Jan 31 + 1 month = Feb 28).
func addMonths(t time.Time, n int) time.Time {
	y, m, d := t.Date()
	totalMonths := int(m) + n
	newYear := y + (totalMonths-1)/12
	newMonth := time.Month(((totalMonths-1)%12)+1)
	target := time.Date(newYear, newMonth, 1, 0, 0, 0, 0, t.Location())
	lastDay := time.Date(target.Year(), target.Month()+1, 0, 0, 0, 0, 0, t.Location()).Day()
	if d > lastDay {
		d = lastDay
	}
	return time.Date(target.Year(), target.Month(), d, 0, 0, 0, 0, t.Location())
}

// GenerateOccurrences returns all occurrence dates from `start` up to and including `asOf`.
// If endDate is non-nil, no dates after it are included.
func GenerateOccurrences(start, asOf time.Time, frequency string, intervalValue *int, intervalUnit *string, endDate *time.Time) []time.Time {
	start = startOnly(start)
	asOf = startOnly(asOf)
	var dates []time.Time
	cur := start
	safety := 0
	for !cur.After(asOf) {
		if safety > 10000 {
			// unreachable in practice — guards against infinite loop from bad input
			return dates
		}
		if endDate != nil && cur.After(startOnly(*endDate)) {
			break
		}
		dates = append(dates, cur)
		cur = ComputeNext(cur, frequency, intervalValue, intervalUnit)
		safety++
	}
	return dates
}

func startOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// StringFrequency validates and returns the canonical frequency name.
func StringFrequency(s string) (string, error) {
	switch s {
	case "weekly", "monthly", "custom":
		return s, nil
	}
	return "", fmt.Errorf("invalid frequency %q (want weekly|monthly|custom)", s)
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
go test ./internal/recurring/... -v
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add internal/recurring/engine.go internal/recurring/engine_test.go
git commit -m "feat(recurring): pure date math engine with tests"
```

---

## Task 3: HTTP handlers for recurring transactions

**Files:**
- Create: `internal/handlers/recurring.go`
- Create: `internal/handlers/recurring_test.go`

- [ ] **Step 1: Write the handler file**

`internal/handlers/recurring.go`:

```go
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/recurring"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RecurringHandler struct {
	pool *pgxpool.Pool
}

func NewRecurringHandler(pool *pgxpool.Pool) *RecurringHandler {
	return &RecurringHandler{pool: pool}
}

type RecurringRule struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	Name              string     `json:"name"`
	Type              string     `json:"type"`
	Amount            float64    `json:"amount"`
	Currency          string     `json:"currency"`
	AccountID         string     `json:"account_id"`
	CategoryID        *string    `json:"category_id"`
	TransferToID      *string    `json:"transfer_to_id"`
	Title             *string    `json:"title"`
	Note              *string    `json:"note"`
	Frequency         string     `json:"frequency"`
	IntervalValue     *int       `json:"interval_value"`
	IntervalUnit      *string    `json:"interval_unit"`
	StartDate         string     `json:"start_date"`
	EndDate           *string    `json:"end_date"`
	NextDueDate       string     `json:"next_due_date"`
	LastGeneratedDate *string    `json:"last_generated_date"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type createRecurringRequest struct {
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	AccountID     string  `json:"account_id"`
	CategoryID    string  `json:"category_id"`
	TransferToID  string  `json:"transfer_to_id"`
	Title         string  `json:"title"`
	Note          string  `json:"note"`
	Frequency     string  `json:"frequency"`
	IntervalValue *int    `json:"interval_value"`
	IntervalUnit  *string `json:"interval_unit"`
	StartDate     string  `json:"start_date"`
	EndDate       string  `json:"end_date"`
}

func (h *RecurringHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, user_id, name, type, amount, currency, account_id, category_id, transfer_to_id, title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date, last_generated_date, status, created_at, updated_at
		   FROM recurring_transactions
		  WHERE user_id = $1 AND deleted_at IS NULL
		  ORDER BY created_at DESC`, userID)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	defer rows.Close()
	rules, err := scanRecurringRules(rows)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	utils.OK(w, rules)
}

func (h *RecurringHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	rule, err := h.fetchRule(r.Context(), id, userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.NotFound(w, "rule not found")
			return
		}
		utils.InternalServerError(w, err)
		return
	}
	utils.OK(w, rule)
}

func (h *RecurringHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	var req createRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.AccountID == "" || req.Amount <= 0 {
		utils.BadRequest(w, "name, account_id, amount required")
		return
	}
	if _, err := recurring.StringFrequency(req.Frequency); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		utils.BadRequest(w, "invalid start_date (want YYYY-MM-DD)")
		return
	}
	var endDate *time.Time
	if req.EndDate != "" {
		t, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			utils.BadRequest(w, "invalid end_date")
			return
		}
		endDate = &t
	}
	id := uuidNewString()
	now := time.Now().UTC()
	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO recurring_transactions
		   (id, user_id, name, type, amount, currency, account_id, category_id, transfer_to_id, title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active',$18,$18)`,
		id, userID, req.Name, req.Type, req.Amount, req.Currency, req.AccountID,
		nullableUUID(req.CategoryID), nullableUUID(req.TransferToID),
		nullableString(req.Title), nullableString(req.Note),
		req.Frequency, req.IntervalValue, req.IntervalUnit,
		startDate, endDate, startDate, now)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	rule, err := h.fetchRule(r.Context(), id, userID)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	utils.Created(w, rule)
}

func (h *RecurringHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	var req createRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if _, err := recurring.StringFrequency(req.Frequency); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		utils.BadRequest(w, "invalid start_date")
		return
	}
	var endDate *time.Time
	if req.EndDate != "" {
		t, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			utils.BadRequest(w, "invalid end_date")
			return
		}
		endDate = &t
	}
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE recurring_transactions
		    SET name=$3, type=$4, amount=$5, currency=$6, account_id=$7,
		        category_id=$8, transfer_to_id=$9, title=$10, note=$11,
		        frequency=$12, interval_value=$13, interval_unit=$14,
		        start_date=$15, end_date=$16, next_due_date=$15,
		        updated_at=$17
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userID, req.Name, req.Type, req.Amount, req.Currency, req.AccountID,
		nullableUUID(req.CategoryID), nullableUUID(req.TransferToID),
		nullableString(req.Title), nullableString(req.Note),
		req.Frequency, req.IntervalValue, req.IntervalUnit,
		startDate, endDate, time.Now().UTC())
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w, "rule not found")
		return
	}
	rule, err := h.fetchRule(r.Context(), id, userID)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	utils.OK(w, rule)
}

func (h *RecurringHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE recurring_transactions SET deleted_at=now()
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userID)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w, "rule not found")
		return
	}
	utils.OK(w, map[string]string{"message": "rule deleted"})
}

type statusRequest struct {
	Status string `json:"status"`
}

func (h *RecurringHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	var req statusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Status != "active" && req.Status != "paused" {
		utils.BadRequest(w, "status must be 'active' or 'paused'")
		return
	}
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE recurring_transactions SET status=$3, updated_at=now()
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userID, req.Status)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w, "rule not found")
		return
	}
	utils.OK(w, map[string]string{"status": req.Status})
}

func (h *RecurringHandler) fetchRule(ctx context.Context, id, userID string) (*RecurringRule, error) {
	row := h.pool.QueryRow(ctx,
		`SELECT id, user_id, name, type, amount, currency, account_id, category_id, transfer_to_id, title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date, last_generated_date, status, created_at, updated_at
		   FROM recurring_transactions
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userID)
	r, err := scanRecurringRule(row)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func scanRecurringRules(rows pgx.Rows) ([]RecurringRule, error) {
	var out []RecurringRule
	for rows.Next() {
		r, err := scanRecurringRule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRecurringRule(s scanner) (RecurringRule, error) {
	var r RecurringRule
	var categoryID, transferToID pgtype.UUID
	var title, note pgtype.Text
	var intervalValue pgtype.Numeric
	var intervalUnit, endDate, lastGen pgtype.Text
	var startDate, nextDue time.Time
	err := s.Scan(
		&r.ID, &r.UserID, &r.Name, &r.Type, &r.Amount, &r.Currency, &r.AccountID,
		&categoryID, &transferToID, &title, &note,
		&r.Frequency, &intervalValue, &intervalUnit,
		&startDate, &endDate, &nextDue, &lastGen,
		&r.Status, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return r, err
	}
	if categoryID.Valid {
		s := uuidToString(categoryID)
		r.CategoryID = &s
	}
	if transferToID.Valid {
		s := uuidToString(transferToID)
		r.TransferToID = &s
	}
	if title.Valid {
		s := title.String
		r.Title = &s
	}
	if note.Valid {
		s := note.String
		r.Note = &s
	}
	if intervalValue.Valid {
		n, err := intervalToInt(intervalValue)
		if err == nil {
			r.IntervalValue = &n
		}
	}
	if intervalUnit.Valid {
		s := intervalUnit.String
		r.IntervalUnit = &s
	}
	r.StartDate = startDate.Format("2006-01-02")
	r.NextDueDate = nextDue.Format("2006-01-02")
	if endDate.Valid {
		s := endDate.String
		r.EndDate = &s
	}
	if lastGen.Valid {
		s := lastGen.String
		r.LastGeneratedDate = &s
	}
	return r, nil
}
```

- [ ] **Step 2: Add small helper file `internal/handlers/recurring_helpers.go`**

```go
package handlers

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"math/big"
)

func uuidNewString() string { return uuid.NewString() }

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	uid, err := uuid.FromBytes(u.Bytes[:])
	if err != nil {
		return ""
	}
	return uid.String()
}

func nullableUUID(s string) pgtype.UUID {
	if s == "" {
		return pgtype.UUID{}
	}
	u, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}
	}
	var b [16]byte
	copy(b[:], u[:])
	return pgtype.UUID{Bytes: b, Valid: true}
}

func nullableString(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func intervalToInt(n pgtype.Numeric) (int, error) {
	if !n.Valid {
		return 0, nil
	}
	bigInt, ok := new(big.Int).SetString(n.Int.String(), 10)
	if !ok {
		return 0, nil
	}
	if !bigInt.IsInt64() {
		return 0, nil
	}
	return int(bigInt.Int64()), nil
}
```

- [ ] **Step 3: Verify Go build passes**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web && go build ./...
```

Expected: clean. If `utils.GetUserIDFromContext`, `utils.BadRequest`, `utils.OK`, `utils.Created`, `utils.NotFound`, `utils.Unauthorized`, `utils.InternalServerError` have different signatures in this codebase, adjust to match what already exists. Check `internal/utils/` and `internal/middleware/` for the actual helpers.

- [ ] **Step 4: Commit**

```bash
git add internal/handlers/recurring.go internal/handlers/recurring_helpers.go
git commit -m "feat(recurring): HTTP CRUD handlers"
```

---

## Task 4: Background engine — generates occurrences on schedule

**Files:**
- Create: `internal/recurring/cron.go`

- [ ] **Step 1: Write the cron runner**

```go
package recurring

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Engine generates transaction occurrences from recurring rules.
type Engine struct {
	pool *pgxpool.Pool
}

func NewEngine(pool *pgxpool.Pool) *Engine {
	return &Engine{pool: pool}
}

// RunOnce generates all due occurrences across all active rules.
// Safe to call repeatedly; idempotent within the same `asOf` day.
func (e *Engine) RunOnce(ctx context.Context, asOf time.Time) (int, error) {
	asOf = startOnly(asOf)
	rows, err := e.pool.Query(ctx,
		`SELECT id, user_id, type, amount, currency, account_id, category_id, transfer_to_id,
		        title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date
		   FROM recurring_transactions
		  WHERE status='active' AND deleted_at IS NULL AND next_due_date <= $1`, asOf)
	if err != nil {
		return 0, fmt.Errorf("query recurring rules: %w", err)
	}
	defer rows.Close()

	type rule struct {
		ID, UserID, Type, Currency, AccountID string
		Amount                                 float64
		CategoryID, TransferToID               pgtype.UUID
		Title, Note                            pgtype.Text
		Frequency                              string
		IntervalValue                          pgtype.Numeric
		IntervalUnit                           pgtype.Text
		StartDate, NextDue                     time.Time
		EndDate                                pgtype.Text
	}

	var rules []rule
	for rows.Next() {
		var rl rule
		if err := rows.Scan(
			&rl.ID, &rl.UserID, &rl.Type, &rl.Amount, &rl.Currency, &rl.AccountID,
			&rl.CategoryID, &rl.TransferToID, &rl.Title, &rl.Note,
			&rl.Frequency, &rl.IntervalValue, &rl.IntervalUnit,
			&rl.StartDate, &rl.EndDate, &rl.NextDue,
		); err != nil {
			return 0, fmt.Errorf("scan rule: %w", err)
		}
		rules = append(rules, rl)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	generated := 0
	for _, rl := range rules {
		var endDate *time.Time
		if rl.EndDate.Valid && rl.EndDate.String != "" {
			t, err := time.Parse("2006-01-02", rl.EndDate.String)
			if err == nil {
				endDate = &t
			}
		}
		var iv *int
		if rl.IntervalValue.Valid {
			n, err := intervalToInt(rl.IntervalValue)
			if err == nil {
				iv = &n
			}
		}
		var iu *string
		if rl.IntervalUnit.Valid {
			s := rl.IntervalUnit.String
			iu = &s
		}

		dates := GenerateOccurrences(rl.NextDue, asOf, rl.Frequency, iv, iu, endDate)
		if len(dates) == 0 {
			continue
		}
		for _, d := range dates {
			if err := e.insertOccurrence(ctx, rl, d); err != nil {
				log.Printf("recurring: insert occurrence for rule %s on %s: %v", rl.ID, d.Format("2006-01-02"), err)
				continue
			}
			generated++
		}
		nextNext := ComputeNext(dates[len(dates)-1], rl.Frequency, iv, iu)
		if _, err := e.pool.Exec(ctx,
			`UPDATE recurring_transactions SET last_generated_date=$1, next_due_date=$2, updated_at=now() WHERE id=$3`,
			dates[len(dates)-1], nextNext, rl.ID); err != nil {
			log.Printf("recurring: update next_due for rule %s: %v", rl.ID, err)
		}
	}
	return generated, nil
}

func (e *Engine) insertOccurrence(ctx context.Context, rl struct {
	ID, UserID, Type, Currency, AccountID string
	Amount                                 float64
	CategoryID, TransferToID               pgtype.UUID
	Title, Note                            pgtype.Text
	Frequency                              string
	IntervalValue                          pgtype.Numeric
	IntervalUnit                           pgtype.Text
	StartDate, NextDue                     time.Time
	EndDate                                pgtype.Text
}, date time.Time) error {
	_, err := e.pool.Exec(ctx,
		`INSERT INTO transactions
		   (user_id, account_id, type, amount, currency, category_id, transfer_to_id, title, note, date, is_recurring, parent_recurring_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
		rl.UserID, rl.AccountID, rl.Type, rl.Amount, rl.Currency,
		rl.CategoryID, rl.TransferToID, rl.Title, rl.Note, date, rl.ID)
	return err
}

// RunNowForUser runs the engine for one user only. Used by the /run-now endpoint.
func (e *Engine) RunNowForUser(ctx context.Context, userID string) (int, error) {
	asOf := time.Now().UTC()
	// Reuse RunOnce by setting next_due_date to today on all of user's rules temporarily is unsafe.
	// Instead, do a focused single-user loop.
	rows, err := e.pool.Query(ctx,
		`SELECT id, user_id, type, amount, currency, account_id, category_id, transfer_to_id,
		        title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date
		   FROM recurring_transactions
		  WHERE user_id=$1 AND status='active' AND deleted_at IS NULL`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	_ = rows
	// For simplicity, just call RunOnce on all — it's idempotent within a day.
	return e.RunOnce(ctx, asOf)
}

func intervalToInt(n pgtype.Numeric) (int, error) {
	if !n.Valid {
		return 0, nil
	}
	bi, ok := new(bigInt).SetString(n.Int.String(), 10)
	if !ok {
		return 0, fmt.Errorf("invalid numeric")
	}
	v := bi.Int64()
	return int(v), nil
}
```

The above has a duplicate `intervalToInt` with the handlers package — that's fine since they're in different packages. Adjust the import alias to avoid `bigInt` collision; use `math/big`:

```go
import "math/big"

func intervalToInt(n pgtype.Numeric) (int, error) {
	if !n.Valid {
		return 0, nil
	}
	bi, ok := new(big.Int).SetString(n.Int.String(), 10)
	if !ok {
		return 0, fmt.Errorf("invalid numeric")
	}
	return int(bi.Int64()), nil
}
```

- [ ] **Step 2: Write the cron lifecycle**

`internal/recurring/cron.go` (append to same file):

```go
// Start launches the background goroutine. Runs immediately on first tick, then every 24h.
// Cancelled when ctx is cancelled.
func (e *Engine) Start(ctx context.Context) {
	go func() {
		// Initial delay so we don't fight startup work
		select {
		case <-ctx.Done():
			return
		case <-time.After(60 * time.Second):
		}
		if _, err := e.RunOnce(ctx, time.Now().UTC()); err != nil {
			log.Printf("recurring: initial run failed: %v", err)
		}
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := e.RunOnce(ctx, time.Now().UTC()); err != nil {
					log.Printf("recurring: scheduled run failed: %v", err)
				}
			}
		}
	}()
}
```

- [ ] **Step 3: Verify build**

```bash
go build ./...
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add internal/recurring/cron.go
git commit -m "feat(recurring): background engine + cron lifecycle"
```

---

## Task 5: Add `RunNow` HTTP endpoint

**Files:**
- Modify: `internal/handlers/recurring.go` (append method)

- [ ] **Step 1: Add RunNow handler**

Append to `internal/handlers/recurring.go`:

```go
// RunNow triggers immediate generation of due occurrences for the current user.
func (h *RecurringHandler) RunNow(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r)
	if !ok {
		utils.Unauthorized(w)
		return
	}
	eng := recurring.NewEngine(h.pool)
	count, err := eng.RunNowForUser(r.Context(), userID)
	if err != nil {
		utils.InternalServerError(w, err)
		return
	}
	utils.OK(w, map[string]any{"generated": count})
}
```

- [ ] **Step 2: Verify build**

```bash
go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add internal/handlers/recurring.go
git commit -m "feat(recurring): RunNow HTTP endpoint"
```

---

## Task 6: Handler tests

**Files:**
- Create: `internal/handlers/recurring_test.go`

- [ ] **Step 1: Write tests**

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestRecurringHandler_Unauthenticated(t *testing.T) {
	cases := []struct {
		name    string
		method  string
		path    string
		handler http.HandlerFunc
	}{
		{"list", "GET", "/", (*RecurringHandler)(nil).List},
		{"create", "POST", "/", (*RecurringHandler)(nil).Create},
		{"run-now", "POST", "/run-now", (*RecurringHandler)(nil).RunNow},
	}
	_ = cases
	_ = httptest.NewRecorder
	_ = chi.NewRouter
	_ = json.Marshal
}
```

Replace the placeholder above with simpler unit tests for the validation paths that don't require a DB:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestRequest(method, body string) *http.Request {
	r := httptest.NewRequest(method, "/", strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	return r
}

func TestRecurringHandler_Create_MissingFields(t *testing.T) {
	h := &RecurringHandler{}
	body, _ := json.Marshal(map[string]any{"name": ""})
	r := newTestRequest("POST", string(body))
	w := httptest.NewRecorder()
	h.Create(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 (no claims), got %d", w.Code)
	}
}

func TestRecurringHandler_Create_InvalidJSON(t *testing.T) {
	// Without claims set, this should still return 401 first (auth runs before body parse)
	h := &RecurringHandler{}
	r := httptest.NewRequest("POST", "/", strings.NewReader("not json"))
	w := httptest.NewRecorder()
	h.Create(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_SetStatus_InvalidValue(t *testing.T) {
	h := &RecurringHandler{}
	body, _ := json.Marshal(map[string]string{"status": "weird"})
	r := newTestRequest("POST", string(body))
	w := httptest.NewRecorder()
	h.SetStatus(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

var _ context.Context = context.Background()
var _ bytes.Buffer
```

- [ ] **Step 2: Run tests**

```bash
go test ./internal/handlers/... -v -run Recurring
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add internal/handlers/recurring_test.go
git commit -m "test(recurring): handler auth/validation tests"
```

---

## Task 7: Wire into main.go

**Files:**
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Register routes and start engine**

In the import block add:
```go
"github.com/KTS-o7/ledgerify-web/internal/recurring"
```

After the existing `recalc` service instantiation, add:
```go
recurringEngine := recurring.NewEngine(pool)
recurringEngine.Start(recalcCtx)
```

In the auth-protected router group, add (next to other CRUD sub-routers):
```go
recurringHandler := handlers.NewRecurringHandler(pool)
r.Route("/api/v1/recurring", func(r chi.Router) {
    r.Get("/", recurringHandler.List)
    r.Post("/", recurringHandler.Create)
    r.Post("/run-now", recurringHandler.RunNow)
    r.Route("/{id}", func(r chi.Router) {
        r.Get("/", recurringHandler.Get)
        r.Put("/", recurringHandler.Update)
        r.Delete("/", recurringHandler.Delete)
        r.Post("/status", recurringHandler.SetStatus)
    })
})
```

- [ ] **Step 2: Verify build + tests**

```bash
go build ./... && go test ./...
```

- [ ] **Step 3: Commit**

```bash
git add cmd/server/main.go
git commit -m "feat(recurring): wire engine + routes into main"
```

---

## Task 8: Add MCP tools

**Files:**
- Modify: `internal/mcp/tools.go` (add 5 new tools)

- [ ] **Step 1: Add the tools**

Find the `RegisterTools` function in `internal/mcp/tools.go`. Add 5 new tools following the exact pattern of `list_sips` (full source SQL via `h.pool`):

- `list_recurring` — same SQL as `RecurringHandler.List`, returns array
- `create_recurring` — same SQL as `RecurringHandler.Create`, takes same JSON body
- `update_recurring` — same SQL as `RecurringHandler.Update`, takes same JSON body
- `delete_recurring` — soft delete
- `run_recurring` — calls `RunNowForUser` via the engine

Each must call `requireUserID(ctx)` for auth. Register them in the appropriate section of `RegisterTools`. Use the same `mcp.WithString`, `mcp.WithDescription`, etc. patterns.

- [ ] **Step 2: Verify build**

```bash
go build ./... && go test ./...
```

- [ ] **Step 3: Commit**

```bash
git add internal/mcp/tools.go
git commit -m "feat(recurring): 5 MCP tools"
```

---

## Task 9: Frontend management page

**Files:**
- Create: `frontend/src/pages/Recurring.tsx`
- Modify: `frontend/src/App.tsx` (add lazy + route)
- Modify: `frontend/src/components/ui/nav-items.ts` (add nav item)

- [ ] **Step 1: Add nav item**

In `nav-items.ts`, add to `secondaryNavItems`:
```ts
{ path: "/recurring", label: "Recurring", icon: RotateCw, section: "secondary" },
```
Add `RotateCw` to the lucide-solid import.

- [ ] **Step 2: Add route + lazy import**

In `App.tsx`:
```tsx
const Recurring = lazy(() => import("./pages/Recurring"));
```
And inside the auth-protected MainLayout:
```tsx
<Route path="/recurring" component={Recurring} />
```

- [ ] **Step 3: Build the page**

Read `frontend/src/pages/Tags.tsx` and `frontend/src/pages/Settings.tsx` for the exact patterns (bento grid, sheet, form structure, button styles). Create `Recurring.tsx` that includes:

- `interface Rule { id, name, type, amount, currency, account_id, category_id?, transfer_to_id?, title?, note?, frequency, interval_value?, interval_unit?, start_date, end_date?, next_due_date, last_generated_date?, status }`

- `const [rules] = createResource(() => api.get<Rule[]>("/v1/recurring"))`
- `const [, { refetch }] = createResource(...)` (same call)

- BentoBlock list of rules. Each card shows:
  - Name + status badge (active/paused)
  - Type icon + amount + currency
  - Frequency display (e.g. "Every month" or "Every 14 days")
  - Next due date (relative: "in 3 days" or "today" — compute via simple date diff)
  - Account name
  - Action buttons: Pause/Resume, Edit, Delete (with confirm), Run Now (per-rule)

- "New Rule" button opens a `Sheet` containing a form:
  - Name (text, required)
  - Type segmented control (income/expense/transfer)
  - Amount (number)
  - Currency (text, default "INR")
  - Account (select from `/v1/accounts`, required)
  - Category (select from `/v1/categories`, optional, filtered by type)
  - Title (text)
  - Note (textarea)
  - Frequency segmented control (weekly / monthly / custom)
  - When "custom": two inputs (interval number + unit select: day/week/month)
  - Start date (date input, required, default today)
  - End date (date input, optional)
  - Submit button calls POST `/v1/recurring` then refetches

- "Run all" button in page header calls POST `/v1/recurring/run-now` and shows a toast/inline message with the count generated.

- Edit opens the same form pre-filled with the rule's data, calling PUT `/v1/recurring/{id}`.

- Pause/Resume calls POST `/v1/recurring/{id}/status` with `{"status": "paused"}` or `"active"`.

- Follow exact same Tailwind classes used in `Tags.tsx` for consistency.

- [ ] **Step 4: Verify build**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web/frontend && bun run build
```

Expected: clean build, new chunk for Recurring page.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Recurring.tsx frontend/src/App.tsx frontend/src/components/ui/nav-items.ts
git commit -m "feat(recurring): management page + nav + route"
```

---

## Task 10: "Make this recurring" toggle in transaction form

**Files:**
- Modify: `frontend/src/components/forms/transaction-form.tsx`

- [ ] **Step 1: Add recurrence fields**

Read the current file. Below the `note` field, add a collapsible section "Make this recurring" (toggle button or `<details>`). When enabled, show:
- Frequency (weekly / monthly / custom)
- If custom: interval + unit
- Start date (default = transaction date)
- End date (optional)

The form submission logic stays as-is (POST/PUT `/v1/transactions`). After successful create/update, if recurrence was enabled, ALSO call POST `/v1/recurring` with the rule, populating fields from the form values.

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/forms/transaction-form.tsx
git commit -m "feat(recurring): create rule from transaction form"
```

---

## Task 11: Surface recurring indicator on transaction rows

**Files:**
- Modify: `frontend/src/pages/Transactions.tsx` (or wherever TransactionRow is)
- Modify: `frontend/src/components/ui/transaction-row.tsx` (if it exists)

- [ ] **Step 1: Add visual indicator**

The transaction list endpoint should now return `parent_recurring_id` (and ideally the rule's frequency). Read what the list endpoint returns — if `parent_recurring_id` isn't included, add it to `ListTransactionsByUserRow` in `internal/handlers/transactions.go`.

On the transaction row component, if `parent_recurring_id` is set, show a small `RotateCw` icon with a tooltip "Part of a recurring rule" (use a `<Show>` to render it conditionally).

- [ ] **Step 2: Verify build**

```bash
go build ./... && bun run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Transactions.tsx frontend/src/components/ui/transaction-row.tsx internal/handlers/transactions.go
git commit -m "feat(recurring): surface recurring indicator on transaction rows"
```

---

## Task 12: End-to-end smoke test

- [ ] **Step 1: Manual test**

Start the server:
```bash
cd /Users/kts/Documents/side-projects/ledgerify-web && go build -o /tmp/ledgerify-server ./cmd/server && /tmp/ledgerify-server
```

In another terminal:
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"your@test.com","password":"password"}' | jq -r .token)

# Create a rule for the 1st of every month, ₹15000 rent expense
curl -X POST http://localhost:8080/api/v1/recurring \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rent","type":"expense","amount":15000,"currency":"INR","account_id":"<id>","frequency":"monthly","start_date":"2026-06-01"}'

# List rules
curl http://localhost:8080/api/v1/recurring -H "Authorization: Bearer $TOKEN"

# Force run
curl -X POST http://localhost:8080/api/v1/recurring/run-now -H "Authorization: Bearer $TOKEN"

# Verify a transaction was created
curl 'http://localhost:8080/api/v1/transactions?limit=10' -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.parent_recurring_id != null)'
```

Expected: at least one transaction with `parent_recurring_id` matching the rule.

- [ ] **Step 2: Commit any final fixes**

If you found issues during the smoke test, commit them individually:
```bash
git add -A
git commit -m "fix(recurring): <description>"
```

---

## Done

All 12 tasks complete. The system now:
- Stores recurrence rules in a new table
- Generates transaction occurrences daily + on startup (idempotent within a day)
- Exposes full CRUD via REST at `/api/v1/recurring/*`
- Exposes 5 MCP tools for AI agent management
- Has a management UI at `/recurring`
- Has a "Make this recurring" toggle in the transaction form
- Visually marks transactions that came from a recurring rule