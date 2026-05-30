# LLM Categorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace keyword-only transaction categorization with a hybrid system (keyword first, LLM fallback) and add async auto-categorization on transaction creation.

**Architecture:** Add `internal/llm/` package with an OpenAI-compatible HTTP client and a background worker queue. The batch categorise endpoint tries keywords first, then calls the LLM for unmatched transactions. New transactions without a category are enqueued for async LLM categorization.

**Tech Stack:** Go 1.26, `net/http`, `encoding/json`, `github.com/jackc/pgx/v5/pgtype`, env vars via `os.Getenv`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `internal/llm/client.go` | Create | LLM HTTP client, `Categorize()` method |
| `internal/llm/queue.go` | Create | Background worker queue, `Enqueue()` method |
| `internal/auth/config.go` | Modify | Add LLM env vars to Config |
| `internal/handlers/import_export.go` | Modify | LLM fallback in `Categorise()`, new response shape |
| `internal/handlers/transactions.go` | Modify | Enqueue to LLM on create when no category |
| `cmd/server/main.go` | Modify | Wire LLM client + queue |
| `internal/llm/client_test.go` | Create | Unit tests for LLM client |

---

## Task 1: Add LLM Config Fields

**Files:**
- Modify: `internal/auth/config.go:8-14,22-28`

- [ ] **Step 1: Add LLM fields to Config struct**

```go
// internal/auth/config.go
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	JWTIssuer   string
	FrontendURL string
	LLMAPIURL   string
	LLMAPIKey   string
	LLMModel    string
	LLMUserAgent string
	LLMWorkers  int
	LLMQueueSize int
}
```

- [ ] **Step 2: Load LLM env vars in LoadConfig**

```go
func LoadConfig() (*Config, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET environment variable is required")
	}

	workers := 3
	if w := os.Getenv("LLM_WORKERS"); w != "" {
		if parsed, err := strconv.Atoi(w); err == nil && parsed > 0 {
			workers = parsed
		}
	}
	queueSize := 100
	if qs := os.Getenv("LLM_QUEUE_SIZE"); qs != "" {
		if parsed, err := strconv.Atoi(qs); err == nil && parsed > 0 {
			queueSize = parsed
		}
	}

	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    jwtSecret,
		JWTIssuer:    getEnv("JWT_ISSUER", "ledgerify"),
		FrontendURL:  getEnv("FRONTEND_URL", "http://localhost:3000"),
		LLMAPIURL:    getEnv("LLM_API_URL", "https://ai.shenthar.me"),
		LLMAPIKey:    os.Getenv("LLM_API_KEY"),
		LLMModel:     getEnv("LLM_MODEL", "taalas-llama3.1-8b"),
		LLMUserAgent: getEnv("LLM_USER_AGENT", "curl/8.4.0"),
		LLMWorkers:   workers,
		LLMQueueSize: queueSize,
	}, nil
}
```

- [ ] **Step 3: Add `strconv` import**

Add `"strconv"` to the imports in `config.go`.

- [ ] **Step 4: Commit**

```bash
git add internal/auth/config.go
git commit -m "feat: add LLM config fields to auth.Config"
```

---

## Task 2: Create LLM Client

**Files:**
- Create: `internal/llm/client.go`
- Create: `internal/llm/client_test.go`

- [ ] **Step 1: Create the client file**

```go
// internal/llm/client.go
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Category struct {
	ID   string
	Name string
}

type Client struct {
	baseURL    string
	apiKey     string
	userAgent  string
	model      string
	httpClient *http.Client
}

func NewClient(baseURL, apiKey, model, userAgent string) *Client {
	return &Client{
		baseURL:   baseURL,
		apiKey:    apiKey,
		userAgent: userAgent,
		model:     model,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type categoryResponse struct {
	Category string `json:"category"`
}

func (c *Client) Categorize(ctx context.Context, title string, categories []Category) (string, error) {
	if c.apiKey == "" || c.baseURL == "" {
		return "", fmt.Errorf("llm client not configured")
	}

	categoryList := ""
	for i, cat := range categories {
		if i > 0 {
			categoryList += ", "
		}
		categoryList += fmt.Sprintf(`{"id": "%s", "name": "%s"}`, cat.ID, cat.Name)
	}

	systemPrompt := fmt.Sprintf(`You are a precise financial transaction categorizer. Your accuracy directly impacts someone's financial records — mistakes cause real confusion. Given a transaction title and a list of available categories, return the single best-matching category name. If no category fits, return "Uncategorized".

