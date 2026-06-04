package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type ToolDeps struct {
	Pool *pgxpool.Pool
}

// readOnlyAnnotation marks a tool as non-destructive for MCP clients.
// mcp.NewTool defaults to DestructiveHint=true; read-only tools must opt out
// so clients like Claude Desktop don't prompt the user before each call.
func readOnlyAnnotation() mcp.ToolOption {
	f := false
	t := true
	return mcp.WithToolAnnotation(mcp.ToolAnnotation{
		ReadOnlyHint:    &t,
		DestructiveHint: &f,
		IdempotentHint:  &t,
		OpenWorldHint:   &f,
	})
}

// marshalAsJSONArray serializes a list of records to JSON, normalizing nil
// slices to "[]" so MCP clients always receive a JSON array (encoding/json
// renders a nil slice as "null" by default, which breaks consumers).
func marshalAsJSONArray(v []map[string]any) (string, error) {
	if v == nil {
		v = []map[string]any{}
	}
	data, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
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
		{Tool: listLoansTool(), Handler: listLoansHandler(deps)},
		{Tool: getLoanTool(), Handler: getLoanHandler(deps)},
		{Tool: listInsuranceTool(), Handler: listInsuranceHandler(deps)},
		{Tool: getNetworthTool(), Handler: getNetworthHandler(deps)},
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
		readOnlyAnnotation(),
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

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
	}
}

func getTransactionTool() mcp.Tool {
	return mcp.NewTool("get_transaction",
		mcp.WithDescription("Get a single transaction by ID"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction ID")),
		readOnlyAnnotation(),
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
				account_id = COALESCE(NULLIF($3, '')::uuid, account_id),
				type = COALESCE(NULLIF($4, '')::transaction_type, type),
				amount = $5,
				currency = COALESCE(NULLIF($6, ''), currency),
				category_id = COALESCE(NULLIF($7, '')::uuid, category_id),
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
		readOnlyAnnotation(),
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

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
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
		readOnlyAnnotation(),
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

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
	}
}

func getSummaryTool() mcp.Tool {
	return mcp.NewTool("get_summary",
		mcp.WithDescription("Get a financial summary for a date range"),
		mcp.WithString("from_date", mcp.Required(), mcp.Description("Start date YYYY-MM-DD")),
		mcp.WithString("to_date", mcp.Required(), mcp.Description("End date YYYY-MM-DD")),
		readOnlyAnnotation(),
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
		readOnlyAnnotation(),
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

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
	}
}

func listInvestmentsTool() mcp.Tool {
	return mcp.NewTool("list_investments",
		mcp.WithDescription("List all investments for the user"),
		readOnlyAnnotation(),
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

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
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

// ============================================================================
// Net-worth tools (list_loans, get_loan, list_insurance, get_networth)
//
// Designed so an LLM agent can manage net worth end-to-end through MCP
// without fanning out across the API: get_networth is a single
// self-contained call that returns the total plus the full component
// lists, so the agent has everything it needs to explain the number.
// ============================================================================

func listLoansTool() mcp.Tool {
	return mcp.NewTool("list_loans",
		mcp.WithDescription("List all loans (home, personal, vehicle, education, other). Outstanding balance is a liability in get_networth."),
		readOnlyAnnotation(),
	)
}

func listLoansHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, loan_type, principal, interest_rate, tenure_months,
			        start_date, emi_amount, currency, outstanding_balance,
			        created_at, updated_at
			FROM loans
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY start_date DESC, name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, loanType, currency string
			var principal, interestRate, emiAmount string
			var outstanding *string
			var tenureMonths int
			var startDate time.Time
			var createdAt, updatedAt time.Time

			if err := rows.Scan(&id, &name, &loanType, &principal, &interestRate, &tenureMonths,
				&startDate, &emiAmount, &currency, &outstanding, &createdAt, &updatedAt); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}

			results = append(results, map[string]any{
				"id":                  id,
				"name":                name,
				"loan_type":           loanType,
				"principal":           principal,
				"interest_rate":       interestRate,
				"tenure_months":       tenureMonths,
				"start_date":          startDate.Format("2006-01-02"),
				"emi_amount":          emiAmount,
				"currency":            currency,
				"outstanding_balance": outstanding,
				"created_at":          createdAt.Format(time.RFC3339),
				"updated_at":          updatedAt.Format(time.RFC3339),
			})
		}

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
	}
}

