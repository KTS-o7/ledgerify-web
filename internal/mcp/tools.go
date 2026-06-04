package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type ToolDeps struct {
	Pool *pgxpool.Pool
}

func RegisterTools(s *server.MCPServer, deps *ToolDeps) {
	tools := []server.ServerTool{
		{Tool: listTransactionsTool(), Handler: listTransactionsHandler(deps)},
		{Tool: getTransactionTool(), Handler: getTransactionHandler(deps)},
		{Tool: createTransactionTool(), Handler: createTransactionHandler(deps)},
		{Tool: updateTransactionTool(), Handler: updateTransactionHandler(deps)},
		{Tool: deleteTransactionTool(), Handler: deleteTransactionHandler(deps)},
		{Tool: listAccountsTool(), Handler: listAccountsHandler(deps)},
		{Tool: createAccountTool(), Handler: createAccountHandler(deps)},
		{Tool: listCategoriesTool(), Handler: listCategoriesHandler(deps)},
		{Tool: getSummaryTool(), Handler: getSummaryHandler(deps)},
		{Tool: listBudgetsTool(), Handler: listBudgetsHandler(deps)},
		{Tool: listInvestmentsTool(), Handler: listInvestmentsHandler(deps)},
		{Tool: categoriseTransactionsTool(), Handler: categoriseTransactionsHandler(deps)},
	}
	s.AddTools(tools...)
}

func listTransactionsTool() mcp.Tool {
	return mcp.NewTool("list_transactions",
		mcp.WithDescription("List transactions with optional filters"),
		mcp.WithString("account_id", mcp.Description("Filter by account ID")),
		mcp.WithString("category_id", mcp.Description("Filter by category ID")),
		mcp.WithString("type", mcp.Description("Filter by type: income, expense, transfer, credit_payment")),
		mcp.WithString("from_date", mcp.Description("Start date (YYYY-MM-DD)")),
		mcp.WithString("to_date", mcp.Description("End date (YYYY-MM-DD)")),
		mcp.WithInteger("limit", mcp.Description("Max results (default 50)")),
		mcp.WithInteger("offset", mcp.Description("Offset for pagination")),
	)
}

func listTransactionsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		limit := req.GetInt("limit", 50)
		offset := req.GetInt("offset", 0)
		txType := req.GetString("type", "")
		accountID := req.GetString("account_id", "")
		categoryID := req.GetString("category_id", "")
		fromDate := req.GetString("from_date", "")
		toDate := req.GetString("to_date", "")

		query := `SELECT t.id, t.type, t.amount, t.currency, t.converted_amount, t.base_currency,
			t.title, t.note, t.date, t.is_recurring, t.created_at,
			a.name as account_name, COALESCE(c.name, '') as category_name
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			LEFT JOIN categories c ON c.id = t.category_id
			WHERE t.user_id = $1 AND t.deleted_at IS NULL`
		args := []any{userID}
		argIdx := 2

		if txType != "" {
			query += fmt.Sprintf(" AND t.type = $%d", argIdx)
			args = append(args, txType)
			argIdx++
		}
		if accountID != "" {
			query += fmt.Sprintf(" AND t.account_id = $%d", argIdx)
			args = append(args, accountID)
			argIdx++
		}
		if categoryID != "" {
			query += fmt.Sprintf(" AND t.category_id = $%d", argIdx)
			args = append(args, categoryID)
			argIdx++
		}
		if fromDate != "" {
			query += fmt.Sprintf(" AND t.date >= $%d", argIdx)
			args = append(args, fromDate)
			argIdx++
		}
		if toDate != "" {
			query += fmt.Sprintf(" AND t.date <= $%d", argIdx)
			args = append(args, toDate)
			argIdx++
		}

		query += fmt.Sprintf(" ORDER BY t.date DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := deps.Pool.Query(ctx, query, args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, typ, title, note, accountName, categoryName string
			var amount, currency string
			var convertedAmount *string
			var baseCurrency *string
			var isRecurring bool
			var date, createdAt time.Time

			err := rows.Scan(&id, &typ, &amount, &currency, &convertedAmount, &baseCurrency,
				&title, &note, &date, &isRecurring, &createdAt, &accountName, &categoryName)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}

			results = append(results, map[string]any{
				"id":              id,
				"type":            typ,
				"amount":          amount,
				"currency":        currency,
				"converted_amount": convertedAmount,
				"base_currency":   baseCurrency,
				"title":           title,
				"note":            note,
				"date":            date.Format("2006-01-02"),
				"is_recurring":    isRecurring,
				"created_at":      createdAt.Format(time.RFC3339),
				"account_name":    accountName,
				"category_name":   categoryName,
			})
		}

		jsonData, err := json.Marshal(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func getTransactionTool() mcp.Tool {
	return mcp.NewTool("get_transaction",
		mcp.WithDescription("Get a single transaction by ID"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction ID")),
	)
}

func getTransactionHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		txID := req.GetString("id", "")
		if txID == "" {
			return mcp.NewToolResultError("id is required"), nil
		}

		var id, typ, title, note, accountName, categoryName string
		var amount, currency string
		var convertedAmount *string
		var baseCurrency *string
		var isRecurring bool
		var date, createdAt time.Time

		err = deps.Pool.QueryRow(ctx,
			`SELECT t.id, t.type, t.amount, t.currency, t.converted_amount, t.base_currency,
				t.title, t.note, t.date, t.is_recurring, t.created_at,
				a.name as account_name, COALESCE(c.name, '') as category_name
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			LEFT JOIN categories c ON c.id = t.category_id
			WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL`,
			txID, userID,
		).Scan(&id, &typ, &amount, &currency, &convertedAmount, &baseCurrency,
			&title, &note, &date, &isRecurring, &createdAt, &accountName, &categoryName)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("not found: %v", err)), nil
		}

		result := map[string]any{
			"id":               id,
			"type":             typ,
			"amount":           amount,
			"currency":         currency,
			"converted_amount": convertedAmount,
			"base_currency":    baseCurrency,
			"title":            title,
			"note":             note,
			"date":             date.Format("2006-01-02"),
			"is_recurring":     isRecurring,
			"created_at":       createdAt.Format(time.RFC3339),
			"account_name":     accountName,
			"category_name":    categoryName,
		}
		jsonData, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func createTransactionTool() mcp.Tool {
	return mcp.NewTool("create_transaction",
		mcp.WithDescription("Create a new transaction"),
		mcp.WithString("account_id", mcp.Required(), mcp.Description("Account ID")),
		mcp.WithString("type", mcp.Required(), mcp.Description("Type: income, expense, transfer, credit_payment")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Transaction amount")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithString("category_id", mcp.Description("Category ID")),
		mcp.WithString("title", mcp.Description("Transaction title")),
		mcp.WithString("note", mcp.Description("Transaction note")),
		mcp.WithString("date", mcp.Required(), mcp.Description("Date YYYY-MM-DD")),
	)
}

func createTransactionHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		accountID := req.GetString("account_id", "")
		txType := req.GetString("type", "")
		amount := req.GetFloat("amount", 0)
		currency := req.GetString("currency", "")
		categoryID := req.GetString("category_id", "")
		title := req.GetString("title", "")
		note := req.GetString("note", "")
		date := req.GetString("date", "")

		if accountID == "" || txType == "" || currency == "" || date == "" {
			return mcp.NewToolResultError("account_id, type, currency, and date are required"), nil
		}

		var catID interface{}
		if categoryID != "" {
			catID = categoryID
		}

		var id, retTitle, retNote string
		var retType, retCurrency string
		var retAmount float64
		var retDate time.Time
		var createdAt time.Time

		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO transactions (user_id, account_id, type, amount, currency, category_id, title, note, date)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, type, amount, currency, title, note, date, created_at`,
			userID, accountID, txType, amount, currency, catID, title, note, date,
		).Scan(&id, &retType, &retAmount, &retCurrency, &retTitle, &retNote, &retDate, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}

		result := map[string]any{
			"id":         id,
			"type":       retType,
			"amount":     retAmount,
			"currency":   retCurrency,
			"title":      retTitle,
			"note":       retNote,
			"date":       retDate.Format("2006-01-02"),
			"created_at": createdAt.Format(time.RFC3339),
		}
		jsonData, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func updateTransactionTool() mcp.Tool {
	return mcp.NewTool("update_transaction",
		mcp.WithDescription("Update an existing transaction"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction ID")),
		mcp.WithString("account_id", mcp.Description("Account ID")),
		mcp.WithString("type", mcp.Description("Type: income, expense, transfer, credit_payment")),
		mcp.WithNumber("amount", mcp.Description("Transaction amount")),
		mcp.WithString("currency", mcp.Description("Currency code")),
		mcp.WithString("category_id", mcp.Description("Category ID")),
		mcp.WithString("title", mcp.Description("Transaction title")),
		mcp.WithString("note", mcp.Description("Transaction note")),
		mcp.WithString("date", mcp.Description("Date YYYY-MM-DD")),
	)
}

func updateTransactionHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		txID := req.GetString("id", "")
		if txID == "" {
			return mcp.NewToolResultError("id is required"), nil
		}

		// Verify ownership
		var exists bool
		err = deps.Pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)`,
			txID, userID,
		).Scan(&exists)
		if err != nil || !exists {
			return mcp.NewToolResultError("transaction not found"), nil
		}

		accountID := req.GetString("account_id", "")
		txType := req.GetString("type", "")
		amount := req.GetFloat("amount", 0)
		currency := req.GetString("currency", "")
		categoryID := req.GetString("category_id", "")
		title := req.GetString("title", "")
		note := req.GetString("note", "")
		date := req.GetString("date", "")

		var catID interface{}
		if categoryID != "" {
			catID = categoryID
		}

		var id, retTitle, retNote string
		var retType, retCurrency string
		var retAmount float64
		var retDate time.Time

		err = deps.Pool.QueryRow(ctx,
			`UPDATE transactions SET
				account_id = COALESCE(NULLIF($3, ''), account_id),
				type = COALESCE(NULLIF($4, ''), type),
				amount = $5,
				currency = COALESCE(NULLIF($6, ''), currency),
				category_id = $7,
				title = COALESCE(NULLIF($8, ''), title),
				note = COALESCE(NULLIF($9, ''), note),
				date = COALESCE(NULLIF($10, '')::date, date),
				updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
			RETURNING id, type, amount, currency, title, note, date`,
			txID, userID, accountID, txType, amount, currency, catID, title, note, date,
		).Scan(&id, &retType, &retAmount, &retCurrency, &retTitle, &retNote, &retDate)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}

		result := map[string]any{
			"id":       id,
			"type":     retType,
			"amount":   retAmount,
			"currency": retCurrency,
			"title":    retTitle,
			"note":     retNote,
			"date":     retDate.Format("2006-01-02"),
		}
		jsonData, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func deleteTransactionTool() mcp.Tool {
	return mcp.NewTool("delete_transaction",
		mcp.WithDescription("Soft-delete a transaction"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction ID")),
	)
}

func deleteTransactionHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		txID := req.GetString("id", "")
		if txID == "" {
			return mcp.NewToolResultError("id is required"), nil
		}

		tag, err := deps.Pool.Exec(ctx,
			`UPDATE transactions SET deleted_at = now() WHERE id = $1 AND user_id = $2`,
			txID, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError("transaction not found"), nil
		}

		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

func listAccountsTool() mcp.Tool {
	return mcp.NewTool("list_accounts",
		mcp.WithDescription("List all accounts for the user"),
	)
}

func listAccountsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, type, currency, opening_balance, credit_limit, created_at
			FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, typ, currency string
			var openingBalance string
			var creditLimit *string
			var createdAt time.Time

			err := rows.Scan(&id, &name, &typ, &currency, &openingBalance, &creditLimit, &createdAt)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			results = append(results, map[string]any{
				"id":              id,
				"name":            name,
				"type":            typ,
				"currency":        currency,
				"opening_balance": openingBalance,
				"credit_limit":    creditLimit,
				"created_at":      createdAt.Format(time.RFC3339),
			})
		}

		jsonData, err := json.Marshal(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func createAccountTool() mcp.Tool {
	return mcp.NewTool("create_account",
		mcp.WithDescription("Create a new account"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Account name")),
		mcp.WithString("type", mcp.Required(), mcp.Description("Type: bank, wallet, cash, savings, credit_card, investment")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithNumber("opening_balance", mcp.Description("Opening balance")),
	)
}

func createAccountHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		typ := req.GetString("type", "")
		currency := req.GetString("currency", "")
		openingBalance := req.GetFloat("opening_balance", 0)

		if name == "" || typ == "" || currency == "" {
			return mcp.NewToolResultError("name, type, and currency are required"), nil
		}

		var id, retName, retType, retCurrency, retBalance string
		var createdAt time.Time

		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO accounts (user_id, name, type, currency, opening_balance)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, name, type, currency, opening_balance, created_at`,
			userID, name, typ, currency, openingBalance,
		).Scan(&id, &retName, &retType, &retCurrency, &retBalance, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}

		result := map[string]any{
			"id":              id,
			"name":            retName,
			"type":            retType,
			"currency":        retCurrency,
			"opening_balance": retBalance,
			"created_at":      createdAt.Format(time.RFC3339),
		}
		jsonData, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func listCategoriesTool() mcp.Tool {
	return mcp.NewTool("list_categories",
		mcp.WithDescription("List all categories (including system defaults)"),
	)
}

func listCategoriesHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, type, icon, color
			FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL ORDER BY name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, typ string
			var icon, color *string

			err := rows.Scan(&id, &name, &typ, &icon, &color)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			results = append(results, map[string]any{
				"id":    id,
				"name":  name,
				"type":  typ,
				"icon":  icon,
				"color": color,
			})
		}

		jsonData, err := json.Marshal(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func getSummaryTool() mcp.Tool {
	return mcp.NewTool("get_summary",
		mcp.WithDescription("Get a financial summary for a date range"),
		mcp.WithString("from_date", mcp.Required(), mcp.Description("Start date YYYY-MM-DD")),
		mcp.WithString("to_date", mcp.Required(), mcp.Description("End date YYYY-MM-DD")),
	)
}

func getSummaryHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		fromDate := req.GetString("from_date", "")
		toDate := req.GetString("to_date", "")

		if fromDate == "" || toDate == "" {
			return mcp.NewToolResultError("from_date and to_date are required"), nil
		}

		var totalIncome, totalExpense, totalTransfer string

		err = deps.Pool.QueryRow(ctx,
			`SELECT
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)
			FROM transactions
			WHERE user_id = $1 AND deleted_at IS NULL AND date >= $2 AND date <= $3`,
			userID, fromDate, toDate,
		).Scan(&totalIncome, &totalExpense, &totalTransfer)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("summary query failed: %v", err)), nil
		}

		result := map[string]any{
			"total_income":    totalIncome,
			"total_expense":   totalExpense,
			"total_transfer":  totalTransfer,
			"from_date":       fromDate,
			"to_date":         toDate,
		}
		jsonData, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func listBudgetsTool() mcp.Tool {
	return mcp.NewTool("list_budgets",
		mcp.WithDescription("List all budgets for the user"),
	)
}

func listBudgetsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT b.id, b.name, b.amount, b.currency, b.period_type, b.start_date, b.end_date, b.rollover,
				COALESCE(c.name, '') as category_name
			FROM budgets b
			LEFT JOIN categories c ON c.id = b.category_id
			WHERE b.user_id = $1 AND b.deleted_at IS NULL ORDER BY b.name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, amount, currency, periodType string
			var startDate time.Time
			var endDate *time.Time
			var rollover bool
			var categoryName string

			err := rows.Scan(&id, &name, &amount, &currency, &periodType, &startDate, &endDate, &rollover, &categoryName)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			results = append(results, map[string]any{
				"id":            id,
				"name":          name,
				"amount":        amount,
				"currency":      currency,
				"period_type":   periodType,
				"start_date":    startDate.Format("2006-01-02"),
				"end_date":      endDate,
				"rollover":      rollover,
				"category_name": categoryName,
			})
		}

		jsonData, err := json.Marshal(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func listInvestmentsTool() mcp.Tool {
	return mcp.NewTool("list_investments",
		mcp.WithDescription("List all investments for the user"),
	)
}

func listInvestmentsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, asset_type, currency, quantity, buy_price, current_price, created_at
			FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, assetType, currency string
			var quantity, buyPrice, currentPrice *string
			var createdAt time.Time

			err := rows.Scan(&id, &name, &assetType, &currency, &quantity, &buyPrice, &currentPrice, &createdAt)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			results = append(results, map[string]any{
				"id":            id,
				"name":          name,
				"asset_type":    assetType,
				"currency":      currency,
				"quantity":      quantity,
				"buy_price":     buyPrice,
				"current_price": currentPrice,
				"created_at":    createdAt.Format(time.RFC3339),
			})
		}

		jsonData, err := json.Marshal(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func categoriseTransactionsTool() mcp.Tool {
	return mcp.NewTool("categorise_transactions",
		mcp.WithDescription("Auto-categorise uncategorised transactions based on category keywords"),
	)
}

func categoriseTransactionsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Find keywords for this user
		rows, err := deps.Pool.Query(ctx,
			`SELECT ck.keyword, ck.category_id FROM category_keywords ck WHERE ck.user_id = $1`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query keywords failed: %v", err)), nil
		}
		defer rows.Close()

		type keywordMapping struct {
			Keyword    string
			CategoryID string
		}
		var mappings []keywordMapping
		for rows.Next() {
			var kw, catID string
			if err := rows.Scan(&kw, &catID); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan keyword failed: %v", err)), nil
			}
			mappings = append(mappings, keywordMapping{Keyword: kw, CategoryID: catID})
		}

		if len(mappings) == 0 {
			return mcp.NewToolResultText(`{"updated":0,"message":"no keyword mappings found"}`), nil
		}

		// Find uncategorised transactions
		txRows, err := deps.Pool.Query(ctx,
			`SELECT id, COALESCE(title, '') || ' ' || COALESCE(note, '') as text
			FROM transactions WHERE user_id = $1 AND category_id IS NULL AND deleted_at IS NULL`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query transactions failed: %v", err)), nil
		}
		defer txRows.Close()

		type txToUpdate struct {
			ID         string
			Text       string
			CategoryID string
		}
		var toUpdate []txToUpdate
		for txRows.Next() {
			var id, text string
			if err := txRows.Scan(&id, &text); err != nil {
				continue
			}
			for _, m := range mappings {
				if containsIgnoreCase(text, m.Keyword) {
					toUpdate = append(toUpdate, txToUpdate{ID: id, Text: text, CategoryID: m.CategoryID})
					break
				}
			}
		}

		updated := 0
		for _, tx := range toUpdate {
			tag, err := deps.Pool.Exec(ctx,
				`UPDATE transactions SET category_id = $1, updated_at = now() WHERE id = $2 AND user_id = $3`,
				tx.CategoryID, tx.ID, userID,
			)
			if err == nil && tag.RowsAffected() > 0 {
				updated++
			}
		}

		result := map[string]any{
			"updated":        updated,
			"keywords_found": len(mappings),
			"uncategorised":  len(toUpdate),
		}
		jsonData, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil
	}
}

func containsIgnoreCase(s, substr string) bool {
	if len(substr) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if equalIgnoreCase(s[i:i+len(substr)], substr) {
			return true
		}
	}
	return false
}

func equalIgnoreCase(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 32
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}

func requireUserID(ctx context.Context) (string, error) {
	userID, ok := GetUserID(ctx)
	if !ok || userID == "" {
		return "", fmt.Errorf("user not authenticated")
	}
	return userID, nil
}