Available categories:
[%s]`, categoryList)

	userPrompt := fmt.Sprintf(`Title: "%s"`, title)

	reqBody := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/v1/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llm request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("llm returned %d: %s", resp.StatusCode, string(body))
	}

	var chatResp chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	content := chatResp.Choices[0].Message.Content
	var catResp categoryResponse
	if err := json.Unmarshal([]byte(content), &catResp); err != nil {
		return "", fmt.Errorf("parse category json: %w (content: %s)", err, content)
	}

	if catResp.Category == "Uncategorized" || catResp.Category == "" {
		return "", nil
	}

	return catResp.Category, nil
}
```

- [ ] **Step 2: Write unit test with httptest**

```go
// internal/llm/client_test.go
package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCategorize_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("expected Bearer test-key, got %s", r.Header.Get("Authorization"))
		}
		if r.Header.Get("User-Agent") != "curl/8.4.0" {
			t.Errorf("expected curl/8.4.0, got %s", r.Header.Get("User-Agent"))
		}

		resp := chatResponse{
			Choices: []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			}{
				{Message: struct {
					Content string `json:"content"`
				}{Content: `{"category": "Transportation"}`}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "test-model", "curl/8.4.0")
	categories := []Category{
		{ID: "1", Name: "Transportation"},
		{ID: "2", Name: "Groceries"},
	}

	result, err := client.Categorize(context.Background(), "UBER TRIP 12.45", categories)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "Transportation" {
		t.Errorf("expected Transportation, got %s", result)
	}
}

func TestCategorize_Uncategorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := chatResponse{
			Choices: []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			}{
				{Message: struct {
					Content string `json:"content"`
				}{Content: `{"category": "Uncategorized"}`}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "test-model", "curl/8.4.0")
	result, err := client.Categorize(context.Background(), "RANDOM TEXT", []Category{
		{ID: "1", Name: "Transportation"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "" {
		t.Errorf("expected empty string for Uncategorized, got %s", result)
	}
}

func TestCategorize_NotConfigured(t *testing.T) {
	client := NewClient("", "", "", "")
	_, err := client.Categorize(context.Background(), "test", nil)
	if err == nil {
		t.Error("expected error when not configured")
	}
}

func TestCategorize_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "test-model", "curl/8.4.0")
	_, err := client.Categorize(context.Background(), "test", nil)
	if err == nil {
		t.Error("expected error on server error")
	}
}
```

- [ ] **Step 3: Run tests**

```bash
go test ./internal/llm/ -v
```

Expected: All 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add internal/llm/client.go internal/llm/client_test.go
git commit -m "feat: add LLM client with Categorize method and tests"
```

---

## Task 3: Create Background Worker Queue

**Files:**
- Create: `internal/llm/queue.go`

- [ ] **Step 1: Create the queue file**

```go
// internal/llm/queue.go
package llm

import (
	"context"
	"log"
	"sync"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Transaction struct {
	ID       pgtype.UUID
	UserID   pgtype.UUID
	Title    pgtype.Text
	CategoryID pgtype.UUID
}

type QueueItem struct {
	TxID   pgtype.UUID
	UserID pgtype.UUID
}

type Queue struct {
	client   *Client
	pool     *pgxpool.Pool
	ch       chan QueueItem
	quit     chan struct{}
	wg       sync.WaitGroup
}

func NewQueue(client *Client, pool *pgxpool.Pool, queueSize, workers int) *Queue {
	q := &Queue{
		client: client,
		pool:   pool,
		ch:     make(chan QueueItem, queueSize),
		quit:   make(chan struct{}),
	}
	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.worker()
	}
	return q
}

func (q *Queue) Enqueue(txID, userID pgtype.UUID) {
	item := QueueItem{TxID: txID, UserID: userID}
	select {
	case q.ch <- item:
	default:
		log.Printf("llm queue full, dropping categorize for tx %s", txID.String())
	}
}

func (q *Queue) Shutdown() {
	close(q.quit)
	q.wg.Wait()
}

