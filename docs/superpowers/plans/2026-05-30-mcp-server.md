# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP (Model Context Protocol) server to the Go backend so AI agents can CRUD transactions, accounts, categories, and budgets via standardized tool calls.

**Architecture:** Use `github.com/mark3labs/mcp-go` (community SDK, most mature) with SSE transport mounted at `/api/v1/mcp`. Auth via Bearer token (same JWT as REST API). Tools wrap existing `db.Queries` — no new data layer.

**Tech Stack:** Go 1.26, `github.com/mark3labs/mcp-go`, `github.com/go-chi/chi/v5`, existing `pgxpool` + sqlc queries

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `go.mod` | Modify | Add `github.com/mark3labs/mcp-go` dependency |
| `internal/mcp/server.go` | Create | MCP server setup, tool/resource registration |
| `internal/mcp/tools.go` | Create | Tool definitions and handlers |
| `internal/mcp/resources.go` | Create | Resource definitions and handlers |
| `internal/mcp/auth.go` | Create | Auth middleware for MCP |
| `cmd/server/main.go` | Modify | Mount MCP handler at `/api/v1/mcp` |

---

## Task 1: Add MCP Dependency

**Files:**
- Modify: `go.mod`

- [ ] **Step 1: Install mcp-go**

```bash
go get github.com/mark3labs/mcp-go@latest
```

- [ ] **Step 2: Verify go.mod updated**

Run: `grep mcp-go go.mod`
Expected: shows `github.com/mark3labs/mcp-go` with version.

- [ ] **Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "deps: add mark3labs/mcp-go for MCP server"
```

---

## Task 2: Create MCP Auth Middleware

**Files:**
- Create: `internal/mcp/auth.go`

- [ ] **Step 1: Create auth middleware**

```go
// internal/mcp/auth.go
package mcp

import (
	"context"
	"net/http"
	"strings"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func AuthMiddleware(jwtCfg *auth.JWTConfig) func(ctx context.Context, r *http.Request) context.Context {
	return func(ctx context.Context, r *http.Request) context.Context {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			return ctx
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			return ctx
		}

		claims, err := jwtCfg.ValidateToken(token)
		if err != nil {
			return ctx
		}

		return context.WithValue(ctx, UserIDKey, claims.UserID)
	}
}

func GetUserID(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDKey).(string)
	return userID, ok
}
```

- [ ] **Step 2: Commit**

```bash
git add internal/mcp/auth.go
git commit -m "feat: add MCP auth middleware for JWT validation"
```

---

## Task 3: Create MCP Tool Definitions and Handlers

**Files:**
- Create: `internal/mcp/tools.go`

- [ ] **Step 1: Create tools file**

```go
// internal/mcp/tools.go
package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type ToolDeps struct {
	Pool *pgxpool.Pool
}

