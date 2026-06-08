# AI Categorization QoL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `?force=true` to `/categorise`, auto-categorize after import, and add two re-categorize buttons to the Settings page with live progress.

**Architecture:** Backend — extract shared `categoriseTransactions` helper used by both `Categorise` handler and `Import` handler. Frontend — two new buttons in Settings with local signal progress state, calling `/categorise` one transaction at a time.

**Tech Stack:** Go (chi, pgx), SolidJS, Tailwind v4

---

## Files changed

| File | Change |
|------|--------|
| `internal/handlers/import_export.go` | Extract `categoriseTransactions` helper, add `force` param, call helper after import |
| `frontend/src/pages/Settings.tsx` | Add two categorization buttons with progress state |

---

## Task 1: Extract `categoriseTransactions` helper + add `force` param

**Files:**
- Modify: `internal/handlers/import_export.go`

- [ ] **Step 1: Add the helper method**

Replace the body of `Categorise` with a call to a new private helper. Add this method to `ImportExportHandler` (insert before the `numericToString` function at line 385):

```go
// categoriseTransactions runs keyword-match then LLM categorization on the
// given transaction IDs for the given user. When force=true, transactions that
// already have a category are re-categorized (existing category overwritten).
// Returns count categorized and a map of txID → category name.
func (h *ImportExportHandler) categoriseTransactions(
	ctx context.Context,
	userID pgtype.UUID,
	txIDs []string,
	force bool,
	mode string,
) (int, map[string]string, error) {
	keywords, err := h.q.ListCategoryKeywordsByUser(ctx, userID)
	if err != nil {
		return 0, nil, err
	}
	categories, err := h.q.ListCategoriesByUser(ctx, userID)
	if err != nil {
		return 0, nil, err
	}

	categorised := 0
	categoryMap := make(map[string]string)
	var unmatched []string

	for _, txID := range txIDs {
		txUUID := stringToUUID(txID)
		tx, err := h.q.GetTransactionByID(ctx, txUUID)
		if err != nil {
			continue
		}
		if tx.UserID.Bytes != userID.Bytes {
			continue
		}
		if tx.CategoryID.Valid && !force {
			categorised++
			continue
		}

		matched := false
		for _, kw := range keywords {
			if strings.Contains(strings.ToLower(tx.Title.String), strings.ToLower(kw.Keyword)) {
				_, err := h.pool.Exec(ctx, "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3", kw.CategoryID, tx.ID, userID)
				if err == nil {
					categoryMap[txID] = kw.CategoryName
					categorised++
				}
				matched = true
				break
			}
		}

		if !matched && mode != "keyword" {
			unmatched = append(unmatched, txID)
		}
	}

	if mode != "keyword" && h.llm != nil && len(unmatched) > 0 {
		llmCategories := make([]llm.Category, len(categories))
		for i, cat := range categories {
			llmCategories[i] = llm.Category{
				ID:   uuidToString(cat.ID),
				Name: cat.Name,
			}
		}

		for _, txID := range unmatched {
			txUUID := stringToUUID(txID)
			tx, err := h.q.GetTransactionByID(ctx, txUUID)
			if err != nil {
				continue
			}
			if tx.Title.String == "" {
				continue
			}

			categoryName, err := h.llm.Categorize(ctx, tx.Title.String, llmCategories)
			if err != nil || categoryName == "" {
				continue
			}

			updateSQL := "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3 AND category_id IS NULL"
			if force {
				updateSQL = "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3"
			}
			for _, cat := range categories {
				if cat.Name == categoryName {
					_, err := h.pool.Exec(ctx, updateSQL, cat.ID, tx.ID, userID)
					if err == nil {
						categoryMap[txID] = categoryName
						categorised++
					}
					break
				}
			}
		}
	}

	return categorised, categoryMap, nil
}
```

- [ ] **Step 2: Replace the `Categorise` handler body to use the helper**

Replace the entire `Categorise` function (lines 276–383) with:

```go
func (h *ImportExportHandler) Categorise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	var req struct {
		TransactionIDs []string `json:"transaction_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}

	mode := r.URL.Query().Get("mode")
	force := r.URL.Query().Get("force") == "true"

	categorised, categoryMap, err := h.categoriseTransactions(r.Context(), userID, req.TransactionIDs, force, mode)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, CategoriseResponse{
		Categorised: categorised,
		Categories:  categoryMap,
	})
}
```

- [ ] **Step 3: Add `context` import**

The helper uses `context.Context`. Add `"context"` to the import block at the top of the file:

```go
import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/llm"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
go build -o /tmp/ledgerify-server ./cmd/server
```

Expected: no output (clean build).

- [ ] **Step 5: Commit**

```bash
git add internal/handlers/import_export.go
git commit -m "refactor(categorise): extract helper + add force=true param"
```

---

## Task 2: Auto-categorize after import

**Files:**
- Modify: `internal/handlers/import_export.go`

- [ ] **Step 1: Update `ImportStats` to include categorised count**

Replace the `ImportStats` struct (line 29):

```go
type ImportStats struct {
	Imported    int      `json:"imported"`
	Skipped     int      `json:"skipped"`
	Categorised int      `json:"categorised"`
	Errors      []string `json:"errors,omitempty"`
}
```

- [ ] **Step 2: Collect inserted transaction IDs during import loop**

In the `Import` handler, add a `var insertedIDs []string` slice before the row loop, and append each successfully inserted transaction's ID after the `stats.Imported++` line.

The import loop currently ends at line 193–196. Change that section from:

```go
		if err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: failed to create transaction: %v", i+2, err))
			continue
		}
		stats.Imported++
	}

	utils.Created(w, stats)
}
```

To:

```go
		if err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: failed to create transaction: %v", i+2, err))
			continue
		}
		stats.Imported++
		// Only queue for categorization if no category was resolved from the CSV
		if !categoryID.Valid {
			insertedIDs = append(insertedIDs, uuidToString(newTx.ID))
		}
	}

	// Auto-categorize transactions that had no category in the CSV
	if len(insertedIDs) > 0 {
		categorised, _, _ := h.categoriseTransactions(r.Context(), userID, insertedIDs, false, "")
		stats.Categorised = categorised
	}

	utils.Created(w, stats)
}
```

- [ ] **Step 3: Capture the created transaction ID**

The existing `CreateTransaction` call discards the return value with `_`. Change it to capture `newTx`:

```go
		newTx, err := h.q.CreateTransaction(r.Context(), db.CreateTransactionParams{
			UserID:          userID,
			AccountID:       accountID,
			Type:            txTypeEnum,
			Amount:          amount,
			Currency:        txCurrency,
			CategoryID:      categoryID,
			Title:           pgtype.Text{String: title, Valid: true},
			Note:            pgtype.Text{String: record["note"], Valid: record["note"] != ""},
			Date:            txDate,
			IsRecurring:     false,
			ConvertedAmount: pgtype.Numeric{},
			BaseCurrency:    pgtype.Text{},
		})