func (q *Queue) worker() {
	defer q.wg.Done()
	for {
		select {
		case item := <-q.ch:
			q.process(item)
		case <-q.quit:
			return
		}
	}
}

func (q *Queue) process(item QueueItem) {
	ctx := context.Background()

	tx, err := q.getTransaction(ctx, item.TxID)
	if err != nil {
		log.Printf("llm queue: get tx %s: %v", item.TxID, err)
		return
	}
	if tx.CategoryID.Valid {
		return
	}
	title := ""
	if tx.Title.Valid {
		title = tx.Title.String
	}
	if title == "" {
		return
	}

	categories, err := q.getCategories(ctx, item.UserID)
	if err != nil {
		log.Printf("llm queue: get categories for user %s: %v", item.UserID, err)
		return
	}

	categoryName, err := q.client.Categorize(ctx, title, categories)
	if err != nil {
		log.Printf("llm queue: categorize tx %s: %v", item.TxID, err)
		return
	}
	if categoryName == "" {
		return
	}

	for _, cat := range categories {
		if cat.Name == categoryName {
			_, err := q.pool.Exec(ctx,
				"UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3 AND category_id IS NULL",
				cat.ID, item.TxID, item.UserID)
			if err != nil {
				log.Printf("llm queue: update tx %s: %v", item.TxID, err)
			}
			return
		}
	}
}

func (q *Queue) getTransaction(ctx context.Context, txID pgtype.UUID) (Transaction, error) {
	var tx Transaction
	err := q.pool.QueryRow(ctx,
		"SELECT id, user_id, title, category_id FROM transactions WHERE id = $1 AND deleted_at IS NULL",
		txID).Scan(&tx.ID, &tx.UserID, &tx.Title, &tx.CategoryID)
	return tx, err
}

func (q *Queue) getCategories(ctx context.Context, userID pgtype.UUID) ([]Category, error) {
	rows, err := q.pool.Query(ctx,
		"SELECT id, name FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL ORDER BY name",
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var cat Category
		if err := rows.Scan(&cat.ID, &cat.Name); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}
	return categories, rows.Err()
}
```

- [ ] **Step 2: Commit**

```bash
git add internal/llm/queue.go
git commit -m "feat: add LLM background worker queue"
```

---

## Task 4: Modify Batch Categorise Handler

**Files:**
- Modify: `internal/handlers/import_export.go:18-25,274-329`

- [ ] **Step 1: Add llm client to handler struct**

```go
// internal/handlers/import_export.go
import "github.com/KTS-o7/ledgerify-web/internal/llm"

type ImportExportHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
	llm  *llm.Client
}

func NewImportExportHandler(pool *pgxpool.Pool, q *db.Queries, llmClient *llm.Client) *ImportExportHandler {
	return &ImportExportHandler{pool: pool, q: q, llm: llmClient}
}
```

- [ ] **Step 2: Change CategoriseResponse shape**

```go
type CategoriseResponse struct {
	Categorised int               `json:"categorised"`
	Categories  map[string]string `json:"categories,omitempty"`
}
```

Keep the struct the same — but change what's stored in `Categories` (transaction ID → category name instead of keyword → category name).

- [ ] **Step 3: Update Categorise handler with LLM fallback**

Replace the entire `Categorise` function:

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

	keywords, err := h.q.ListCategoryKeywordsByUser(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	categories, err := h.q.ListCategoriesByUser(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	categorised := 0
	categoryMap := make(map[string]string)
	var unmatched []string

	for _, txID := range req.TransactionIDs {
		txUUID := stringToUUID(txID)
		tx, err := h.q.GetTransactionByID(r.Context(), txUUID)
		if err != nil {
			continue
		}
		if tx.UserID.Bytes != userID.Bytes {
			continue
		}
		if tx.CategoryID.Valid {
			categorised++
			continue
		}

		matched := false
		for _, kw := range keywords {
			if strings.Contains(strings.ToLower(tx.Title.String), strings.ToLower(kw.Keyword)) {
				_, err := h.pool.Exec(r.Context(), "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3", kw.CategoryID, tx.ID, userID)
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
			tx, err := h.q.GetTransactionByID(r.Context(), txUUID)
			if err != nil {
				continue
			}
			if tx.Title.String == "" {
				continue
			}

			categoryName, err := h.llm.Categorize(r.Context(), tx.Title.String, llmCategories)
			if err != nil || categoryName == "" {
				continue
			}

			for _, cat := range categories {
				if cat.Name == categoryName {
					_, err := h.pool.Exec(r.Context(), "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3 AND category_id IS NULL", cat.ID, tx.ID, userID)
					if err == nil {
						categoryMap[txID] = categoryName
						categorised++
					}
					break
				}
			}
		}
	}

	utils.OK(w, CategoriseResponse{
		Categorised: categorised,
		Categories:  categoryMap,
	})
}
```

