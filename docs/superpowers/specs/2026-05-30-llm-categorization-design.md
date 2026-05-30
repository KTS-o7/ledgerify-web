# LLM-Powered Transaction Categorization

## Problem

Current categorization uses `strings.Contains` keyword matching (`import_export.go:274-329`). This misses many real-world transaction titles (e.g. "AMZN MKTP", "Zomato order", "UBER TRIP 12.45"). Better categorization feeds richer reports, category breakdowns, and cash flow charts.

## Solution

Hybrid system: keyword match first (fast, zero-cost), then LLM fallback for uncategorized transactions. Additionally, a background queue auto-categorizes new transactions created without a category, feeding richer data into reports from day one.

## Architecture — Batch Categorise

```
Categorise Request
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  Mode param?  │────▶│ keyword-only │──▶ return keyword results only
└──────────────┘     └──────────────┘
       │ (default)
       ▼
┌──────────────┐
│ Keyword pass  │──▶ matched? ──▶ save + add to results
└──────────────┘
       │ unmatched
       ▼
┌──────────────┐
│  LLM fallback │──▶ save + add to results
│ (5 concurrent │
│  max, 5s ctx) │
└──────────────┘
       │
       ▼
  Return results
```

## Response Shape Change

**Before:**
```json
{ "categorised": 5, "categories": { "uber": "Transportation" } }
```

**After:**
```json
{ "categorised": 5, "categories": { "tx-uuid-1": "Transportation", "tx-uuid-2": "Groceries" } }
```

Keys become transaction IDs, values are category names. Covers both keyword and LLM matches uniformly.

## Architecture — Auto-Categorize on Creation

When a transaction is created (form or API) without a category, enqueue it for async LLM categorization:

```
Transaction created (no category)
       │
       ▼
┌──────────────┐
│  Enqueue(tx)  │──▶ buffered channel (cap 100)
└──────────────┘
       │
       ▼
┌──────────────┐
│  Worker pool  │──▶ N goroutines, each:
│  (default 3)  │    1. Fetch user's categories from DB
│               │    2. Call LLM Categorize()
│               │    3. UPDATE transactions SET category_id = $1
└──────────────┘
```

- **Non-blocking:** enqueue returns immediately, creation response is fast
- **Graceful shutdown:** drain channel on server stop
- **Configurable:** `LLM_WORKERS` env var (default 3), `LLM_QUEUE_SIZE` (default 100)
- **Drops silently:** if queue is full, transaction stays uncategorized (no error to caller)
- **`LLM_API_URL=""` disables LLM entirely** — queue is a no-op

## Files to Modify

| File | Change |
|------|--------|
| `internal/llm/client.go` | **New file.** `Client` struct with `NewClient(cfg)`, single `Categorize(ctx, title, categories []Category) (string, error)` method. `net/http` only, no SDK. 5s timeout per call. |
| `internal/llm/queue.go` | **New file.** `Queue` struct with buffered channel + worker pool. `Enqueue(txID, userID)` non-blocking. Workers fetch categories, call LLM, update DB. `Shutdown()` drains gracefully. |
| `internal/auth/config.go` | Add `LLMAPIURL`, `LLMAPIKey`, `LLMModel`, `LLMUserAgent`, `LLMWorkers`, `LLMQueueSize` fields. Load from env vars with defaults. |
| `internal/handlers/import_export.go` | Add `llm *llm.Client` to `ImportExportHandler`. Update constructor. In `Categorise()`: fetch categories list for LLM prompt, keep keyword loop first, batch LLM calls for unmatched (semaphore, max 5 concurrent). Support `?mode=keyword` query param. |
| `internal/handlers/transactions.go` | Add `llmQueue *llm.Queue` to `TransactionHandler`. In create handlers (form + API): if `category_id` is blank, enqueue to LLM queue. |
| `cmd/server/main.go` | Create `llm.Client`, `llm.Queue`, pass to both handlers. Call `queue.Shutdown()` on server stop. |

## LLM Client (`internal/llm/client.go`)

- **Struct:** `Client` with `baseURL`, `apiKey`, `userAgent`, `model`, `httpClient`
- **Constructor:** `NewClient(cfg *auth.Config) *Client`
- **Method:** `Categorize(ctx context.Context, title string, categories []Category) (string, error)`
  - `Category` is `{ID string, Name string}`
  - Builds messages array with system + user prompts
  - Sends POST to `{baseURL}/v1/chat/completions`
  - Request body: `{"model": "...", "messages": [...], "temperature": 0}`
  - Response parsing: `choices[0].message.content` → parse as `{"category": "..."}`
  - Returns category name or `""` on failure (never panics)
  - 5s timeout per call (context-based)

## Prompt Design

**System prompt (role/persona priming, +6.3pp accuracy):**
```
You are a precise financial transaction categorizer. Your accuracy directly impacts someone's financial records — mistakes cause real confusion. Given a transaction title and a list of available categories, return the single best-matching category name. If no category fits, return "Uncategorized".

Available categories:
{json list of user's categories as [{"id": "...", "name": "..."}]}
```

**User prompt:**
```
Title: "UBER TRIP 12.45"
```

**Expected output:**
```json
{"category": "Transportation"}
```

Explicit JSON in prompt because `response_format: {"type": "json_object"}` is silently ignored by this API.

## Categorise Handler Flow

1. Auth check (existing)
2. Decode request body (existing) + read `?mode=` query param
3. If `mode=keyword`: keyword-only pass → return results
4. Fetch categories list (`ListCategoriesByUser`) for LLM prompt
5. Fetch keywords (`ListCategoryKeywordsByUser`) for keyword pass
6. Keyword pass: iterate transactions, match via `strings.Contains`, save matches to DB
7. For remaining unmatched: batch LLM calls (semaphore, max 5 concurrent, 5s each)
8. Save LLM results to DB
9. Return `CategoriseResponse{Categorised, Categories map[txID]categoryName}`

## Transaction Creation Flow (Auto-Categorize)

Both form (`/transactions` POST) and API (`/api/v1/transactions` POST) handlers:

1. Create transaction as normal (existing logic)
2. If `category_id` was provided by user → done, return
3. If `category_id` is blank → `queue.Enqueue(txID, userID)`
4. Return immediately (transaction exists, category will appear async)

Queue worker flow:
1. Dequeue `(txID, userID)`
2. Fetch user's categories via `ListCategoriesByUser`
3. Fetch transaction title via `GetTransactionByID`
4. Call `llm.Categorize(ctx, title, categories)`
5. If result is non-empty: look up matching category_id, `UPDATE transactions SET category_id = $1 WHERE id = $2`

## API Details

- **Endpoint:** `POST https://ai.shenthar.me/v1/chat/completions`
- **Auth:** `Authorization: Bearer {key}`
- **Required header:** `User-Agent: curl/8.4.0` (403 without it)
- **Model:** `taalas-llama3.1-8b`
- **Temperature:** 0 (deterministic)
- **Known behaviors:** ~0.5s p50 latency, zero errors across 1k requests, `response_format` silently ignored, seed/logprobs/tools silently ignored

## Error Handling

- LLM client returns `""` on any error — handler treats it as uncategorized
- API down: keyword fallback works independently, LLM results are just skipped
- `LLM_API_URL=""` disables LLM entirely (env var opt-out)
- No crashes: every LLM call is wrapped in error recovery

## Testing

- Unit test for `Categorize()` with `httptest.Server` mocking the API
- Curl smoke test to verify API reachability before code changes
- Manual test: 10-20 known transaction titles → verify correct categories
- Benchmark: p50/p95 latency of LLM path vs keyword path
