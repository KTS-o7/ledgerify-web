# AI Categorization QoL — Design Spec

**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** Auto-categorize on import + re-categorize buttons in Settings

---

## Problem

1. CSV import inserts transactions with `category_id = null` when the category name in the file doesn't exactly match an existing category. The user has to manually run `/categorise` or edit each transaction.
2. Transactions created before the LLM was working (or with the old broken prompt) are stuck uncategorized or wrongly categorized with no easy recovery path.

---

## Solution Overview

Three targeted changes:

1. **Backend:** Add `?force=true` to `POST /api/v1/transactions/categorise` to bypass the existing-category skip.
2. **Backend:** After CSV import, auto-run keyword→LLM categorization on all newly inserted uncategorized transactions. Report count in response.
3. **Frontend:** Add two buttons to the Settings page Data block with live progress feedback.

---

## Backend: `?force=true` on `/categorise`

**File:** `internal/handlers/import_export.go`

**Change:** In the `Categorise` handler, read `r.URL.Query().Get("force")`. When `force == "true"`, remove the early-continue guard that skips transactions with an existing `category_id`. All other logic (keyword pass first, LLM pass second, one transaction at a time) remains identical.

**Behaviour:**
- `POST /api/v1/transactions/categorise` — existing behaviour, skips already-categorized
- `POST /api/v1/transactions/categorise?force=true` — processes all, overwrites existing categories

---

## Backend: Auto-categorize after import

**File:** `internal/handlers/import_export.go` — `Import` handler

**Change:** After the existing CSV insert loop completes, collect the UUIDs of all successfully inserted transactions that have `category_id = null`. Run them through the same keyword→LLM pipeline used in `Categorise` (extract the shared logic into a private helper `categoriseTransactions(ctx, userID, txIDs, force)`). Both `Categorise` and `Import` call this helper.

**Response shape change:**
```json
{ "imported": 5, "skipped": 1, "categorised": 4, "errors": [] }
```
`categorised` is new — count of transactions that got a category assigned post-import.

**Context window safety:** Transactions are processed one at a time. Each LLM call only carries: the system prompt (category list, ~500 tokens) + one transaction title (~10 tokens). Well within the 6k limit.

---

## Frontend: Settings page buttons

**File:** `frontend/src/pages/Settings.tsx`

### "Fix uncategorized" button

1. Fetch `GET /api/v1/transactions?limit=500` (no pagination needed for personal use scale).
2. Filter to transactions where `category_id === null`.
3. If none found: show toast "All transactions are categorized."
4. Otherwise: send them one at a time to `POST /api/v1/transactions/categorise` with `{ transaction_ids: [id] }`.
5. Show live progress: `Categorizing 3 / 12…`
6. On completion: `Done. 11 categorized, 1 skipped.`

### "Re-categorize all" button

1. Show confirm dialog: `"This will overwrite all existing categories using AI. Continue?"`
2. On confirm: fetch all transactions (same `?limit=500`).
3. Send one at a time to `POST /api/v1/transactions/categorise?force=true` with `{ transaction_ids: [id] }`.
4. Same live progress counter.
5. On completion: `Done. N categorized.`

### Progress state shape (local signal)
```ts
type CategorizingState = {
  mode: "fix" | "all" | null;
  total: number;
  done: number;
  categorised: number;
};
```

### UX notes
- Both buttons disabled while the other is running.
- No spinner — the live counter `3 / 12` is sufficient feedback.
- Errors on individual transactions are silently skipped (same as existing `/categorise` behaviour).
- Placed in the existing **Data** block in Settings, below the Import/Export links.

---

## Shared helper refactor

Extract `categoriseTransactions` from the `Categorise` handler into a private method on `ImportExportHandler`:

```go
func (h *ImportExportHandler) categoriseTransactions(
    ctx context.Context,
    userID pgtype.UUID,
    txIDs []string,
    force bool,
) (categorised int, categoryMap map[string]string, err error)
```

Both `Categorise` (HTTP handler) and `Import` call this. Keeps logic in one place.

---

## What is NOT changing

- The async `llmQueue` background categorization on new manual transactions — untouched.
- The keyword rules system — still runs as the first pass before LLM in both flows.
- The LLM prompt — already optimized in `cb2157e`.
- Pagination on `/transactions` — `?limit=500` is sufficient for a personal finance app; no user will have more than a few hundred transactions.

---

## Files changed

| File | Change |
|------|--------|
| `internal/handlers/import_export.go` | Add `force` param, extract helper, call helper after import |
| `frontend/src/pages/Settings.tsx` | Add two buttons with progress state |

No new routes, no DB migrations, no new dependencies.
