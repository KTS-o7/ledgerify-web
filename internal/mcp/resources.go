package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterResources(s *server.MCPServer, deps *ToolDeps) {
	resources := []server.ServerResource{
		{Resource: userProfileResource(), Handler: userProfileHandler(deps)},
		{Resource: accountsResource(), Handler: accountsHandler(deps)},
		{Resource: categoriesResource(), Handler: categoriesHandler(deps)},
		{Resource: netWorthResource(), Handler: netWorthHandler(deps)},
	}
	s.AddResources(resources...)
}

func userProfileResource() mcp.Resource {
	return mcp.NewResource("ledgerify://user/profile", "User Profile",
		mcp.WithResourceDescription("Current user's profile information"),
		mcp.WithMIMEType("application/json"),
	)
}

func userProfileHandler(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok || userID == "" {
			return nil, fmt.Errorf("user not authenticated")
		}

		var name, email, defaultCurrency, timezone string
		var createdAt time.Time

		err := deps.Pool.QueryRow(ctx,
			`SELECT name, email, default_currency, timezone, created_at
			FROM users WHERE id = $1 AND deleted_at IS NULL`,
			userID,
		).Scan(&name, &email, &defaultCurrency, &timezone, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("query failed: %w", err)
		}

		data := map[string]any{
			"id":               userID,
			"name":             name,
			"email":            email,
			"default_currency": defaultCurrency,
			"timezone":         timezone,
			"created_at":       createdAt.Format(time.RFC3339),
		}
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("marshal failed: %w", err)
		}

		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://user/profile",
				MIMEType: "application/json",
				Text:     string(jsonData),
			},
		}, nil
	}
}

func accountsResource() mcp.Resource {
	return mcp.NewResource("ledgerify://user/accounts", "Accounts",
		mcp.WithResourceDescription("All accounts belonging to the user"),
		mcp.WithMIMEType("application/json"),
	)
}

func accountsHandler(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok || userID == "" {
			return nil, fmt.Errorf("user not authenticated")
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, type, currency, opening_balance, created_at
			FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
			userID,
		)
		if err != nil {
			return nil, fmt.Errorf("query failed: %w", err)
		}
		defer rows.Close()

		var accounts []map[string]any
		for rows.Next() {
			var id, name, typ, currency, balance string
			var createdAt time.Time

			if err := rows.Scan(&id, &name, &typ, &currency, &balance, &createdAt); err != nil {
				return nil, fmt.Errorf("scan failed: %w", err)
			}
			accounts = append(accounts, map[string]any{
				"id":              id,
				"name":            name,
				"type":            typ,
				"currency":        currency,
				"opening_balance": balance,
				"created_at":      createdAt.Format(time.RFC3339),
			})
		}

		jsonData, err := json.Marshal(accounts)
		if err != nil {
			return nil, fmt.Errorf("marshal failed: %w", err)
		}

		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://user/accounts",
				MIMEType: "application/json",
				Text:     string(jsonData),
			},
		}, nil
	}
}

func categoriesResource() mcp.Resource {
	return mcp.NewResource("ledgerify://user/categories", "Categories",
		mcp.WithResourceDescription("All categories (including system defaults)"),
		mcp.WithMIMEType("application/json"),
	)
}

func categoriesHandler(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok || userID == "" {
			return nil, fmt.Errorf("user not authenticated")
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, type, icon, color
			FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL ORDER BY name`,
			userID,
		)
		if err != nil {
			return nil, fmt.Errorf("query failed: %w", err)
		}
		defer rows.Close()

		var categories []map[string]any
		for rows.Next() {
			var id, name, typ string
			var icon, color *string

			if err := rows.Scan(&id, &name, &typ, &icon, &color); err != nil {
				return nil, fmt.Errorf("scan failed: %w", err)
			}
			categories = append(categories, map[string]any{
				"id":    id,
				"name":  name,
				"type":  typ,
				"icon":  icon,
				"color": color,
			})
		}

		jsonData, err := json.Marshal(categories)
		if err != nil {
			return nil, fmt.Errorf("marshal failed: %w", err)
		}

		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://user/categories",
				MIMEType: "application/json",
				Text:     string(jsonData),
			},
		}, nil
	}
}

func netWorthResource() mcp.Resource {
	return mcp.NewResource("ledgerify://user/net-worth", "Net Worth",
		mcp.WithResourceDescription("Net worth calculation across all accounts"),
		mcp.WithMIMEType("application/json"),
	)
}

func netWorthHandler(deps *ToolDeps) server.ResourceHandlerFunc {
	return func(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
		userID, ok := GetUserID(ctx)
		if !ok || userID == "" {
			return nil, fmt.Errorf("user not authenticated")
		}

		var totalBalance string
		err := deps.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(opening_balance), 0)
			FROM accounts WHERE user_id = $1 AND deleted_at IS NULL`,
			userID,
		).Scan(&totalBalance)
		if err != nil {
			return nil, fmt.Errorf("query failed: %w", err)
		}

		// Get income/expense totals for the current month
		now := time.Now()
		firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
		endOfMonth := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

		var monthIncome, monthExpense string
		err = deps.Pool.QueryRow(ctx,
			`SELECT
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
			FROM transactions
			WHERE user_id = $1 AND deleted_at IS NULL AND date >= $2 AND date <= $3`,
			userID, firstOfMonth, endOfMonth,
		).Scan(&monthIncome, &monthExpense)
		if err != nil {
			return nil, fmt.Errorf("query failed: %w", err)
		}

		data := map[string]any{
			"total_account_balance": totalBalance,
			"month_income":          monthIncome,
			"month_expense":         monthExpense,
			"period":                now.Format("2006-01"),
		}
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("marshal failed: %w", err)
		}

		return []mcp.ResourceContents{
			mcp.TextResourceContents{
				URI:      "ledgerify://user/net-worth",
				MIMEType: "application/json",
				Text:     string(jsonData),
			},
		}, nil
	}
}