```

Also add `var insertedIDs []string` just before the `for i, row := range records[1:]` loop (around line 87).

- [ ] **Step 4: Build and verify**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
go build -o /tmp/ledgerify-server ./cmd/server
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add internal/handlers/import_export.go
git commit -m "feat(import): auto-categorize uncategorized transactions after CSV import"
```

---

## Task 3: Settings page — two categorization buttons

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add categorization state and helper function**

After the existing `createSignal` declarations (around line 42), add:

```ts
  // Categorization state
  type CatState = { mode: "fix" | "all" | null; total: number; done: number; categorised: number };
  const [catState, setCatState] = createSignal<CatState>({ mode: null, total: 0, done: 0, categorised: 0 });

  async function runCategorization(mode: "fix" | "all") {
    // Fetch all transactions
    const txns = await api.get<Array<{ id: string; category_id: string | null }>>("/v1/transactions?limit=500");
    const targets = mode === "fix"
      ? txns.filter((t) => !t.category_id)
      : txns;

    if (targets.length === 0) {
      alert("All transactions are already categorized.");
      return;
    }

    setCatState({ mode, total: targets.length, done: 0, categorised: 0 });
    const force = mode === "all" ? "?force=true" : "";
    let totalCategorised = 0;

    for (let i = 0; i < targets.length; i++) {
      try {
        const res = await api.post<{ categorised: number }>(`/v1/transactions/categorise${force}`, {
          transaction_ids: [targets[i].id],
        });
        totalCategorised += res.categorised;
      } catch {
        // silently skip failed transactions
      }
      setCatState({ mode, total: targets.length, done: i + 1, categorised: totalCategorised });
    }

    // Small delay so user can read the final count before reset
    setTimeout(() => setCatState({ mode: null, total: 0, done: 0, categorised: 0 }), 3000);
  }

  async function handleFixUncategorized() {
    await runCategorization("fix");
  }

  async function handleRecategorizeAll() {
    if (!confirm("This will overwrite all existing categories using AI. Continue?")) return;
    await runCategorization("all");
  }
```

- [ ] **Step 2: Add Sparkles icon import**

Add `Sparkles` to the lucide-solid import at line 3:

```ts
import { ChevronRight, LogOut, Trash2, FileDown, FileUp, KeyRound, Mail, Globe, Calendar, Sparkles } from "lucide-solid";
```

- [ ] **Step 3: Add the two buttons to the Data block**

The Data block currently contains three `<Row>` components (Export, Import, Delete account). Add two new rows before the Delete row, and add a progress label that appears while running:

Replace the Data block (lines 132–137):

```tsx
        {/* Right column */}
        <BentoBlock>
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Data</span>
          <Row icon={FileDown} label="Export all data" onClick={() => navigate("/export")} />
          <Row icon={FileUp} label="Import" onClick={() => navigate("/import")} />
          <Row
            icon={Sparkles}
            label={
              catState().mode === "fix"
                ? `Categorizing ${catState().done} / ${catState().total}…`
                : catState().mode === null && catState().total === 0 && catState().categorised > 0
                ? `Done. ${catState().categorised} categorized.`
                : "Fix uncategorized"
            }
            onClick={catState().mode === null ? handleFixUncategorized : undefined}
          />
          <Row
            icon={Sparkles}
            label={
              catState().mode === "all"
                ? `Re-categorizing ${catState().done} / ${catState().total}…`
                : "Re-categorize all"
            }
            onClick={catState().mode === null ? handleRecategorizeAll : undefined}
          />
          <Row icon={Trash2} label="Delete account" danger onClick={handleDeleteAccount} />
        </BentoBlock>
```

- [ ] **Step 4: Build frontend and verify**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web/frontend
bun run build
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): add Fix Uncategorized and Re-categorize All buttons"
```

---

## Task 4: Final build check + push

- [ ] **Step 1: Full backend build**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
go build -o /tmp/ledgerify-server ./cmd/server
go test ./...
```

Expected: all pass, no errors.

- [ ] **Step 2: Full frontend build**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web/frontend
bun run build
```

Expected: `✓ built in X.XXs`.

- [ ] **Step 3: Push**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
git push origin main
```