func RegisterTools(s *server.MCPServer, deps *ToolDeps) {
	s.AddTool(
		mcp.NewTool("list_transactions",
			mcp.WithDescription("List user's transactions with optional filters"),
			mcp.WithString("type", mcp.Description("Filter by type: income, expense, transfer, credit_payment")),
			mcp.WithString("account_id", mcp.Description("Filter by account ID")),
			mcp.WithString("category_id", mcp.Description("Filter by category ID")),
			mcp.WithString("from_date", mcp.Description("Filter from date (YYYY-MM-DD)")),
			mcp.WithString("to_date", mcp.Description("Filter to date (YYYY-MM-DD)")),
			mcp.WithNumber("limit", mcp.Description("Max results (default 50)")),
		),
		handleListTransactions(deps),
	)

	s.AddTool(
		mcp.NewTool("get_transaction",
			mcp.WithDescription("Get a single transaction by ID"),
			mcp.WithString("transaction_id", mcp.Required(), mcp.Description("Transaction UUID")),
		),
		handleGetTransaction(deps),
	)

	s.AddTool(
		mcp.NewTool("create_transaction",
			mcp.WithDescription("Create a new transaction"),
			mcp.WithString("account_id", mcp.Required(), mcp.Description("Account UUID")),
			mcp.WithString("type", mcp.Required(), mcp.Description("Transaction type: income, expense, transfer, credit_payment")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Transaction amount")),
			mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR, USD)")),
			mcp.WithString("title", mcp.Required(), mcp.Description("Transaction title/description")),
			mcp.WithString("date", mcp.Required(), mcp.Description("Transaction date (YYYY-MM-DD)")),
			mcp.WithString("category_id", mcp.Description("Category UUID (optional)")),
			mcp.WithString("note", mcp.Description("Optional note")),
		),
		handleCreateTransaction(deps),
	)

	s.AddTool(
		mcp.NewTool("update_transaction",
			mcp.WithDescription("Update an existing transaction"),
			mcp.WithString("transaction_id", mcp.Required(), mcp.Description("Transaction UUID")),
			mcp.WithString("title", mcp.Description("New title")),
			mcp.WithString("note", mcp.Description("New note")),
			mcp.WithNumber("amount", mcp.Description("New amount")),
			mcp.WithString("category_id", mcp.Description("New category UUID")),
		),
		handleUpdateTransaction(deps),
	)

	s.AddTool(
		mcp.NewTool("delete_transaction",
			mcp.WithDescription("Soft-delete a transaction"),
			mcp.WithString("transaction_id", mcp.Required(), mcp.Description("Transaction UUID")),
		),
		handleDeleteTransaction(deps),
	)

	s.AddTool(
		mcp.NewTool("list_accounts",
			mcp.WithDescription("List all accounts with computed balances"),
		),
		handleListAccounts(deps),
	)

	s.AddTool(
		mcp.NewTool("create_account",
			mcp.WithDescription("Create a new account"),
			mcp.WithString("name", mcp.Required(), mcp.Description("Account name")),
			mcp.WithString("type", mcp.Required(), mcp.Description("Account type: bank, wallet, cash, savings, credit_card, investment")),
			mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code")),
			mcp.WithNumber("opening_balance", mcp.Description("Opening balance (default 0)")),
		),
		handleCreateAccount(deps),
	)

	s.AddTool(
		mcp.NewTool("list_categories",
			mcp.WithDescription("List all user categories (income and expense)"),
		),
		handleListCategories(deps),
	)

	s.AddTool(
		mcp.NewTool("get_summary",
			mcp.WithDescription("Get dashboard summary: income, expenses, net worth, budget status"),
			mcp.WithString("from_date", mcp.Description("From date (YYYY-MM-DD)")),
			mcp.WithString("to_date", mcp.Description("To date (YYYY-MM-DD)")),
		),
		handleGetSummary(deps),
	)

	s.AddTool(
		mcp.NewTool("list_budgets",
			mcp.WithDescription("List all budgets with spent/remaining amounts"),
		),
		handleListBudgets(deps),
	)

	s.AddTool(
		mcp.NewTool("list_investments",
			mcp.WithDescription("List all investments with current values and gain/loss"),
		),
		handleListInvestments(deps),
	)

	s.AddTool(
		mcp.NewTool("categorise_transactions",
			mcp.WithDescription("Auto-categorise uncategorised transactions using keyword matching and LLM"),
			mcp.WithArray("transaction_ids", mcp.Description("Optional list of transaction IDs. If empty, categorises all uncategorised.")),
		),
		handleCategoriseTransactions(deps),
	)
}