func getLoanTool() mcp.Tool {
	return mcp.NewTool("get_loan",
		mcp.WithDescription("Get a single loan by ID, including the full payment schedule (principal, interest, status per month)."),
		readOnlyAnnotation(),
		mcp.WithString("id", mcp.Required(), mcp.Description("Loan ID")),
	)
}

func getLoanHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}

		var name, loanType, currency string
		var principal, interestRate, emiAmount string
		var outstanding *string
		var tenureMonths int
		var startDate, createdAt, updatedAt time.Time

		err = deps.Pool.QueryRow(ctx,
			`SELECT name, loan_type, principal, interest_rate, tenure_months,
			        start_date, emi_amount, currency, outstanding_balance,
			        created_at, updated_at
			FROM loans
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		).Scan(&name, &loanType, &principal, &interestRate, &tenureMonths,
			&startDate, &emiAmount, &currency, &outstanding, &createdAt, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("loan %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}

		// Payment schedule — every scheduled or paid EMI for this loan.
		paymentRows, err := deps.Pool.Query(ctx,
			`SELECT id, date, amount, principal_component, interest_component, status, created_at
			FROM loan_payments
			WHERE loan_id = $1 AND deleted_at IS NULL
			ORDER BY date ASC`,
			id,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("payments query failed: %v", err)), nil
		}
		defer paymentRows.Close()

		var payments []map[string]any
		for paymentRows.Next() {
			var pid, status string
			var date, payCreatedAt time.Time
			var amount, principalC, interestC *string
			if err := paymentRows.Scan(&pid, &date, &amount, &principalC, &interestC, &status, &payCreatedAt); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("payments scan failed: %v", err)), nil
			}
			payments = append(payments, map[string]any{
				"id":                  pid,
				"date":                date.Format("2006-01-02"),
				"amount":              amount,
				"principal_component": principalC,
				"interest_component":  interestC,
				"status":              status,
				"created_at":          payCreatedAt.Format(time.RFC3339),
			})
		}

		loan := map[string]any{
			"id":                  id,
			"name":                name,
			"loan_type":           loanType,
			"principal":           principal,
			"interest_rate":       interestRate,
			"tenure_months":       tenureMonths,
			"start_date":          startDate.Format("2006-01-02"),
			"emi_amount":          emiAmount,
			"currency":            currency,
			"outstanding_balance": outstanding,
			"created_at":          createdAt.Format(time.RFC3339),
			"updated_at":          updatedAt.Format(time.RFC3339),
			"payments":            payments,
		}
		if payments == nil {
			loan["payments"] = []map[string]any{}
		}

		data, err := json.Marshal(loan)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(data)), nil
	}
}

func listInsuranceTool() mcp.Tool {
	return mcp.NewTool("list_insurance",
		mcp.WithDescription("List all insurance policies (life, health, term, vehicle, etc.). Includes premium, coverage, and renewal dates."),
		readOnlyAnnotation(),
	)
}

func listInsuranceHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, provider, policy_type, premium_amount, premium_frequency,
			        coverage_amount, currency, start_date, end_date, renewal_date, nominee, notes,
			        created_at, updated_at
			FROM insurance_policies
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY renewal_date ASC NULLS LAST, name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, policyType, premiumFreq, currency string
			var provider, nominee, notes *string
			var premium, coverage *string
			var startDate time.Time
			var endDate, renewalDate *time.Time
			var createdAt, updatedAt time.Time

			if err := rows.Scan(&id, &name, &provider, &policyType, &premium, &premiumFreq,
				&coverage, &currency, &startDate, &endDate, &renewalDate, &nominee, &notes,
				&createdAt, &updatedAt); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}

			entry := map[string]any{
				"id":                id,
				"name":              name,
				"provider":          provider,
				"policy_type":       policyType,
				"premium_amount":    premium,
				"premium_frequency": premiumFreq,
				"coverage_amount":   coverage,
				"currency":          currency,
				"start_date":        startDate.Format("2006-01-02"),
				"nominee":           nominee,
				"notes":             notes,
				"created_at":        createdAt.Format(time.RFC3339),
				"updated_at":        updatedAt.Format(time.RFC3339),
			}
			if endDate != nil {
				entry["end_date"] = endDate.Format("2006-01-02")
			} else {
				entry["end_date"] = nil
			}
			if renewalDate != nil {
				entry["renewal_date"] = renewalDate.Format("2006-01-02")
			} else {
				entry["renewal_date"] = nil
			}
			results = append(results, entry)
		}

		jsonData, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(jsonData), nil
	}
}

func getNetworthTool() mcp.Tool {
	return mcp.NewTool("get_networth",
		mcp.WithDescription("Compute net worth in one self-contained call. Returns total assets, total liabilities, net worth, and the full breakdown (every account, every investment, every loan) so the agent can explain the number without follow-up calls. Currency defaults to the user's default_currency; pass base_currency to override."),
		readOnlyAnnotation(),
		mcp.WithString("base_currency", mcp.Description("Override the user's default currency (defaults to users.default_currency). All amounts are reported in this currency.")),
	)
}

func getNetworthHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Resolve base currency: explicit arg wins, else the user's default.
		baseCurrency := req.GetString("base_currency", "")
		if baseCurrency == "" {
			var dc string
			if err := deps.Pool.QueryRow(ctx,
				`SELECT default_currency FROM users WHERE id = $1 AND deleted_at IS NULL`,
				userID,
			).Scan(&dc); err == nil {
				baseCurrency = dc
			}
		}

		// --- ASSETS: bank/wallet/cash/savings accounts (positive balance) ---
		// --- LIABILITIES: credit_card accounts (positive balance = owed) ---
		accountRows, err := deps.Pool.Query(ctx,
			`SELECT id, name, type, currency, opening_balance, credit_limit
			FROM accounts
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY type, name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("accounts query failed: %v", err)), nil
		}
		defer accountRows.Close()

		accounts := []map[string]any{}
		assetsByType := map[string]string{
			"bank": "0", "wallet": "0", "cash": "0", "savings": "0", "investment": "0",
		}
		liabilitiesByType := map[string]string{
			"credit_card": "0",
		}
		var totalAssets, totalLiabilities string

		for accountRows.Next() {
			var id, name, typ, currency string
			var openingBalance string
			var creditLimit *string
			if err := accountRows.Scan(&id, &name, &typ, &currency, &openingBalance, &creditLimit); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("account scan failed: %v", err)), nil
			}
			accounts = append(accounts, map[string]any{
				"id":              id,
				"name":            name,
				"type":            typ,
				"currency":        currency,
				"opening_balance": openingBalance,
				"credit_limit":    creditLimit,
			})

			// Naive aggregation: assume everything is in baseCurrency.
			// (Per-row currency conversion is a follow-up; documented in
			// the tool description so agents know the limitation.)
			if typ == "credit_card" {
				liabilitiesByType["credit_card"] = addDecimalStrings(liabilitiesByType["credit_card"], openingBalance)
			} else {
				if _, ok := assetsByType[typ]; ok {
					assetsByType[typ] = addDecimalStrings(assetsByType[typ], openingBalance)
				} else {
					assetsByType[typ] = addDecimalStrings(assetsByType[typ], openingBalance)
				}
			}
		}

		for _, v := range assetsByType {
			totalAssets = addDecimalStrings(totalAssets, v)
		}
		for _, v := range liabilitiesByType {
			totalLiabilities = addDecimalStrings(totalLiabilities, v)
		}

		// --- ASSETS: investments (quantity * current_price) ---
		investmentRows, err := deps.Pool.Query(ctx,
			`SELECT id, name, asset_type, currency, quantity, current_price,
			        COALESCE(quantity, 0) * COALESCE(current_price, 0) AS computed_value
			FROM investments
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("investments query failed: %v", err)), nil
		}
		defer investmentRows.Close()

		investments := []map[string]any{}
		investmentsByType := map[string]string{}
		var totalInvestments string

		for investmentRows.Next() {
			var id, name, assetType, currency string
			var quantity, currentPrice, computedValue *string
			if err := investmentRows.Scan(&id, &name, &assetType, &currency, &quantity, &currentPrice, &computedValue); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("investment scan failed: %v", err)), nil
			}
			investments = append(investments, map[string]any{
				"id":            id,
				"name":          name,
				"asset_type":    assetType,
				"currency":      currency,
				"quantity":      quantity,
				"current_price": currentPrice,
				"value":         computedValue,
			})
			investmentsByType[assetType] = addDecimalStrings(investmentsByType[assetType], derefStr(computedValue))
			totalInvestments = addDecimalStrings(totalInvestments, derefStr(computedValue))
		}
		totalAssets = addDecimalStrings(totalAssets, totalInvestments)

		// --- LIABILITIES: loans (outstanding_balance) ---
		loanRows, err := deps.Pool.Query(ctx,
			`SELECT id, name, loan_type, currency, COALESCE(outstanding_balance, 0) AS outstanding
			FROM loans
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY name`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("loans query failed: %v", err)), nil
		}
		defer loanRows.Close()

		loans := []map[string]any{}
		loansByType := map[string]string{}
		var totalLoans string

		for loanRows.Next() {
			var id, name, loanType, currency, outstanding string
			if err := loanRows.Scan(&id, &name, &loanType, &currency, &outstanding); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("loan scan failed: %v", err)), nil
			}
			loans = append(loans, map[string]any{
				"id":                  id,
				"name":                name,
				"loan_type":           loanType,
				"currency":            currency,
				"outstanding_balance": outstanding,
			})
			loansByType[loanType] = addDecimalStrings(loansByType[loanType], outstanding)
			totalLoans = addDecimalStrings(totalLoans, outstanding)
		}
		totalLiabilities = addDecimalStrings(totalLiabilities, totalLoans)

		netWorth := addDecimalStrings(totalAssets, negate(totalLiabilities))

		result := map[string]any{
			"as_of":             time.Now().UTC().Format(time.RFC3339),
			"currency":          baseCurrency,
			"net_worth":         netWorth,
			"total_assets":      totalAssets,
			"total_liabilities": totalLiabilities,
			"breakdown": map[string]any{
				"assets": map[string]any{
					"accounts":         assetsByType,
					"investments":      investmentsByType,
					"investments_total": totalInvestments,
				},
				"liabilities": map[string]any{
					"credit_cards":  liabilitiesByType,
					"loans":         loansByType,
					"loans_total":   totalLoans,
				},
			},
			"components": map[string]any{
				"accounts":    accounts,
				"investments": investments,
				"loans":       loans,
			},
		}

		data, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(data)), nil
	}
}

// addDecimalStrings adds two numeric(18,4) string representations without
// losing precision. Returns "0" for empty inputs. The decimal format is
// what Postgres returns via pgx: e.g. "10000.0000" or "-99.9900".
func addDecimalStrings(a, b string) string {
	if a == "" {
		a = "0"
	}
	if b == "" {
		b = "0"
	}
	af, errA := strconv.ParseFloat(a, 64)
	bf, errB := strconv.ParseFloat(b, 64)
	if errA != nil || errB != nil {
		return "0"
	}
	return formatDecimal(af + bf)
}

// negate returns the negative of a numeric(18,4) string.
func negate(s string) string {
	if s == "" {
		return "0"
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return "0"
	}
	return formatDecimal(-f)
}

func derefStr(p *string) string {
	if p == nil {
		return "0"
	}
	return *p
}

// formatDecimal formats a float as a numeric(18,4) string to match the
// Postgres representation. 4 decimal places, no exponent.
func formatDecimal(f float64) string {
	return strconv.FormatFloat(f, 'f', 4, 64)
}