- [ ] **Step 4: Commit**

```bash
git add internal/handlers/import_export.go
git commit -m "feat: add LLM fallback to batch categorise endpoint"
```

---

## Task 5: Enqueue on Transaction Creation

**Files:**
- Modify: `internal/handlers/transactions.go` (Create method)

- [ ] **Step 1: Add llmQueue to TransactionHandler**

Read `internal/handlers/transactions.go` to find the struct and constructor. Add the queue field:

```go
type TransactionHandler struct {
	q       *db.Queries
	pool    *pgxpool.Pool
	llmQueue *llm.Queue
}

func NewTransactionHandler(q *db.Queries, pool *pgxpool.Pool, llmQueue *llm.Queue) *TransactionHandler {
	return &TransactionHandler{q: q, pool: pool, llmQueue: llmQueue}
}
```

- [ ] **Step 2: Add enqueue call after creation**

In the `Create` method, after `h.q.CreateTransaction()` succeeds and before returning the response, add:

```go
if req.CategoryID == "" && h.llmQueue != nil {
	h.llmQueue.Enqueue(transaction.ID, userID)
}
```

- [ ] **Step 3: Commit**

```bash
git add internal/handlers/transactions.go
git commit -m "feat: enqueue LLM categorization on transaction creation"
```

---

## Task 6: Wire Everything in main.go

**Files:**
- Modify: `cmd/server/main.go:1,18-23,43-67`

- [ ] **Step 1: Add llm import and create client + queue**

```go
import "github.com/KTS-o7/ledgerify-web/internal/llm"

// After pool setup:
var llmClient *llm.Client
if cfg.LLMAPIKey != "" {
	llmClient = llm.NewClient(cfg.LLMAPIURL, cfg.LLMAPIKey, cfg.LLMModel, cfg.LLMUserAgent)
	log.Println("llm client initialized")
}

var llmQueue *llm.Queue
if llmClient != nil {
	llmQueue = llm.NewQueue(llmClient, pool, cfg.LLMQueueSize, cfg.LLMWorkers)
	log.Printf("llm queue started: %d workers, %d buffer", cfg.LLMWorkers, cfg.LLMQueueSize)
}
```

- [ ] **Step 2: Update handler constructors**

```go
importExportHandler := handlers.NewImportExportHandler(pool, q, llmClient)
transactionHandler := handlers.NewTransactionHandler(q, pool, llmQueue)
```

- [ ] **Step 3: Add graceful shutdown for queue**

In the shutdown goroutine, before `srv.Shutdown(ctx)`:

```go
if llmQueue != nil {
	llmQueue.Shutdown()
}
```

- [ ] **Step 4: Commit**

```bash
git add cmd/server/main.go
git commit -m "feat: wire LLM client and queue in main.go"
```

---

## Task 7: Build and Test

- [ ] **Step 1: Build the server**

```bash
go build -o /tmp/ledgerify-server ./cmd/server
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

```bash
go test ./...
```

Expected: All tests pass.

- [ ] **Step 3: Run vet and lint**

```bash
go vet ./...
```

Expected: No issues.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: address lint issues from LLM integration"
```

---

## Verification Checklist

- [ ] `go build ./cmd/server` succeeds
- [ ] `go test ./internal/llm/` passes (all 4 tests)
- [ ] `go vet ./...` clean
- [ ] LLM client returns correct category for known titles
- [ ] LLM client returns "" for "Uncategorized"
- [ ] Queue enqueues and processes asynchronously
- [ ] Batch categorise falls back to LLM when keywords don't match
- [ ] Batch categorise with `?mode=keyword` skips LLM
- [ ] Transaction creation enqueues when category_id is empty
- [ ] `LLM_API_URL=""` disables LLM gracefully