func requireUserID(ctx context.Context) (pgtype.UUID, error) {
	userID, ok := GetUserID(ctx)
	if !ok || userID == "" {
		return pgtype.UUID{}, fmt.Errorf("authentication required")
	}
	return pgtype.UUID{Bytes: [16]byte(userID[0]), Valid: true}, nil
}
```

- [ ] **Step 2: Implement tool handlers**

Add the handler functions in the same file. Each handler queries the DB and returns JSON text:

```go
func handleListTransactions(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		limit := 50
		if l, err := req.RequireFloat("limit"); err == nil {
			limit = int(l)
		}

		query := `SELECT t.id, t.type, t.amount, t.currency, t.title, t.date, c.name as category_name
			FROM transactions t
			LEFT JOIN categories c ON c.id = t.category_id
			WHERE t.user_id = $1 AND t.deleted_at IS NULL`
		args := []interface{}{userID}
		argIdx := 2

		if txType, err := req.RequireString("type"); err == nil {
			query += fmt.Sprintf(" AND t.type = $%d", argIdx)
			args = append(args, txType)
			argIdx++
		}
		if accountID, err := req.RequireString("account_id"); err == nil {
			query += fmt.Sprintf(" AND t.account_id = $%d", argIdx)
			args = append(args, accountID)
			argIdx++
		}
		if categoryID, err := req.RequireString("category_id"); err == nil {
			query += fmt.Sprintf(" AND t.category_id = $%d", argIdx)
			args = append(args, categoryID)
			argIdx++
		}
		if fromDate, err := req.RequireString("from_date"); err == nil {
			query += fmt.Sprintf(" AND t.date >= $%d", argIdx)
			args = append(args, fromDate)
			argIdx++
		}
		if toDate, err := req.RequireString("to_date"); err == nil {
			query += fmt.Sprintf(" AND t.date <= $%d", argIdx)
			args = append(args, toDate)
			argIdx++
		}

		query += fmt.Sprintf(" ORDER BY t.date DESC LIMIT $%d", argIdx)
		args = append(args, limit)

		rows, err := deps.Pool.Query(ctx, query, args...)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer rows.Close()

		var txs []map[string]interface{}
		for rows.Next() {
			var id, txType, currency, title, date, categoryName string
			var amount float64
			rows.Scan(&id, &txType, &amount, &currency, &title, &date, &categoryName)
			txs = append(txs, map[string]interface{}{
				"id": id, "type": txType, "amount": amount, "currency": currency,
				"title": title, "date": date, "category": categoryName,
			})
		}

		jsonBytes, _ := json.Marshal(txs)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleGetTransaction(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		txID, err := req.RequireString("transaction_id")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		var id, ownerID, txType, currency, title, date string
		var amount float64
		var categoryName string
		err = deps.Pool.QueryRow(ctx,
			`SELECT t.id, t.user_id, t.type, t.amount, t.currency, t.title, t.date, COALESCE(c.name, '')
			 FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
			 WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL`, txID, userID,
		).Scan(&id, &ownerID, &txType, &amount, &currency, &title, &date, &categoryName)
		if err != nil {
			return mcp.NewToolResultError("transaction not found"), nil
		}

		tx := map[string]interface{}{
			"id": id, "type": txType, "amount": amount, "currency": currency,
			"title": title, "date": date, "category": categoryName,
		}
		jsonBytes, _ := json.Marshal(tx)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleCreateTransaction(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		accountID, _ := req.RequireString("account_id")
		txType, _ := req.RequireString("type")
		amount, _ := req.RequireFloat("amount")
		currency, _ := req.RequireString("currency")
		title, _ := req.RequireString("title")
		date, _ := req.RequireString("date")

		note := ""
		if n, err := req.RequireString("note"); err == nil {
			note = n
		}
		categoryID := ""
		if c, err := req.RequireString("category_id"); err == nil {
			categoryID = c
		}

		var id string
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO transactions (user_id, account_id, type, amount, currency, converted_amount, base_currency, category_id, title, note, date)
			 VALUES ($1, $2, $3, $4, $5, $4, $5, NULLIF($6, '')::uuid, $7, $8, $9) RETURNING id`,
			userID, accountID, txType, amount, currency, categoryID, title, note, date,
		).Scan(&id)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		result := map[string]interface{}{"id": id, "message": "transaction created"}
		jsonBytes, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleUpdateTransaction(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		txID, _ := req.RequireString("transaction_id")

		// Verify ownership
		var ownerID string
		err = deps.Pool.QueryRow(ctx,
			"SELECT user_id FROM transactions WHERE id = $1 AND deleted_at IS NULL", txID,
		).Scan(&ownerID)
		if err != nil {
			return mcp.NewToolResultError("transaction not found"), nil
		}
		if ownerID != userID {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []interface{}{}
		argIdx := 1

		if title, err := req.RequireString("title"); err == nil {
			setClauses = append(setClauses, fmt.Sprintf("title = $%d", argIdx))
			args = append(args, title)
			argIdx++
		}
		if note, err := req.RequireString("note"); err == nil {
			setClauses = append(setClauses, fmt.Sprintf("note = $%d", argIdx))
			args = append(args, note)
			argIdx++
		}
		if amount, err := req.RequireFloat("amount"); err == nil {
			setClauses = append(setClauses, fmt.Sprintf("amount = $%d", argIdx))
			args = append(args, amount)
			argIdx++
		}
		if catID, err := req.RequireString("category_id"); err == nil {
			setClauses = append(setClauses, fmt.Sprintf("category_id = $%d", argIdx))
			args = append(args, catID)
			argIdx++
		}

		if len(setClauses) == 0 {
			return mcp.NewToolResultText(`{"message": "no fields to update"}`), nil
		}

		query := fmt.Sprintf("UPDATE transactions SET %s WHERE id = $%d AND user_id = $%d",
			strings.Join(setClauses, ", "), argIdx, argIdx+1)
		args = append(args, txID, userID)

		_, err = deps.Pool.Exec(ctx, query, args...)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		return mcp.NewToolResultText(`{"message": "transaction updated"}`), nil
	}
}

		return mcp.NewToolResultText(`{"message": "transaction updated"}`), nil
	}
}

func handleDeleteTransaction(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		txID, _ := req.RequireString("transaction_id")

		_, err = deps.Pool.Exec(ctx,
			"UPDATE transactions SET deleted_at = now() WHERE id = $1 AND user_id = $2", txID, userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		return mcp.NewToolResultText(`{"message": "transaction deleted"}`), nil
	}
}

func handleListAccounts(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT a.id, a.name, a.type, a.currency, a.opening_balance,
			 COALESCE(a.opening_balance, 0) + COALESCE(SUM(
			   CASE WHEN t.type = 'income' THEN t.amount
			        WHEN t.type = 'expense' THEN -t.amount
			        ELSE 0 END), 0) as balance
			 FROM accounts a
			 LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
			 WHERE a.user_id = $1 AND a.deleted_at IS NULL
			 GROUP BY a.id, a.name, a.type, a.currency, a.opening_balance`, userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer rows.Close()

		var accounts []map[string]interface{}
		for rows.Next() {
			var id, name, accType, currency string
			var openingBalance, balance float64
			rows.Scan(&id, &name, &accType, &currency, &openingBalance, &balance)
			accounts = append(accounts, map[string]interface{}{
				"id": id, "name": name, "type": accType, "currency": currency,
				"opening_balance": openingBalance, "balance": balance,
			})
		}

		jsonBytes, _ := json.Marshal(accounts)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleCreateAccount(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		name, _ := req.RequireString("name")
		accType, _ := req.RequireString("type")
		currency, _ := req.RequireString("currency")
		openingBalance := 0.0
		if ob, err := req.RequireFloat("opening_balance"); err == nil {
			openingBalance = ob
		}

		var id string
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO accounts (user_id, name, type, currency, opening_balance)
			 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			userID, name, accType, currency, openingBalance,
		).Scan(&id)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		result := map[string]interface{}{"id": id, "message": "account created"}
		jsonBytes, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleListCategories(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, type FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL ORDER BY name`,
			userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer rows.Close()

		var cats []map[string]interface{}
		for rows.Next() {
			var id, name, catType string
			rows.Scan(&id, &name, &catType)
			cats = append(cats, map[string]interface{}{"id": id, "name": name, "type": catType})
		}

		jsonBytes, _ := json.Marshal(cats)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleGetSummary(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		var totalIncome, totalExpenses float64
		deps.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = $1 AND type = 'income' AND deleted_at IS NULL`,
			userID).Scan(&totalIncome)
		deps.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = $1 AND type = 'expense' AND deleted_at IS NULL`,
			userID).Scan(&totalExpenses)

		summary := map[string]interface{}{
			"total_income":  totalIncome,
			"total_expenses": totalExpenses,
			"balance":       totalIncome - totalExpenses,
		}
		jsonBytes, _ := json.Marshal(summary)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleListBudgets(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT b.id, b.name, b.amount, b.period_type, c.name as category_name
			 FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
			 WHERE b.user_id = $1 AND b.deleted_at IS NULL`, userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer rows.Close()

		var budgets []map[string]interface{}
		for rows.Next() {
			var id, name, periodType, categoryName string
			var amount float64
			rows.Scan(&id, &name, &amount, &periodType, &categoryName)
			budgets = append(budgets, map[string]interface{}{
				"id": id, "name": name, "amount": amount,
				"period": periodType, "category": categoryName,
			})
		}

		jsonBytes, _ := json.Marshal(budgets)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleListInvestments(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, asset_type, quantity, buy_price, current_price,
			 COALESCE(quantity,0) * COALESCE(buy_price,0) as buy_value,
			 COALESCE(quantity,0) * COALESCE(current_price,0) as current_value
			 FROM investments WHERE user_id = $1 AND deleted_at IS NULL`, userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer rows.Close()

		var invs []map[string]interface{}
		for rows.Next() {
			var id, name, assetType string
			var quantity, buyPrice, currentPrice, buyValue, currentValue float64
			rows.Scan(&id, &name, &assetType, &quantity, &buyPrice, &currentPrice, &buyValue, &currentValue)
			invs = append(invs, map[string]interface{}{
				"id": id, "name": name, "asset_type": assetType,
				"quantity": quantity, "buy_price": buyPrice, "current_price": currentPrice,
				"buy_value": buyValue, "current_value": currentValue,
				"gain_loss": currentValue - buyValue,
			})
		}

		jsonBytes, _ := json.Marshal(invs)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}

func handleCategoriseTransactions(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Get keywords
		kwRows, err := deps.Pool.Query(ctx,
			`SELECT ck.keyword, ck.category_id FROM category_keywords ck WHERE ck.user_id = $1`, userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer kwRows.Close()

		type kwPair struct{ keyword, categoryID string }
		var keywords []kwPair
		for kwRows.Next() {
			var k kwPair
			kwRows.Scan(&k.keyword, &k.categoryID)
			keywords = append(keywords, k)
		}

		// Get uncategorised transactions
		txRows, err := deps.Pool.Query(ctx,
			`SELECT id, title FROM transactions WHERE user_id = $1 AND category_id IS NULL AND deleted_at IS NULL`, userID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		defer txRows.Close()

		categorised := 0
		for txRows.Next() {
			var txID, title string
			txRows.Scan(&txID, &title)
			for _, kw := range keywords {
				if strings.Contains(strings.ToLower(title), strings.ToLower(kw.keyword)) {
					deps.Pool.Exec(ctx, "UPDATE transactions SET category_id = $1 WHERE id = $2", kw.categoryID, txID)
					categorised++
					break
				}
			}
		}

		result := map[string]interface{}{"categorised": categorised}
		jsonBytes, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(jsonBytes)), nil
	}
}
```

- [ ] **Step 3: Fix the requireUserID function**

The current implementation is wrong — it converts a string to UUID byte-by-byte. Fix:

```go
func requireUserID(ctx context.Context) (pgtype.UUID, error) {
	userID, ok := GetUserID(ctx)
	if !ok || userID == "" {
		return pgtype.UUID{}, fmt.Errorf("authentication required")
	}
	// Parse UUID string to [16]byte
	var uuid [16]byte
	copy(uuid[:], userID)
	return pgtype.UUID{Bytes: uuid, Valid: true}, nil
}
```

Actually, use the existing `stringToUUID` helper pattern from `handlers/helpers.go`. Or import `github.com/google/uuid`:

```go
import "github.com/google/uuid"

func requireUserID(ctx context.Context) (pgtype.UUID, error) {
	userID, ok := GetUserID(ctx)
	if !ok || userID == "" {
		return pgtype.UUID{}, fmt.Errorf("authentication required")
	}
	parsed, err := uuid.Parse(userID)
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("invalid user id: %w", err)
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}, nil
}
```

- [ ] **Step 4: Commit**

```bash
git add internal/mcp/tools.go
git commit -m "feat: add MCP tool definitions and handlers"
```

---

## Task 4: Create MCP Resource Definitions

**Files:**
- Create: `internal/mcp/resources.go`

- [ ] **Step 1: Create resources file**

```go
// internal/mcp/resources.go
package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterResources(s *server.MCPServer, deps *ToolDeps) {
	s.AddResource(
		mcp.NewResource(
			"ledgerify://user/profile",
			"User Profile",
			mcp.WithResourceDescription("Current user's profile information"),
			mcp.WithMIMEType("application/json"),
		),
		handleUserProfile(deps),
	)

	s.AddResource(
		mcp.NewResource(
			"ledgerify://accounts",
			"Accounts",
			mcp.WithResourceDescription("All user accounts"),
			mcp.WithMIMEType("application/json"),
		),
		handleAccountsResource(deps),
	)

	s.AddResource(
		mcp.NewResource(
			"ledgerify://categories",
			"Categories",
			mcp.WithResourceDescription("All user categories"),
			mcp.WithMIMEType("application/json"),
		),
		handleCategoriesResource(deps),
	)

	s.AddResource(
		mcp.NewResource(
			"ledgerify://networth",
			"Net Worth",
			mcp.WithResourceDescription("Current net worth breakdown"),
			mcp.WithMIMEType("application/json"),
		),
		handleNetworthResource(deps),
	)
}

func handleUserProfile(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok {
			return nil, fmt.Errorf("auth required")
		}

		var name, email string
		err := deps.Pool.QueryRow(ctx,
			"SELECT name, email FROM users WHERE id = $1", userID,
		).Scan(&name, &email)
		if err != nil {
			return nil, err
		}

		data := map[string]interface{}{"name": name, "email": email}
		jsonBytes, _ := json.Marshal(data)
		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://user/profile",
				MIMEType: "application/json",
				Text:     string(jsonBytes),
			},
		}, nil
	}
}

func handleAccountsResource(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok {
			return nil, fmt.Errorf("auth required")
		}

		rows, err := deps.Pool.Query(ctx,
			"SELECT id, name, type, currency FROM accounts WHERE user_id = $1 AND deleted_at IS NULL", userID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		var accounts []map[string]interface{}
		for rows.Next() {
			var id, name, accType, currency string
			rows.Scan(&id, &name, &accType, &currency)
			accounts = append(accounts, map[string]interface{}{
				"id": id, "name": name, "type": accType, "currency": currency,
			})
		}

		jsonBytes, _ := json.Marshal(accounts)
		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://accounts",
				MIMEType: "application/json",
				Text:     string(jsonBytes),
			},
		}, nil
	}
}

func handleCategoriesResource(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok {
			return nil, fmt.Errorf("auth required")
		}

		rows, err := deps.Pool.Query(ctx,
			"SELECT id, name, type FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL", userID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		var cats []map[string]interface{}
		for rows.Next() {
			var id, name, catType string
			rows.Scan(&id, &name, &catType)
			cats = append(cats, map[string]interface{}{"id": id, "name": name, "type": catType})
		}

		jsonBytes, _ := json.Marshal(cats)
		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://categories",
				MIMEType: "application/json",
				Text:     string(jsonBytes),
			},
		}, nil
	}
}

func handleNetworthResource(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok {
			return nil, fmt.Errorf("auth required")
		}

		var totalAssets, totalLiabilities float64
		deps.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(
			   COALESCE(a.opening_balance, 0) + COALESCE((SELECT SUM(CASE WHEN t.type='income' THEN t.amount WHEN t.type='expense' THEN -t.amount ELSE 0 END) FROM transactions t WHERE t.account_id = a.id AND t.deleted_at IS NULL), 0)
			 ), 0) FROM accounts a WHERE a.user_id = $1 AND a.deleted_at IS NULL`, userID).Scan(&totalAssets)

		deps.Pool.QueryRow(ctx,
			"SELECT COALESCE(SUM(outstanding_balance), 0) FROM loans WHERE user_id = $1 AND deleted_at IS NULL",
			userID).Scan(&totalLiabilities)

		data := map[string]interface{}{
			"total_assets":      totalAssets,
			"total_liabilities": totalLiabilities,
			"networth":          totalAssets - totalLiabilities,
		}
		jsonBytes, _ := json.Marshal(data)
		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://networth",
				MIMEType: "application/json",
				Text:     string(jsonBytes),
			},
		}, nil
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add internal/mcp/resources.go
git commit -m "feat: add MCP resource definitions"
```

---

## Task 5: Create MCP Server Setup

**Files:**
- Create: `internal/mcp/server.go`

- [ ] **Step 1: Create server setup**

```go
// internal/mcp/server.go
package mcp

import (
	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/server"
)

func NewMCPServer(pool *pgxpool.Pool, jwtCfg *auth.JWTConfig) *server.MCPServer {
	s := server.NewMCPServer(
		"ledgerify",
		"1.0.0",
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
	)

	deps := &ToolDeps{Pool: pool}

	RegisterTools(s, deps)
	RegisterResources(s, deps)

	return s
}

func NewSSEHandler(mcpServer *server.MCPServer, jwtCfg *auth.JWTConfig) *server.SSEServer {
	sseServer := server.NewSSEServer(mcpServer,
		server.WithSSEEndpoint("/sse"),
		server.WithMessageEndpoint("/message"),
		server.WithSSEContextFunc(AuthMiddleware(jwtCfg)),
	)

	return sseServer
}
```

- [ ] **Step 2: Commit**

```bash
git add internal/mcp/server.go
git commit -m "feat: add MCP server setup with SSE transport"
```

---

## Task 6: Mount MCP in main.go

**Files:**
- Modify: `cmd/server/main.go:1,20,67-68,246-249`

- [ ] **Step 1: Add import**

```go
import "github.com/KTS-o7/ledgerify-web/internal/mcp"
```

- [ ] **Step 2: Create MCP server and mount**

After handler setup, before route registration:

```go
// MCP server
mcpServer := mcp.NewMCPServer(pool, jwtCfg)
sseServer := mcp.NewSSEHandler(mcpServer, jwtCfg)
```

In the authenticated route group (inside the `r.Group(func(r chi.Router) { ... })` block that already has `r.Use(middleware.AuthMiddleware(jwtCfg))`), add AFTER the existing API routes:

```go
r.Handle("/api/v1/mcp/sse", sseServer.SSEHandler())
r.Handle("/api/v1/mcp/message", sseServer.MessageHandler())
```

**Important:** These routes MUST go inside the existing auth middleware group (line 160 in main.go) — not at the top level. The SSE handler's `WithSSEContextFunc` handles MCP-level auth, but the chi middleware provides the initial JWT validation.

- [ ] **Step 3: Commit**

```bash
git add cmd/server/main.go
git commit -m "feat: mount MCP SSE endpoint at /api/v1/mcp"
```

---

## Task 7: Build and Test

- [ ] **Step 1: Build**

```bash
go build -o /tmp/ledgerify-server ./cmd/server
```

Expected: Build succeeds.

- [ ] **Step 2: Run all tests**

```bash
go test ./...
```

Expected: All tests pass.

- [ ] **Step 3: Manual MCP test with curl**

```bash
# Start server, then:
curl -N -H "Authorization: Bearer <jwt>" http://localhost:8080/api/v1/mcp/sse
# Should receive SSE stream with endpoint event
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: address build issues from MCP integration"
```

---

## Verification Checklist

- [ ] `go build ./cmd/server` succeeds
- [ ] `go test ./...` passes
- [ ] `go vet ./...` clean
- [ ] SSE endpoint responds at `/api/v1/mcp/sse`
- [ ] Tool list is discoverable via `tools/list`
- [ ] `list_transactions` returns user's transactions
- [ ] `create_transaction` creates a transaction
- [ ] `delete_transaction` soft-deletes
- [ ] Resources are accessible via `resources/read`
- [ ] Auth middleware rejects invalid tokens
- [ ] Unauthenticated requests get appropriate errors
