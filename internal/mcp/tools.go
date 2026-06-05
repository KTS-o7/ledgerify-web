package mcp

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
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
		{Tool: updateAccountTool(), Handler: updateAccountHandler(deps)},
		{Tool: deleteAccountTool(), Handler: deleteAccountHandler(deps)},
		{Tool: listCategoriesTool(), Handler: listCategoriesHandler(deps)},
		{Tool: createCategoryTool(), Handler: createCategoryHandler(deps)},
		{Tool: updateCategoryTool(), Handler: updateCategoryHandler(deps)},
		{Tool: deleteCategoryTool(), Handler: deleteCategoryHandler(deps)},
		{Tool: getSummaryTool(), Handler: getSummaryHandler(deps)},
		{Tool: listBudgetsTool(), Handler: listBudgetsHandler(deps)},
		{Tool: createBudgetTool(), Handler: createBudgetHandler(deps)},
		{Tool: updateBudgetTool(), Handler: updateBudgetHandler(deps)},
		{Tool: deleteBudgetTool(), Handler: deleteBudgetHandler(deps)},
		{Tool: listInvestmentsTool(), Handler: listInvestmentsHandler(deps)},
		{Tool: createInvestmentTool(), Handler: createInvestmentHandler(deps)},
		{Tool: updateInvestmentTool(), Handler: updateInvestmentHandler(deps)},
		{Tool: deleteInvestmentTool(), Handler: deleteInvestmentHandler(deps)},
		{Tool: listLoansTool(), Handler: listLoansHandler(deps)},
		{Tool: getLoanTool(), Handler: getLoanHandler(deps)},
		{Tool: createLoanTool(), Handler: createLoanHandler(deps)},
		{Tool: updateLoanTool(), Handler: updateLoanHandler(deps)},
		{Tool: deleteLoanTool(), Handler: deleteLoanHandler(deps)},
		{Tool: createLoanPaymentTool(), Handler: createLoanPaymentHandler(deps)},
		{Tool: updateLoanPaymentTool(), Handler: updateLoanPaymentHandler(deps)},
		{Tool: markLoanPaymentPaidTool(), Handler: markLoanPaymentPaidHandler(deps)},
		{Tool: listInsuranceTool(), Handler: listInsuranceHandler(deps)},
		{Tool: createInsuranceTool(), Handler: createInsuranceHandler(deps)},
		{Tool: updateInsuranceTool(), Handler: updateInsuranceHandler(deps)},
		{Tool: deleteInsuranceTool(), Handler: deleteInsuranceHandler(deps)},
		{Tool: createInsurancePaymentTool(), Handler: createInsurancePaymentHandler(deps)},
		{Tool: markInsurancePremiumPaidTool(), Handler: markInsurancePremiumPaidHandler(deps)},
		{Tool: getNetworthTool(), Handler: getNetworthHandler(deps)},
		{Tool: snapshotNetworthTool(), Handler: snapshotNetworthHandler(deps)},
		{Tool: listNetworthSnapshotsTool(), Handler: listNetworthSnapshotsHandler(deps)},
		{Tool: getNetworthTrendTool(), Handler: getNetworthTrendHandler(deps)},
		{Tool: deleteNetworthSnapshotTool(), Handler: deleteNetworthSnapshotHandler(deps)},
		{Tool: getExchangeRatesTool(), Handler: getExchangeRatesHandler(deps)},
		{Tool: setExchangeRateTool(), Handler: setExchangeRateHandler(deps)},
		{Tool: updateUserProfileTool(), Handler: updateUserProfileHandler(deps)},
		{Tool: listSavingsGoalsTool(), Handler: listSavingsGoalsHandler(deps)},
		{Tool: getSavingsGoalTool(), Handler: getSavingsGoalHandler(deps)},
		{Tool: createSavingsGoalTool(), Handler: createSavingsGoalHandler(deps)},
		{Tool: updateSavingsGoalTool(), Handler: updateSavingsGoalHandler(deps)},
		{Tool: deleteSavingsGoalTool(), Handler: deleteSavingsGoalHandler(deps)},
		{Tool: listInvestmentTransactionsTool(), Handler: listInvestmentTransactionsHandler(deps)},
		{Tool: createInvestmentTransactionTool(), Handler: createInvestmentTransactionHandler(deps)},
		{Tool: deleteInvestmentTransactionTool(), Handler: deleteInvestmentTransactionHandler(deps)},
		{Tool: exportTransactionsTool(), Handler: exportTransactionsHandler(deps)},
		{Tool: importTransactionsTool(), Handler: importTransactionsHandler(deps)},
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
		data, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateAccountTool() mcp.Tool {
	return mcp.NewTool("update_account",
		mcp.WithDescription("Update an existing account. All required fields (name, type, currency) must be provided; opening_balance, credit_limit, statement_day, payment_due_day are optional but overwrite the stored value if provided (use create_account to leave them unchanged)."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Account ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Account name")),
		mcp.WithString("type", mcp.Required(), mcp.Description("Type: bank, wallet, cash, savings, credit_card, investment")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithNumber("opening_balance", mcp.Description("Opening balance")),
		mcp.WithNumber("credit_limit", mcp.Description("Credit limit (credit_card only)")),
		mcp.WithNumber("statement_day", mcp.Description("Statement day of month (credit_card only)")),
		mcp.WithNumber("payment_due_day", mcp.Description("Payment due day of month (credit_card only)")),
	)
}

func updateAccountHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		name := req.GetString("name", "")
		typ := req.GetString("type", "")
		currency := req.GetString("currency", "")
		if id == "" || name == "" || typ == "" || currency == "" {
			return mcp.NewToolResultError("id, name, type, and currency are required"), nil
		}

		validTypes := map[string]bool{
			"bank": true, "wallet": true, "cash": true, "savings": true,
			"credit_card": true, "investment": true,
		}
		if !validTypes[typ] {
			return mcp.NewToolResultError("invalid type. Must be one of: bank, wallet, cash, savings, credit_card, investment"), nil
		}

		// Bind optional fields. We use 0 as "not provided" for the
		// numeric params; account updates overwrite unconditionally
		// (the tool description is explicit about this).
		openingBalance := req.GetFloat("opening_balance", 0)
		creditLimit := req.GetFloat("credit_limit", 0)
		statementDay := req.GetFloat("statement_day", 0)
		paymentDueDay := req.GetFloat("payment_due_day", 0)

		var retID, retName, retType, retCurrency, retBalance string
		var updatedAt time.Time

		err = deps.Pool.QueryRow(ctx,
			`UPDATE accounts SET
				name = $2,
				type = $3::account_type,
				currency = $4,
				opening_balance = $5,
				credit_limit = $6,
				statement_day = $7,
				payment_due_day = $8,
				updated_at = now()
			WHERE id = $1 AND user_id = $9 AND deleted_at IS NULL
			RETURNING id, name, type, currency, opening_balance, updated_at`,
			id, name, typ, currency, openingBalance, creditLimit, statementDay, paymentDueDay, userID,
		).Scan(&retID, &retName, &retType, &retCurrency, &retBalance, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("account %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}

		result := map[string]any{
			"id":              retID,
			"name":            retName,
			"type":            retType,
			"currency":        retCurrency,
			"opening_balance": retBalance,
			"updated_at":      updatedAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteAccountTool() mcp.Tool {
	return mcp.NewTool("delete_account",
		mcp.WithDescription("Soft-delete an account. Historical transactions referencing this account remain intact (deleted_at is set, not the row erased)."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Account ID")),
	)
}

func deleteAccountHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}

		tag, err := deps.Pool.Exec(ctx,
			`UPDATE accounts SET deleted_at = now(), updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("account %q not found (or already deleted, or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

// ============================================================================
// Group 2: category writes
// ============================================================================

func createCategoryTool() mcp.Tool {
	return mcp.NewTool("create_category",
		mcp.WithDescription("Create a user-defined category. (System-default categories are seeded automatically and cannot be modified via MCP.)"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Category name")),
		mcp.WithString("type", mcp.Required(), mcp.Description("Type: income, expense, transfer")),
		mcp.WithString("icon", mcp.Description("Lucide icon name (e.g. utensils, home, car)")),
		mcp.WithString("color", mcp.Description("Hex color (e.g. #f87171)")),
	)
}

func createCategoryHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		typ := req.GetString("type", "")
		if name == "" || typ == "" {
			return mcp.NewToolResultError("name and type are required"), nil
		}
		validTypes := map[string]bool{"income": true, "expense": true, "transfer": true}
		if !validTypes[typ] {
			return mcp.NewToolResultError("invalid type. Must be one of: income, expense, transfer"), nil
		}
		icon := req.GetString("icon", "")
		color := req.GetString("color", "")

		var id, retName, retType string
		var iconOut, colorOut *string
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO categories (user_id, name, type, icon, color)
			VALUES ($1, $2, $3::category_type, NULLIF($4, ''), NULLIF($5, ''))
			RETURNING id, name, type, icon, color`,
			userID, name, typ, icon, color,
		).Scan(&id, &retName, &retType, &iconOut, &colorOut)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id": id, "name": retName, "type": retType, "icon": iconOut, "color": colorOut,
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateCategoryTool() mcp.Tool {
	return mcp.NewTool("update_category",
		mcp.WithDescription("Update a user-defined category. Only categories you own (user_id = you) can be modified; system defaults are not modifiable via MCP."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Category ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Category name")),
		mcp.WithString("type", mcp.Required(), mcp.Description("Type: income, expense, transfer")),
		mcp.WithString("icon", mcp.Description("Lucide icon name (e.g. utensils, home, car)")),
		mcp.WithString("color", mcp.Description("Hex color (e.g. #f87171)")),
	)
}

func updateCategoryHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		name := req.GetString("name", "")
		typ := req.GetString("type", "")
		if id == "" || name == "" || typ == "" {
			return mcp.NewToolResultError("id, name, and type are required"), nil
		}
		validTypes := map[string]bool{"income": true, "expense": true, "transfer": true}
		if !validTypes[typ] {
			return mcp.NewToolResultError("invalid type. Must be one of: income, expense, transfer"), nil
		}
		icon := req.GetString("icon", "")
		color := req.GetString("color", "")

		var retID, retName, retType string
		var iconOut, colorOut *string
		err = deps.Pool.QueryRow(ctx,
			`UPDATE categories SET
				name = $2,
				type = $3::category_type,
				icon = NULLIF($4, ''),
				color = NULLIF($5, '')
			WHERE id = $1 AND user_id = $6 AND deleted_at IS NULL
			RETURNING id, name, type, icon, color`,
			id, name, typ, icon, color, userID,
		).Scan(&retID, &retName, &retType, &iconOut, &colorOut)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("category %q not found, not owned by you, or is a system default (not modifiable)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id": retID, "name": retName, "type": retType, "icon": iconOut, "color": colorOut,
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteCategoryTool() mcp.Tool {
	return mcp.NewTool("delete_category",
		mcp.WithDescription("Soft-delete a user-defined category. System defaults cannot be deleted. Existing transactions keep their category_id (a soft-deleted category still resolves for display)."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Category ID")),
	)
}

func deleteCategoryHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE categories SET deleted_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("category %q not found, not owned by you, or is a system default (not deletable)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

// ============================================================================
// Group 3: budget writes
// ============================================================================

func createBudgetTool() mcp.Tool {
	return mcp.NewTool("create_budget",
		mcp.WithDescription("Create a budget envelope. category_id is optional (overall budget if omitted). period_type is 'monthly' or 'weekly'. rollover=true carries unspent balance to the next period."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Budget name")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Budget amount")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithString("period_type", mcp.Required(), mcp.Description("Period: monthly, weekly")),
		mcp.WithString("start_date", mcp.Required(), mcp.Description("Start date YYYY-MM-DD")),
		mcp.WithString("end_date", mcp.Description("End date YYYY-MM-DD (optional)")),
		mcp.WithString("category_id", mcp.Description("Category ID (optional — overall budget if omitted)")),
		mcp.WithString("period_anchor_date", mcp.Description("Period anchor date (optional, defaults to start_date)")),
		mcp.WithBoolean("rollover", mcp.Description("Carry unspent balance to next period (default false)")),
	)
}

func createBudgetHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		amount := req.GetFloat("amount", -1)
		currency := req.GetString("currency", "")
		periodType := req.GetString("period_type", "")
		startDate := req.GetString("start_date", "")
		if name == "" || amount < 0 || currency == "" || periodType == "" || startDate == "" {
			return mcp.NewToolResultError("name, amount, currency, period_type, and start_date are required"), nil
		}
		if periodType != "monthly" && periodType != "weekly" {
			return mcp.NewToolResultError("period_type must be 'monthly' or 'weekly'"), nil
		}
		endDate := req.GetString("end_date", "")
		categoryID := req.GetString("category_id", "")
		anchorDate := req.GetString("period_anchor_date", "")
		rollover := req.GetBool("rollover", false)

		var id, retName, retCurrency, retPeriod string
		var retAmount string
		var retStart time.Time
		var retEnd *time.Time
		var retCategoryID, retAnchor *string
		var retRollover bool
		var createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO budgets
				(user_id, name, amount, currency, period_type, start_date, end_date, category_id, period_anchor_date, rollover)
			VALUES
				($1, $2, $3, $4, $5::period_type, $6::date, NULLIF($7, '')::date, NULLIF($8, '')::uuid, NULLIF($9, '')::date, $10)
			RETURNING id, name, amount, currency, period_type, start_date, end_date, category_id, period_anchor_date, rollover, created_at`,
			userID, name, amount, currency, periodType, startDate, endDate, categoryID, anchorDate, rollover,
		).Scan(&id, &retName, &retAmount, &retCurrency, &retPeriod, &retStart, &retEnd, &retCategoryID, &retAnchor, &retRollover, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                  id,
			"name":                retName,
			"amount":              retAmount,
			"currency":            retCurrency,
			"period_type":         retPeriod,
			"start_date":          retStart.Format("2006-01-02"),
			"end_date":            retEnd,
			"category_id":         retCategoryID,
			"period_anchor_date":  retAnchor,
			"rollover":            retRollover,
			"created_at":          createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateBudgetTool() mcp.Tool {
	return mcp.NewTool("update_budget",
		mcp.WithDescription("Update a budget. id is required; all other fields overwrite the stored value if provided."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Budget ID")),
		mcp.WithString("name", mcp.Description("Budget name")),
		mcp.WithNumber("amount", mcp.Description("Budget amount")),
		mcp.WithString("currency", mcp.Description("Currency code")),
		mcp.WithString("period_type", mcp.Description("Period: monthly, weekly")),
		mcp.WithString("start_date", mcp.Description("Start date YYYY-MM-DD")),
		mcp.WithString("end_date", mcp.Description("End date YYYY-MM-DD (empty string to clear)")),
		mcp.WithString("category_id", mcp.Description("Category ID (empty string to clear)")),
		mcp.WithString("period_anchor_date", mcp.Description("Period anchor date (empty string to clear)")),
		mcp.WithBoolean("rollover", mcp.Description("Rollover unused balance")),
	)
}

func updateBudgetHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		periodType := req.GetString("period_type", "")
		if periodType != "" && periodType != "monthly" && periodType != "weekly" {
			return mcp.NewToolResultError("period_type must be 'monthly' or 'weekly'"), nil
		}
		name := req.GetString("name", "")
		amount := req.GetFloat("amount", 0)
		currency := req.GetString("currency", "")
		startDate := req.GetString("start_date", "")
		endDate := req.GetString("end_date", "")
		categoryID := req.GetString("category_id", "")
		anchorDate := req.GetString("period_anchor_date", "")
		rollover := req.GetBool("rollover", false)

		var retID, retName, retCurrency, retPeriod string
		var retAmount string
		var retStart time.Time
		var retEnd, retCategoryID, retAnchor *string
		var retRollover bool
		var updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE budgets SET
				name = COALESCE(NULLIF($2, ''), name),
				amount = COALESCE(NULLIF($3, 0), amount),
				currency = COALESCE(NULLIF($4, ''), currency),
				period_type = COALESCE(NULLIF($5, '')::period_type, period_type),
				start_date = COALESCE(NULLIF($6, '')::date, start_date),
				end_date = NULLIF($7, '')::date,
				category_id = NULLIF($8, '')::uuid,
				period_anchor_date = NULLIF($9, '')::date,
				rollover = $10,
				updated_at = now()
			WHERE id = $1 AND user_id = $11 AND deleted_at IS NULL
			RETURNING id, name, amount, currency, period_type, start_date, end_date, category_id, period_anchor_date, rollover, updated_at`,
			id, name, amount, currency, periodType, startDate, endDate, categoryID, anchorDate, rollover, userID,
		).Scan(&retID, &retName, &retAmount, &retCurrency, &retPeriod, &retStart, &retEnd, &retCategoryID, &retAnchor, &retRollover, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("budget %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                 retID,
			"name":               retName,
			"amount":             retAmount,
			"currency":           retCurrency,
			"period_type":        retPeriod,
			"start_date":         retStart.Format("2006-01-02"),
			"end_date":           retEnd,
			"category_id":        retCategoryID,
			"period_anchor_date": retAnchor,
			"rollover":           retRollover,
			"updated_at":         updatedAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteBudgetTool() mcp.Tool {
	return mcp.NewTool("delete_budget",
		mcp.WithDescription("Soft-delete a budget."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Budget ID")),
	)
}

func deleteBudgetHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE budgets SET deleted_at = now(), updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("budget %q not found (or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

// ============================================================================
// Group 4: investment writes
// ============================================================================

func validAssetType(t string) bool {
	switch t {
	case "stock", "mf", "crypto", "fd", "ppf", "nps",
		"gold", "silver", "real_estate", "savings", "other":
		return true
	}
	return false
}

func createInvestmentTool() mcp.Tool {
	return mcp.NewTool("create_investment",
		mcp.WithDescription("Create an investment holding. asset_type is one of: stock, mf, crypto, fd, ppf, nps, gold, silver, real_estate, savings, other. quantity, buy_price, current_price, interest_rate, maturity_date, metadata are all optional (use for the kinds that apply: e.g. quantity+current_price for stocks, interest_rate+maturity_date for FDs)."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Investment name (e.g. 'HDFC Flexi Cap', 'SGB 2024-25')")),
		mcp.WithString("asset_type", mcp.Required(), mcp.Description("Asset type: stock, mf, crypto, fd, ppf, nps, gold, silver, real_estate, savings, other")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithNumber("quantity", mcp.Description("Units held (e.g. 100 shares)")),
		mcp.WithNumber("buy_price", mcp.Description("Average buy price per unit")),
		mcp.WithNumber("current_price", mcp.Description("Latest price per unit")),
		mcp.WithString("maturity_date", mcp.Description("Maturity date YYYY-MM-DD (FDs, bonds)")),
		mcp.WithNumber("interest_rate", mcp.Description("Annual interest rate % (FDs, savings, PPF, NPS)")),
	)
}

func createInvestmentHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		typ := req.GetString("asset_type", "")
		currency := req.GetString("currency", "")
		if name == "" || typ == "" || currency == "" {
			return mcp.NewToolResultError("name, asset_type, and currency are required"), nil
		}
		if !validAssetType(typ) {
			return mcp.NewToolResultError("invalid asset_type"), nil
		}
		quantity := req.GetFloat("quantity", 0)
		buyPrice := req.GetFloat("buy_price", 0)
		currentPrice := req.GetFloat("current_price", 0)
		maturityDate := req.GetString("maturity_date", "")
		interestRate := req.GetFloat("interest_rate", 0)

		var id, retName, retType, retCurrency string
		var quantityOut, buyPriceOut, currentPriceOut *string
		var interestOut *string
		var maturityOut *time.Time
		var createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO investments
				(user_id, name, asset_type, currency, quantity, buy_price, current_price,
				 current_price_updated_at, maturity_date, interest_rate)
			VALUES
				($1, $2, $3::asset_type, $4, NULLIF($5, 0), NULLIF($6, 0), NULLIF($7, 0),
				 CASE WHEN $7 = 0 THEN NULL ELSE now() END,
				 NULLIF($8, '')::date, NULLIF($9, 0))
			RETURNING id, name, asset_type, currency, quantity, buy_price, current_price, maturity_date, interest_rate, created_at`,
			userID, name, typ, currency, quantity, buyPrice, currentPrice, maturityDate, interestRate,
		).Scan(&id, &retName, &retType, &retCurrency, &quantityOut, &buyPriceOut, &currentPriceOut, &maturityOut, &interestOut, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":            id,
			"name":          retName,
			"asset_type":    retType,
			"currency":      retCurrency,
			"quantity":      quantityOut,
			"buy_price":     buyPriceOut,
			"current_price": currentPriceOut,
			"maturity_date": maturityOut,
			"interest_rate": interestOut,
			"created_at":    createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateInvestmentTool() mcp.Tool {
	return mcp.NewTool("update_investment",
		mcp.WithDescription("Update an investment. id is required; any other field overwrites the stored value if provided. Pass empty string / 0 to clear numeric and date fields."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Investment ID")),
		mcp.WithString("name", mcp.Description("Investment name")),
		mcp.WithString("asset_type", mcp.Description("Asset type: stock, mf, crypto, fd, ppf, nps, gold, silver, real_estate, savings, other")),
		mcp.WithString("currency", mcp.Description("Currency code")),
		mcp.WithNumber("quantity", mcp.Description("Units held (0 to clear)")),
		mcp.WithNumber("buy_price", mcp.Description("Average buy price per unit (0 to clear)")),
		mcp.WithNumber("current_price", mcp.Description("Latest price per unit (0 to clear; sets current_price_updated_at = now())")),
		mcp.WithString("maturity_date", mcp.Description("Maturity date YYYY-MM-DD (empty to clear)")),
		mcp.WithNumber("interest_rate", mcp.Description("Annual interest rate % (0 to clear)")),
	)
}

func updateInvestmentHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		typ := req.GetString("asset_type", "")
		if typ != "" && !validAssetType(typ) {
			return mcp.NewToolResultError("invalid asset_type"), nil
		}
		name := req.GetString("name", "")
		currency := req.GetString("currency", "")
		quantity := req.GetFloat("quantity", 0)
		buyPrice := req.GetFloat("buy_price", 0)
		currentPrice := req.GetFloat("current_price", 0)
		maturityDate := req.GetString("maturity_date", "")
		interestRate := req.GetFloat("interest_rate", 0)

		var retID, retName, retType, retCurrency string
		var quantityOut, buyPriceOut, currentPriceOut *string
		var interestOut *string
		var maturityOut *time.Time
		var updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE investments SET
				name = COALESCE(NULLIF($2, ''), name),
				asset_type = COALESCE(NULLIF($3, '')::asset_type, asset_type),
				currency = COALESCE(NULLIF($4, ''), currency),
				quantity = NULLIF($5, 0),
				buy_price = NULLIF($6, 0),
				current_price = NULLIF($7, 0),
				current_price_updated_at = CASE WHEN $7 = 0 THEN NULL ELSE now() END,
				maturity_date = NULLIF($8, '')::date,
				interest_rate = NULLIF($9, 0),
				updated_at = now()
			WHERE id = $1 AND user_id = $10 AND deleted_at IS NULL
			RETURNING id, name, asset_type, currency, quantity, buy_price, current_price, maturity_date, interest_rate, updated_at`,
			id, name, typ, currency, quantity, buyPrice, currentPrice, maturityDate, interestRate, userID,
		).Scan(&retID, &retName, &retType, &retCurrency, &quantityOut, &buyPriceOut, &currentPriceOut, &maturityOut, &interestOut, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("investment %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":            retID,
			"name":          retName,
			"asset_type":    retType,
			"currency":      retCurrency,
			"quantity":      quantityOut,
			"buy_price":     buyPriceOut,
			"current_price": currentPriceOut,
			"maturity_date": maturityOut,
			"interest_rate": interestOut,
			"updated_at":    updatedAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteInvestmentTool() mcp.Tool {
	return mcp.NewTool("delete_investment",
		mcp.WithDescription("Soft-delete an investment. Historical investment_transactions are kept."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Investment ID")),
	)
}

func deleteInvestmentHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE investments SET deleted_at = now(), updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("investment %q not found (or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

// ============================================================================
// Group 5: loan writes + payment tracking
// ============================================================================

func validLoanType(t string) bool {
	switch t {
	case "home", "personal", "vehicle", "education", "other":
		return true
	}
	return false
}

func createLoanTool() mcp.Tool {
	return mcp.NewTool("create_loan",
		mcp.WithDescription("Create a loan record. outstanding_balance is optional — if omitted, defaults to principal. The loan contributes to get_networth liabilities."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Loan name (e.g. 'HDFC Home Loan')")),
		mcp.WithString("loan_type", mcp.Required(), mcp.Description("Type: home, personal, vehicle, education, other")),
		mcp.WithNumber("principal", mcp.Required(), mcp.Description("Original principal amount")),
		mcp.WithNumber("interest_rate", mcp.Required(), mcp.Description("Annual interest rate % (e.g. 8.5)")),
		mcp.WithInteger("tenure_months", mcp.Required(), mcp.Description("Tenure in months")),
		mcp.WithString("start_date", mcp.Required(), mcp.Description("Loan start date YYYY-MM-DD")),
		mcp.WithNumber("emi_amount", mcp.Required(), mcp.Description("Monthly EMI amount")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithNumber("outstanding_balance", mcp.Description("Current outstanding balance (defaults to principal)")),
	)
}

func createLoanHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		typ := req.GetString("loan_type", "")
		currency := req.GetString("currency", "")
		startDate := req.GetString("start_date", "")
		principal := req.GetFloat("principal", -1)
		interestRate := req.GetFloat("interest_rate", -1)
		tenureMonths := req.GetInt("tenure_months", 0)
		emiAmount := req.GetFloat("emi_amount", -1)
		if name == "" || typ == "" || currency == "" || startDate == "" ||
			principal < 0 || interestRate < 0 || tenureMonths <= 0 || emiAmount < 0 {
			return mcp.NewToolResultError("name, loan_type, currency, start_date, principal, interest_rate, tenure_months, emi_amount are required"), nil
		}
		if !validLoanType(typ) {
			return mcp.NewToolResultError("invalid loan_type"), nil
		}
		outstanding := req.GetFloat("outstanding_balance", 0)
		if outstanding == 0 {
			outstanding = principal
		}

		var id, retName, retType, retCurrency string
		var retPrincipal, retRate, retEMI, retOutstanding string
		var retTenure int
		var retStart, retCreated, retUpdated time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO loans
				(user_id, name, loan_type, principal, interest_rate, tenure_months, start_date, emi_amount, currency, outstanding_balance)
			VALUES
				($1, $2, $3::loan_type, $4, $5, $6, $7::date, $8, $9, $10)
			RETURNING id, name, loan_type, principal, interest_rate, tenure_months, start_date, emi_amount, currency, outstanding_balance, created_at, updated_at`,
			userID, name, typ, principal, interestRate, tenureMonths, startDate, emiAmount, currency, outstanding,
		).Scan(&id, &retName, &retType, &retPrincipal, &retRate, &retTenure, &retStart, &retEMI, &retCurrency, &retOutstanding, &retCreated, &retUpdated)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                  id,
			"name":                retName,
			"loan_type":           retType,
			"principal":           retPrincipal,
			"interest_rate":       retRate,
			"tenure_months":       retTenure,
			"start_date":          retStart.Format("2006-01-02"),
			"emi_amount":          retEMI,
			"currency":            retCurrency,
			"outstanding_balance": retOutstanding,
			"created_at":          retCreated.Format(time.RFC3339),
			"updated_at":          retUpdated.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateLoanTool() mcp.Tool {
	return mcp.NewTool("update_loan",
		mcp.WithDescription("Update a loan. id is required; other fields overwrite the stored value if provided."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Loan ID")),
		mcp.WithString("name", mcp.Description("Loan name")),
		mcp.WithString("loan_type", mcp.Description("Type: home, personal, vehicle, education, other")),
		mcp.WithNumber("principal", mcp.Description("Original principal (0 to clear)")),
		mcp.WithNumber("interest_rate", mcp.Description("Annual interest rate % (0 to clear)")),
		mcp.WithInteger("tenure_months", mcp.Description("Tenure in months (0 to clear)")),
		mcp.WithString("start_date", mcp.Description("Start date YYYY-MM-DD")),
		mcp.WithNumber("emi_amount", mcp.Description("Monthly EMI amount (0 to clear)")),
		mcp.WithString("currency", mcp.Description("Currency code")),
		mcp.WithNumber("outstanding_balance", mcp.Description("Current outstanding balance (0 to leave unchanged; pass a positive value to set)")),
	)
}

func updateLoanHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		typ := req.GetString("loan_type", "")
		if typ != "" && !validLoanType(typ) {
			return mcp.NewToolResultError("invalid loan_type"), nil
		}
		name := req.GetString("name", "")
		principal := req.GetFloat("principal", 0)
		interestRate := req.GetFloat("interest_rate", 0)
		tenureMonths := req.GetInt("tenure_months", 0)
		startDate := req.GetString("start_date", "")
		emiAmount := req.GetFloat("emi_amount", 0)
		currency := req.GetString("currency", "")
		outstanding := req.GetFloat("outstanding_balance", 0)

		var retID, retName, retType, retCurrency string
		var retPrincipal, retRate, retEMI, retOutstanding string
		var retTenure int
		var retStart, retUpdated time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE loans SET
				name = COALESCE(NULLIF($2, ''), name),
				loan_type = COALESCE(NULLIF($3, '')::loan_type, loan_type),
				principal = COALESCE(NULLIF($4, 0), principal),
				interest_rate = COALESCE(NULLIF($5, 0), interest_rate),
				tenure_months = COALESCE(NULLIF($6, 0), tenure_months),
				start_date = COALESCE(NULLIF($7, '')::date, start_date),
				emi_amount = COALESCE(NULLIF($8, 0), emi_amount),
				currency = COALESCE(NULLIF($9, ''), currency),
				outstanding_balance = COALESCE(NULLIF($10, 0), outstanding_balance),
				updated_at = now()
			WHERE id = $1 AND user_id = $11 AND deleted_at IS NULL
			RETURNING id, name, loan_type, principal, interest_rate, tenure_months, start_date, emi_amount, currency, outstanding_balance, updated_at`,
			id, name, typ, principal, interestRate, tenureMonths, startDate, emiAmount, currency, outstanding, userID,
		).Scan(&retID, &retName, &retType, &retPrincipal, &retRate, &retTenure, &retStart, &retEMI, &retCurrency, &retOutstanding, &retUpdated)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("loan %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                  retID,
			"name":                retName,
			"loan_type":           retType,
			"principal":           retPrincipal,
			"interest_rate":       retRate,
			"tenure_months":       retTenure,
			"start_date":          retStart.Format("2006-01-02"),
			"emi_amount":          retEMI,
			"currency":            retCurrency,
			"outstanding_balance": retOutstanding,
			"updated_at":          retUpdated.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteLoanTool() mcp.Tool {
	return mcp.NewTool("delete_loan",
		mcp.WithDescription("Soft-delete a loan. Payment history (loan_payments) is kept."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Loan ID")),
	)
}

func deleteLoanHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE loans SET deleted_at = now(), updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("loan %q not found (or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

func createLoanPaymentTool() mcp.Tool {
	return mcp.NewTool("create_loan_payment",
		mcp.WithDescription("Record a payment against a loan. Status defaults to 'paid'. principal_component + interest_component should sum to amount; either or both can be 0 for unknown splits."),
		mcp.WithString("loan_id", mcp.Required(), mcp.Description("Loan ID")),
		mcp.WithString("date", mcp.Required(), mcp.Description("Payment date YYYY-MM-DD")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Total amount paid")),
		mcp.WithNumber("principal_component", mcp.Description("Portion that reduced principal (default 0)")),
		mcp.WithNumber("interest_component", mcp.Description("Portion that paid interest (default 0)")),
		mcp.WithString("status", mcp.Description("Status: scheduled, paid, missed, partial (default paid)")),
	)
}

func createLoanPaymentHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		loanID := req.GetString("loan_id", "")
		date := req.GetString("date", "")
		amount := req.GetFloat("amount", -1)
		if loanID == "" || date == "" || amount < 0 {
			return mcp.NewToolResultError("loan_id, date, and amount are required"), nil
		}
		principal := req.GetFloat("principal_component", 0)
		interest := req.GetFloat("interest_component", 0)
		status := req.GetString("status", "paid")
		switch status {
		case "scheduled", "paid", "missed", "partial":
		default:
			return mcp.NewToolResultError("status must be one of: scheduled, paid, missed, partial"), nil
		}

		// Confirm the loan belongs to this user (defence in depth).
		var ownerCheck string
		if err := deps.Pool.QueryRow(ctx,
			`SELECT user_id::text FROM loans WHERE id = $1 AND deleted_at IS NULL`,
			loanID,
		).Scan(&ownerCheck); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("loan %q not found", loanID)), nil
		}
		if ownerCheck != userID {
			return mcp.NewToolResultError("loan not owned by you"), nil
		}

		var id, retStatus, retAmount, retPrincipal, retInterest string
		var retDate, createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO loan_payments (loan_id, date, amount, principal_component, interest_component, status)
			VALUES ($1, $2::date, $3, $4, $5, $6::payment_status)
			RETURNING id, date, amount, principal_component, interest_component, status, created_at`,
			loanID, date, amount, principal, interest, status,
		).Scan(&id, &retDate, &retAmount, &retPrincipal, &retInterest, &retStatus, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                  id,
			"loan_id":             loanID,
			"date":                retDate.Format("2006-01-02"),
			"amount":              retAmount,
			"principal_component": retPrincipal,
			"interest_component":  retInterest,
			"status":              retStatus,
			"created_at":          createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateLoanPaymentTool() mcp.Tool {
	return mcp.NewTool("update_loan_payment",
		mcp.WithDescription("Update a loan payment row (e.g. correct a typo, change a scheduled EMI to paid)."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Loan payment ID")),
		mcp.WithString("date", mcp.Description("Payment date YYYY-MM-DD")),
		mcp.WithNumber("amount", mcp.Description("Total amount (0 to leave unchanged)")),
		mcp.WithNumber("principal_component", mcp.Description("Principal portion (0 to leave unchanged)")),
		mcp.WithNumber("interest_component", mcp.Description("Interest portion (0 to leave unchanged)")),
		mcp.WithString("status", mcp.Description("Status: scheduled, paid, missed, partial")),
	)
}

func updateLoanPaymentHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		status := req.GetString("status", "")
		if status != "" {
			switch status {
			case "scheduled", "paid", "missed", "partial":
			default:
				return mcp.NewToolResultError("status must be one of: scheduled, paid, missed, partial"), nil
			}
		}
		date := req.GetString("date", "")
		amount := req.GetFloat("amount", 0)
		principal := req.GetFloat("principal_component", 0)
		interest := req.GetFloat("interest_component", 0)

		// Defence in depth: only update if the parent loan is owned by this user.
		var retID, retLoanID, retStatus, retAmount, retPrincipal, retInterest string
		var retDate time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE loan_payments lp SET
				date = COALESCE(NULLIF($2, '')::date, lp.date),
				amount = COALESCE(NULLIF($3, 0), lp.amount),
				principal_component = COALESCE(NULLIF($4, 0), lp.principal_component),
				interest_component = COALESCE(NULLIF($5, 0), lp.interest_component),
				status = COALESCE(NULLIF($6, '')::payment_status, lp.status)
			FROM loans l
			WHERE lp.id = $1 AND lp.loan_id = l.id AND l.user_id = $7 AND lp.deleted_at IS NULL
			RETURNING lp.id, lp.loan_id, lp.date, lp.amount, lp.principal_component, lp.interest_component, lp.status`,
			id, date, amount, principal, interest, status, userID,
		).Scan(&retID, &retLoanID, &retDate, &retAmount, &retPrincipal, &retInterest, &retStatus)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("loan payment %q not found (or loan not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                  retID,
			"loan_id":             retLoanID,
			"date":                retDate.Format("2006-01-02"),
			"amount":              retAmount,
			"principal_component": retPrincipal,
			"interest_component":  retInterest,
			"status":              retStatus,
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func markLoanPaymentPaidTool() mcp.Tool {
	return mcp.NewTool("mark_loan_payment_paid",
		mcp.WithDescription("Convenience: mark an existing scheduled loan payment as paid. Equivalent to update_loan_payment with status='paid' but with a single intent-revealing call."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Loan payment ID")),
	)
}

func markLoanPaymentPaidHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		var retID, retLoanID, retAmount, retPrincipal, retInterest, retStatus string
		var retDate time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE loan_payments lp SET status = 'paid'::payment_status
			FROM loans l
			WHERE lp.id = $1 AND lp.loan_id = l.id AND l.user_id = $2 AND lp.deleted_at IS NULL
			RETURNING lp.id, lp.loan_id, lp.date, lp.amount, lp.principal_component, lp.interest_component, lp.status`,
			id, userID,
		).Scan(&retID, &retLoanID, &retDate, &retAmount, &retPrincipal, &retInterest, &retStatus)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("loan payment %q not found (or loan not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                  retID,
			"loan_id":             retLoanID,
			"date":                retDate.Format("2006-01-02"),
			"amount":              retAmount,
			"principal_component": retPrincipal,
			"interest_component":  retInterest,
			"status":              retStatus,
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

// ============================================================================
// Group 6: insurance writes + payment tracking
// ============================================================================

func validPolicyType(t string) bool {
	switch t {
	case "life", "health", "vehicle", "property", "term", "other":
		return true
	}
	return false
}

func validPremiumFrequency(f string) bool {
	switch f {
	case "monthly", "quarterly", "annual":
		return true
	}
	return false
}

func createInsuranceTool() mcp.Tool {
	return mcp.NewTool("create_insurance",
		mcp.WithDescription("Create an insurance policy. policy_type is one of: life, health, vehicle, property, term, other. premium_frequency is monthly, quarterly, or annual. renewal_date is optional but useful for get_networth and 'upcoming renewals' queries."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Policy name (e.g. 'HDFC Life Click 2 Protect')")),
		mcp.WithString("policy_type", mcp.Required(), mcp.Description("Type: life, health, vehicle, property, term, other")),
		mcp.WithNumber("premium_amount", mcp.Required(), mcp.Description("Premium amount per period")),
		mcp.WithString("premium_frequency", mcp.Required(), mcp.Description("Frequency: monthly, quarterly, annual")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithString("start_date", mcp.Required(), mcp.Description("Policy start date YYYY-MM-DD")),
		mcp.WithString("provider", mcp.Description("Insurer name (e.g. 'HDFC Life')")),
		mcp.WithNumber("coverage_amount", mcp.Description("Sum insured / coverage amount")),
		mcp.WithString("end_date", mcp.Description("Policy end date YYYY-MM-DD")),
		mcp.WithString("renewal_date", mcp.Description("Next renewal date YYYY-MM-DD")),
		mcp.WithString("nominee", mcp.Description("Nominee name")),
		mcp.WithString("notes", mcp.Description("Free-form notes")),
	)
}

func createInsuranceHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		typ := req.GetString("policy_type", "")
		freq := req.GetString("premium_frequency", "")
		currency := req.GetString("currency", "")
		startDate := req.GetString("start_date", "")
		premium := req.GetFloat("premium_amount", -1)
		if name == "" || typ == "" || freq == "" || currency == "" || startDate == "" || premium < 0 {
			return mcp.NewToolResultError("name, policy_type, premium_amount, premium_frequency, currency, and start_date are required"), nil
		}
		if !validPolicyType(typ) {
			return mcp.NewToolResultError("invalid policy_type"), nil
		}
		if !validPremiumFrequency(freq) {
			return mcp.NewToolResultError("invalid premium_frequency"), nil
		}
		provider := req.GetString("provider", "")
		coverage := req.GetFloat("coverage_amount", 0)
		endDate := req.GetString("end_date", "")
		renewalDate := req.GetString("renewal_date", "")
		nominee := req.GetString("nominee", "")
		notes := req.GetString("notes", "")

		var id, retName, retType, retFreq, retCurrency string
		var retProvider, retNominee, retNotes *string
		var retPremium, retCoverage string
		var retStart time.Time
		var retEnd, retRenewal *time.Time
		var createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO insurance_policies
				(user_id, name, provider, policy_type, premium_amount, premium_frequency, coverage_amount,
				 currency, start_date, end_date, renewal_date, nominee, notes)
			VALUES
				($1, $2, NULLIF($3, ''), $4::policy_type, $5, $6::premium_frequency, NULLIF($7, 0),
				 $8, $9::date, NULLIF($10, '')::date, NULLIF($11, '')::date, NULLIF($12, ''), NULLIF($13, ''))
			RETURNING id, name, provider, policy_type, premium_amount, premium_frequency, coverage_amount,
			          currency, start_date, end_date, renewal_date, nominee, notes, created_at`,
			userID, name, provider, typ, premium, freq, coverage, currency, startDate, endDate, renewalDate, nominee, notes,
		).Scan(&id, &retName, &retProvider, &retType, &retPremium, &retFreq, &retCoverage, &retCurrency, &retStart, &retEnd, &retRenewal, &retNominee, &retNotes, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                id,
			"name":              retName,
			"provider":          retProvider,
			"policy_type":       retType,
			"premium_amount":    retPremium,
			"premium_frequency": retFreq,
			"coverage_amount":   retCoverage,
			"currency":          retCurrency,
			"start_date":        retStart.Format("2006-01-02"),
			"end_date":          retEnd,
			"renewal_date":      retRenewal,
			"nominee":           retNominee,
			"notes":             retNotes,
			"created_at":        createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateInsuranceTool() mcp.Tool {
	return mcp.NewTool("update_insurance",
		mcp.WithDescription("Update an insurance policy. id is required; other fields overwrite the stored value if provided. Pass empty string / 0 to clear optional fields."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Policy ID")),
		mcp.WithString("name", mcp.Description("Policy name")),
		mcp.WithString("policy_type", mcp.Description("Type: life, health, vehicle, property, term, other")),
		mcp.WithNumber("premium_amount", mcp.Description("Premium amount (0 to clear)")),
		mcp.WithString("premium_frequency", mcp.Description("Frequency: monthly, quarterly, annual")),
		mcp.WithString("currency", mcp.Description("Currency code")),
		mcp.WithString("start_date", mcp.Description("Start date YYYY-MM-DD")),
		mcp.WithString("provider", mcp.Description("Insurer name (empty to clear)")),
		mcp.WithNumber("coverage_amount", mcp.Description("Coverage amount (0 to clear)")),
		mcp.WithString("end_date", mcp.Description("End date YYYY-MM-DD (empty to clear)")),
		mcp.WithString("renewal_date", mcp.Description("Next renewal date YYYY-MM-DD (empty to clear)")),
		mcp.WithString("nominee", mcp.Description("Nominee name (empty to clear)")),
		mcp.WithString("notes", mcp.Description("Notes (empty to clear)")),
	)
}

func updateInsuranceHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		typ := req.GetString("policy_type", "")
		if typ != "" && !validPolicyType(typ) {
			return mcp.NewToolResultError("invalid policy_type"), nil
		}
		freq := req.GetString("premium_frequency", "")
		if freq != "" && !validPremiumFrequency(freq) {
			return mcp.NewToolResultError("invalid premium_frequency"), nil
		}
		name := req.GetString("name", "")
		premium := req.GetFloat("premium_amount", 0)
		currency := req.GetString("currency", "")
		startDate := req.GetString("start_date", "")
		provider := req.GetString("provider", "")
		coverage := req.GetFloat("coverage_amount", 0)
		endDate := req.GetString("end_date", "")
		renewalDate := req.GetString("renewal_date", "")
		nominee := req.GetString("nominee", "")
		notes := req.GetString("notes", "")

		var retID, retName, retType, retFreq, retCurrency string
		var retProvider, retNominee, retNotes *string
		var retPremium, retCoverage string
		var retStart time.Time
		var retEnd, retRenewal *time.Time
		var updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE insurance_policies SET
				name = COALESCE(NULLIF($2, ''), name),
				provider = NULLIF($3, ''),
				policy_type = COALESCE(NULLIF($4, '')::policy_type, policy_type),
				premium_amount = COALESCE(NULLIF($5, 0), premium_amount),
				premium_frequency = COALESCE(NULLIF($6, '')::premium_frequency, premium_frequency),
				coverage_amount = NULLIF($7, 0),
				currency = COALESCE(NULLIF($8, ''), currency),
				start_date = COALESCE(NULLIF($9, '')::date, start_date),
				end_date = NULLIF($10, '')::date,
				renewal_date = NULLIF($11, '')::date,
				nominee = NULLIF($12, ''),
				notes = NULLIF($13, ''),
				updated_at = now()
			WHERE id = $1 AND user_id = $14 AND deleted_at IS NULL
			RETURNING id, name, provider, policy_type, premium_amount, premium_frequency, coverage_amount,
			          currency, start_date, end_date, renewal_date, nominee, notes, updated_at`,
			id, name, provider, typ, premium, freq, coverage, currency, startDate, endDate, renewalDate, nominee, notes, userID,
		).Scan(&retID, &retName, &retProvider, &retType, &retPremium, &retFreq, &retCoverage, &retCurrency, &retStart, &retEnd, &retRenewal, &retNominee, &retNotes, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("policy %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                retID,
			"name":              retName,
			"provider":          retProvider,
			"policy_type":       retType,
			"premium_amount":    retPremium,
			"premium_frequency": retFreq,
			"coverage_amount":   retCoverage,
			"currency":          retCurrency,
			"start_date":        retStart.Format("2006-01-02"),
			"end_date":          retEnd,
			"renewal_date":      retRenewal,
			"nominee":           retNominee,
			"notes":             retNotes,
			"updated_at":        updatedAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteInsuranceTool() mcp.Tool {
	return mcp.NewTool("delete_insurance",
		mcp.WithDescription("Soft-delete an insurance policy. Premium payment history is kept."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Policy ID")),
	)
}

func deleteInsuranceHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE insurance_policies SET deleted_at = now(), updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("policy %q not found (or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

func createInsurancePaymentTool() mcp.Tool {
	return mcp.NewTool("create_insurance_payment",
		mcp.WithDescription("Record a premium payment against an insurance policy. Status defaults to 'paid'."),
		mcp.WithString("policy_id", mcp.Required(), mcp.Description("Policy ID")),
		mcp.WithString("date", mcp.Required(), mcp.Description("Payment date YYYY-MM-DD")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Amount paid")),
		mcp.WithString("status", mcp.Description("Status: paid, due, missed (default paid)")),
	)
}

func createInsurancePaymentHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		policyID := req.GetString("policy_id", "")
		date := req.GetString("date", "")
		amount := req.GetFloat("amount", -1)
		if policyID == "" || date == "" || amount < 0 {
			return mcp.NewToolResultError("policy_id, date, and amount are required"), nil
		}
		status := req.GetString("status", "paid")
		switch status {
		case "paid", "due", "missed":
		default:
			return mcp.NewToolResultError("status must be one of: paid, due, missed"), nil
		}

		var ownerCheck string
		if err := deps.Pool.QueryRow(ctx,
			`SELECT user_id::text FROM insurance_policies WHERE id = $1 AND deleted_at IS NULL`,
			policyID,
		).Scan(&ownerCheck); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("policy %q not found", policyID)), nil
		}
		if ownerCheck != userID {
			return mcp.NewToolResultError("policy not owned by you"), nil
		}

		var id, retStatus, retAmount string
		var retDate, createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO insurance_payments (policy_id, date, amount, status)
			VALUES ($1, $2::date, $3, $4::insurance_payment_status)
			RETURNING id, date, amount, status, created_at`,
			policyID, date, amount, status,
		).Scan(&id, &retDate, &retAmount, &retStatus, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":         id,
			"policy_id":  policyID,
			"date":       retDate.Format("2006-01-02"),
			"amount":     retAmount,
			"status":     retStatus,
			"created_at": createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func markInsurancePremiumPaidTool() mcp.Tool {
	return mcp.NewTool("mark_insurance_premium_paid",
		mcp.WithDescription("Convenience: mark a premium payment row as paid."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Insurance payment ID")),
	)
}

func markInsurancePremiumPaidHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		var retID, retPolicyID, retAmount, retStatus string
		var retDate time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE insurance_payments ip SET status = 'paid'::insurance_payment_status
			FROM insurance_policies p
			WHERE ip.id = $1 AND ip.policy_id = p.id AND p.user_id = $2 AND ip.deleted_at IS NULL
			RETURNING ip.id, ip.policy_id, ip.date, ip.amount, ip.status`,
			id, userID,
		).Scan(&retID, &retPolicyID, &retDate, &retAmount, &retStatus)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("payment %q not found (or policy not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":        retID,
			"policy_id": retPolicyID,
			"date":      retDate.Format("2006-01-02"),
			"amount":    retAmount,
			"status":    retStatus,
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

// ============================================================================
// Group 7: exchange rates + user profile
// ============================================================================

func getExchangeRatesTool() mcp.Tool {
	return mcp.NewTool("get_exchange_rates",
		mcp.WithDescription("List all stored exchange rates. Rates are user-specific in the sense that they're shared globally but each user can read and (via set_exchange_rate) update them. Use for converting per-currency amounts in get_networth."),
		readOnlyAnnotation(),
	)
}

func getExchangeRatesHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		rows, err := deps.Pool.Query(ctx,
			`SELECT base, target, rate, fetched_at
			FROM exchange_rates
			ORDER BY base, target`,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var base, target, rate string
			var fetchedAt time.Time
			if err := rows.Scan(&base, &target, &rate, &fetchedAt); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			results = append(results, map[string]any{
				"base":        base,
				"target":      target,
				"rate":        rate,
				"fetched_at":  fetchedAt.Format(time.RFC3339),
			})
		}
		data, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(data), nil
	}
}

func setExchangeRateTool() mcp.Tool {
	return mcp.NewTool("set_exchange_rate",
		mcp.WithDescription("Upsert an exchange rate: how many 'target' equal 1 'base'. E.g. base=USD, target=INR, rate=83.25 means 1 USD = 83.25 INR. Replaces any prior rate for the pair."),
		mcp.WithString("base", mcp.Required(), mcp.Description("Base currency (3-letter code, e.g. USD)")),
		mcp.WithString("target", mcp.Required(), mcp.Description("Target currency (3-letter code, e.g. INR)")),
		mcp.WithNumber("rate", mcp.Required(), mcp.Description("Rate: 1 base = rate target (must be > 0)")),
	)
}

func setExchangeRateHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		base := req.GetString("base", "")
		target := req.GetString("target", "")
		rate := req.GetFloat("rate", -1)
		if base == "" || target == "" || rate <= 0 {
			return mcp.NewToolResultError("base, target, and rate (>0) are required"), nil
		}
		_, err := deps.Pool.Exec(ctx,
			`INSERT INTO exchange_rates (base, target, rate, fetched_at)
			VALUES ($1, $2, $3, now())
			ON CONFLICT (base, target) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = EXCLUDED.fetched_at`,
			base, target, rate,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("upsert failed: %v", err)), nil
		}
		result := map[string]any{
			"base":       base,
			"target":     target,
			"rate":       fmt.Sprintf("%f", rate),
			"fetched_at": time.Now().UTC().Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateUserProfileTool() mcp.Tool {
	return mcp.NewTool("update_user_profile",
		mcp.WithDescription("Update the current user's profile (name, default_currency, timezone). default_currency is what get_networth reports in by default. Password / email changes are not exposed via MCP for safety — use the /api/v1/auth endpoints directly."),
		mcp.WithString("name", mcp.Description("Display name")),
		mcp.WithString("default_currency", mcp.Description("3-letter currency code, e.g. INR (this is the base currency for get_networth)")),
		mcp.WithString("timezone", mcp.Description("IANA timezone, e.g. Asia/Kolkata")),
	)
}

func updateUserProfileHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		currency := req.GetString("default_currency", "")
		timezone := req.GetString("timezone", "")

		var retName, retCurrency, retTimezone string
		var updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE users SET
				name = COALESCE(NULLIF($2, ''), name),
				default_currency = COALESCE(NULLIF($3, ''), default_currency),
				timezone = COALESCE(NULLIF($4, ''), timezone),
				updated_at = now()
			WHERE id = $1 AND deleted_at IS NULL
			RETURNING name, default_currency, timezone, updated_at`,
			userID, name, currency, timezone,
		).Scan(&retName, &retCurrency, &retTimezone, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError("user not found"), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":               userID,
			"name":             retName,
			"default_currency": retCurrency,
			"timezone":         retTimezone,
			"updated_at":       updatedAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

// ============================================================================
// Group A: savings goals CRUD
// ============================================================================

func validGoalStatus(s string) bool {
	switch s {
	case "active", "achieved", "abandoned":
		return true
	}
	return false
}

func listSavingsGoalsTool() mcp.Tool {
	return mcp.NewTool("list_savings_goals",
		mcp.WithDescription("List all savings goals (active and completed)."),
		readOnlyAnnotation(),
	)
}

func listSavingsGoalsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		rows, err := deps.Pool.Query(ctx,
			`SELECT id, name, description, target_amount, currency, current_amount,
			        linked_account_id, deadline, status, created_at, updated_at
			FROM savings_goals
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY created_at DESC`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, name, currency, status string
			var description *string
			var target, current string
			var linkedAccount *string
			var deadline *time.Time
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&id, &name, &description, &target, &currency, &current,
				&linkedAccount, &deadline, &status, &createdAt, &updatedAt); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			entry := map[string]any{
				"id":                id,
				"name":              name,
				"description":       description,
				"target_amount":     target,
				"currency":          currency,
				"current_amount":    current,
				"linked_account_id": linkedAccount,
				"status":            status,
				"created_at":        createdAt.Format(time.RFC3339),
				"updated_at":        updatedAt.Format(time.RFC3339),
			}
			if deadline != nil {
				entry["deadline"] = deadline.Format("2006-01-02")
			} else {
				entry["deadline"] = nil
			}
			results = append(results, entry)
		}
		data, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(data), nil
	}
}

func getSavingsGoalTool() mcp.Tool {
	return mcp.NewTool("get_savings_goal",
		mcp.WithDescription("Get a single savings goal by ID."),
		readOnlyAnnotation(),
		mcp.WithString("id", mcp.Required(), mcp.Description("Savings goal ID")),
	)
}

func getSavingsGoalHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		var retID, name, currency, status string
		var description *string
		var target, current string
		var linkedAccount *string
		var deadline *time.Time
		var createdAt, updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`SELECT id, name, description, target_amount, currency, current_amount,
			        linked_account_id, deadline, status, created_at, updated_at
			FROM savings_goals
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		).Scan(&retID, &name, &description, &target, &currency, &current,
			&linkedAccount, &deadline, &status, &createdAt, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("savings goal %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                retID,
			"name":              name,
			"description":       description,
			"target_amount":     target,
			"currency":          currency,
			"current_amount":    current,
			"linked_account_id": linkedAccount,
			"status":            status,
			"created_at":        createdAt.Format(time.RFC3339),
			"updated_at":        updatedAt.Format(time.RFC3339),
		}
		if deadline != nil {
			result["deadline"] = deadline.Format("2006-01-02")
		} else {
			result["deadline"] = nil
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func createSavingsGoalTool() mcp.Tool {
	return mcp.NewTool("create_savings_goal",
		mcp.WithDescription("Create a savings goal (e.g. 'Emergency fund 6L', 'Goa trip 1.5L'). current_amount defaults to 0; status defaults to 'active'. linked_account_id is optional (use when this goal is funded by a specific account)."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Goal name")),
		mcp.WithNumber("target_amount", mcp.Required(), mcp.Description("Target amount to save")),
		mcp.WithString("currency", mcp.Required(), mcp.Description("Currency code (e.g. INR)")),
		mcp.WithString("description", mcp.Description("Free-form description")),
		mcp.WithNumber("current_amount", mcp.Description("Current saved amount (default 0)")),
		mcp.WithString("deadline", mcp.Description("Target date YYYY-MM-DD")),
		mcp.WithString("linked_account_id", mcp.Description("Account that funds this goal (optional)")),
		mcp.WithString("status", mcp.Description("Status: active, achieved, abandoned (default active)")),
	)
}

func createSavingsGoalHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		name := req.GetString("name", "")
		currency := req.GetString("currency", "")
		target := req.GetFloat("target_amount", -1)
		if name == "" || currency == "" || target < 0 {
			return mcp.NewToolResultError("name, target_amount, and currency are required"), nil
		}
		description := req.GetString("description", "")
		current := req.GetFloat("current_amount", 0)
		deadline := req.GetString("deadline", "")
		linkedAccount := req.GetString("linked_account_id", "")
		status := req.GetString("status", "active")
		if !validGoalStatus(status) {
			return mcp.NewToolResultError("status must be one of: active, achieved, abandoned"), nil
		}

		var retID, retName, retCurrency, retStatus string
		var retDescription *string
		var retTarget, retCurrent string
		var retLinkedAccount *string
		var retDeadline *time.Time
		var createdAt, updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO savings_goals
				(user_id, name, description, target_amount, currency, current_amount, linked_account_id, deadline, status)
			VALUES
				($1, $2, NULLIF($3, ''), $4, $5, $6, NULLIF($7, '')::uuid, NULLIF($8, '')::date, $9::goal_status)
			RETURNING id, name, description, target_amount, currency, current_amount,
			          linked_account_id, deadline, status, created_at, updated_at`,
			userID, name, description, target, currency, current, linkedAccount, deadline, status,
		).Scan(&retID, &retName, &retDescription, &retTarget, &retCurrency, &retCurrent,
			&retLinkedAccount, &retDeadline, &retStatus, &createdAt, &updatedAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                retID,
			"name":              retName,
			"description":       retDescription,
			"target_amount":     retTarget,
			"currency":          retCurrency,
			"current_amount":    retCurrent,
			"linked_account_id": retLinkedAccount,
			"status":            retStatus,
			"created_at":        createdAt.Format(time.RFC3339),
			"updated_at":        updatedAt.Format(time.RFC3339),
		}
		if retDeadline != nil {
			result["deadline"] = retDeadline.Format("2006-01-02")
		} else {
			result["deadline"] = nil
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func updateSavingsGoalTool() mcp.Tool {
	return mcp.NewTool("update_savings_goal",
		mcp.WithDescription("Update a savings goal. id is required; other fields overwrite the stored value if provided. Pass empty string / 0 to clear optional fields."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Goal ID")),
		mcp.WithString("name", mcp.Description("Goal name")),
		mcp.WithNumber("target_amount", mcp.Description("Target amount (0 to clear)")),
		mcp.WithString("currency", mcp.Description("Currency code")),
		mcp.WithString("description", mcp.Description("Description (empty to clear)")),
		mcp.WithNumber("current_amount", mcp.Description("Current saved amount (0 to leave unchanged; pass a positive value to set)")),
		mcp.WithString("deadline", mcp.Description("Target date YYYY-MM-DD (empty to clear)")),
		mcp.WithString("linked_account_id", mcp.Description("Linked account ID (empty to clear)")),
		mcp.WithString("status", mcp.Description("Status: active, achieved, abandoned")),
	)
}

func updateSavingsGoalHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		status := req.GetString("status", "")
		if status != "" && !validGoalStatus(status) {
			return mcp.NewToolResultError("status must be one of: active, achieved, abandoned"), nil
		}
		name := req.GetString("name", "")
		currency := req.GetString("currency", "")
		description := req.GetString("description", "")
		target := req.GetFloat("target_amount", 0)
		current := req.GetFloat("current_amount", 0)
		deadline := req.GetString("deadline", "")
		linkedAccount := req.GetString("linked_account_id", "")

		var retID, retName, retCurrency, retStatus string
		var retDescription *string
		var retTarget, retCurrent string
		var retLinkedAccount *string
		var retDeadline *time.Time
		var updatedAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`UPDATE savings_goals SET
				name = COALESCE(NULLIF($2, ''), name),
				description = NULLIF($3, ''),
				target_amount = COALESCE(NULLIF($4, 0), target_amount),
				currency = COALESCE(NULLIF($5, ''), currency),
				current_amount = COALESCE(NULLIF($6, 0), current_amount),
				deadline = NULLIF($7, '')::date,
				linked_account_id = NULLIF($8, '')::uuid,
				status = COALESCE(NULLIF($9, '')::goal_status, status),
				updated_at = now()
			WHERE id = $1 AND user_id = $10 AND deleted_at IS NULL
			RETURNING id, name, description, target_amount, currency, current_amount,
			          linked_account_id, deadline, status, updated_at`,
			id, name, description, target, currency, current, deadline, linkedAccount, status, userID,
		).Scan(&retID, &retName, &retDescription, &retTarget, &retCurrency, &retCurrent,
			&retLinkedAccount, &retDeadline, &retStatus, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("savings goal %q not found (or not owned by you)", id)), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("update failed: %v", err)), nil
		}
		result := map[string]any{
			"id":                retID,
			"name":              retName,
			"description":       retDescription,
			"target_amount":     retTarget,
			"currency":          retCurrency,
			"current_amount":    retCurrent,
			"linked_account_id": retLinkedAccount,
			"status":            retStatus,
			"updated_at":        updatedAt.Format(time.RFC3339),
		}
		if retDeadline != nil {
			result["deadline"] = retDeadline.Format("2006-01-02")
		} else {
			result["deadline"] = nil
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteSavingsGoalTool() mcp.Tool {
	return mcp.NewTool("delete_savings_goal",
		mcp.WithDescription("Soft-delete a savings goal. Historical progress (current_amount at point of deletion) is kept."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Goal ID")),
	)
}

func deleteSavingsGoalHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE savings_goals SET deleted_at = now(), updated_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("savings goal %q not found (or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

// ============================================================================
// Group B: investment transactions (buy/sell/dividend/interest/bonus)
// ============================================================================

func validInvestmentTxType(t string) bool {
	switch t {
	case "buy", "sell", "dividend", "interest", "bonus":
		return true
	}
	return false
}

func listInvestmentTransactionsTool() mcp.Tool {
	return mcp.NewTool("list_investment_transactions",
		mcp.WithDescription("List transactions for a specific investment (buy/sell/dividend/interest/bonus). Pass investment_id to filter; pass no args only to get the per-investment summary across all holdings (slower)."),
		readOnlyAnnotation(),
		mcp.WithString("investment_id", mcp.Description("Filter by investment ID")),
		mcp.WithInteger("limit", mcp.Description("Max results (default 100)")),
	)
}

func listInvestmentTransactionsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		investmentID := req.GetString("investment_id", "")
		limit := req.GetInt("limit", 100)
		if limit <= 0 || limit > 1000 {
			limit = 100
		}

		var rows pgx.Rows
		if investmentID == "" {
			// Defence: only show tx for the caller's investments.
			rows, err = deps.Pool.Query(ctx,
				`SELECT it.id, it.investment_id, i.name AS investment_name, it.type,
				        it.quantity, it.price, it.amount, it.date, it.note, it.created_at
				FROM investment_transactions it
				JOIN investments i ON i.id = it.investment_id
				WHERE i.user_id = $1 AND it.deleted_at IS NULL
				ORDER BY it.date DESC, it.created_at DESC
				LIMIT $2`,
				userID, limit,
			)
		} else {
			rows, err = deps.Pool.Query(ctx,
				`SELECT it.id, it.investment_id, i.name AS investment_name, it.type,
				        it.quantity, it.price, it.amount, it.date, it.note, it.created_at
				FROM investment_transactions it
				JOIN investments i ON i.id = it.investment_id
				WHERE it.investment_id = $1 AND i.user_id = $2 AND it.deleted_at IS NULL
				ORDER BY it.date DESC, it.created_at DESC
				LIMIT $3`,
				investmentID, userID, limit,
			)
		}
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, invID, invName, typ string
			var quantity, price *string
			var amount string
			var date time.Time
			var note *string
			var createdAt time.Time
			if err := rows.Scan(&id, &invID, &invName, &typ, &quantity, &price, &amount, &date, &note, &createdAt); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			results = append(results, map[string]any{
				"id":              id,
				"investment_id":   invID,
				"investment_name": invName,
				"type":            typ,
				"quantity":        quantity,
				"price":           price,
				"amount":          amount,
				"date":            date.Format("2006-01-02"),
				"note":            note,
				"created_at":      createdAt.Format(time.RFC3339),
			})
		}
		data, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(data), nil
	}
}

func createInvestmentTransactionTool() mcp.Tool {
	return mcp.NewTool("create_investment_transaction",
		mcp.WithDescription("Record a buy / sell / dividend / interest / bonus transaction against an investment. amount is required; quantity and price are optional (useful for 'buy' and 'sell', not for 'dividend')."),
		mcp.WithString("investment_id", mcp.Required(), mcp.Description("Investment ID")),
		mcp.WithString("type", mcp.Required(), mcp.Description("Type: buy, sell, dividend, interest, bonus")),
		mcp.WithString("date", mcp.Required(), mcp.Description("Transaction date YYYY-MM-DD")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Total amount (positive for buy/dividend/interest/bonus; positive for sell as gross proceeds)")),
		mcp.WithNumber("quantity", mcp.Description("Units transacted (optional)")),
		mcp.WithNumber("price", mcp.Description("Price per unit (optional)")),
		mcp.WithString("note", mcp.Description("Free-form note")),
	)
}

func createInvestmentTransactionHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		investmentID := req.GetString("investment_id", "")
		typ := req.GetString("type", "")
		date := req.GetString("date", "")
		amount := req.GetFloat("amount", -1)
		if investmentID == "" || typ == "" || date == "" || amount < 0 {
			return mcp.NewToolResultError("investment_id, type, date, and amount are required"), nil
		}
		if !validInvestmentTxType(typ) {
			return mcp.NewToolResultError("invalid type. Must be one of: buy, sell, dividend, interest, bonus"), nil
		}
		quantity := req.GetFloat("quantity", 0)
		price := req.GetFloat("price", 0)
		note := req.GetString("note", "")

		// Defence in depth: only create tx for the caller's investments.
		var owner string
		if err := deps.Pool.QueryRow(ctx,
			`SELECT user_id::text FROM investments WHERE id = $1 AND deleted_at IS NULL`,
			investmentID,
		).Scan(&owner); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("investment %q not found", investmentID)), nil
		}
		if owner != userID {
			return mcp.NewToolResultError("investment not owned by you"), nil
		}

		var retID, retType string
		var retQuantity, retPrice *string
		var retAmount string
		var retDate time.Time
		var retNote *string
		var createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO investment_transactions
				(investment_id, type, quantity, price, amount, date, note)
			VALUES
				($1, $2::investment_tx_type, NULLIF($3, 0), NULLIF($4, 0), $5, $6::date, NULLIF($7, ''))
			RETURNING id, type, quantity, price, amount, date, note, created_at`,
			investmentID, typ, quantity, price, amount, date, note,
		).Scan(&retID, &retType, &retQuantity, &retPrice, &retAmount, &retDate, &retNote, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create failed: %v", err)), nil
		}
		result := map[string]any{
			"id":              retID,
			"investment_id":   investmentID,
			"type":            retType,
			"quantity":        retQuantity,
			"price":           retPrice,
			"amount":          retAmount,
			"date":            retDate.Format("2006-01-02"),
			"note":            retNote,
			"created_at":      createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteInvestmentTransactionTool() mcp.Tool {
	return mcp.NewTool("delete_investment_transaction",
		mcp.WithDescription("Soft-delete an investment transaction (e.g. you recorded a buy in error). The parent investment's quantity / current_value are NOT auto-recalculated — use update_investment to fix the running totals."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction ID")),
	)
}

func deleteInvestmentTransactionHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`UPDATE investment_transactions it SET deleted_at = now()
			FROM investments i
			WHERE it.id = $1 AND it.investment_id = i.id AND i.user_id = $2 AND it.deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("transaction %q not found (or investment not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	}
}

// ============================================================================
// Group C: bulk CSV import / export
//
// Mirrors the REST /api/import and /api/export handlers. The MCP versions
// take/return the CSV as a string rather than a multipart file, so an
// LLM agent can stream rows in / out as part of a single conversation.
// ============================================================================

func exportTransactionsTool() mcp.Tool {
	return mcp.NewTool("export_transactions",
		mcp.WithDescription("Export transactions to CSV (title, type, amount, currency, account, category, date, note, tags). Defaults to the last 30 days; pass from_date / to_date (YYYY-MM-DD) for a specific window. The response is a JSON object with 'csv' (the raw CSV content), 'row_count', and 'from'/'to'."),
		readOnlyAnnotation(),
		mcp.WithString("from_date", mcp.Description("Start date YYYY-MM-DD (default: 30 days ago)")),
		mcp.WithString("to_date", mcp.Description("End date YYYY-MM-DD (default: today)")),
	)
}

func exportTransactionsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		fromStr := req.GetString("from_date", "")
		toStr := req.GetString("to_date", "")

		var from, to time.Time
		if fromStr == "" {
			from = time.Now().AddDate(0, 0, -30)
		} else {
			from, err = time.Parse("2006-01-02", fromStr)
			if err != nil {
				return mcp.NewToolResultError("invalid from_date format, use YYYY-MM-DD"), nil
			}
		}
		if toStr == "" {
			to = time.Now()
		} else {
			to, err = time.Parse("2006-01-02", toStr)
			if err != nil {
				return mcp.NewToolResultError("invalid to_date format, use YYYY-MM-DD"), nil
			}
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT t.title, t.type, t.amount::text, t.currency, a.name, COALESCE(c.name, ''), t.date::text, COALESCE(t.note, ''), ''
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			LEFT JOIN categories c ON c.id = t.category_id
			WHERE t.user_id = $1 AND t.deleted_at IS NULL
			  AND t.date >= $2 AND t.date <= $3
			ORDER BY t.date DESC`,
			userID, from, to,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var buf bytes.Buffer
		w := csv.NewWriter(&buf)
		_ = w.Write([]string{"title", "type", "amount", "currency", "account", "category", "date", "note", "tags"})

		rowCount := 0
		for rows.Next() {
			var title, typ, amount, currency, account, category, date, note, tags *string
			if err := rows.Scan(&title, &typ, &amount, &currency, &account, &category, &date, &note, &tags); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			_ = w.Write([]string{
				derefStrPtr(title), derefStrPtr(typ), derefStrPtr(amount), derefStrPtr(currency),
				derefStrPtr(account), derefStrPtr(category), derefStrPtr(date),
				derefStrPtr(note), derefStrPtr(tags),
			})
			rowCount++
		}
		w.Flush()
		if err := w.Error(); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("csv write failed: %v", err)), nil
		}

		result := map[string]any{
			"csv":       buf.String(),
			"row_count": rowCount,
			"from":      from.Format("2006-01-02"),
			"to":        to.Format("2006-01-02"),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func importTransactionsTool() mcp.Tool {
	return mcp.NewTool("import_transactions",
		mcp.WithDescription("Bulk-import transactions from CSV. Required header columns: title, type, amount, currency, account, category, date, note (note is optional). Date formats accepted: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY. Unknown account names are auto-created as bank accounts. Returns {imported, skipped, errors: [...]} so the agent can fix problems and retry."),
		mcp.WithString("csv", mcp.Required(), mcp.Description("CSV content (first line must be the header)")),
	)
}

func importTransactionsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		csvContent := req.GetString("csv", "")
		if csvContent == "" {
			return mcp.NewToolResultError("csv is required"), nil
		}

		reader := csv.NewReader(strings.NewReader(csvContent))
		records, err := reader.ReadAll()
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to parse CSV: %v", err)), nil
		}
		if len(records) < 2 {
			return mcp.NewToolResultError("CSV must have at least a header and one row"), nil
		}

		headers := records[0]
		// Build header index map for tolerant ordering.
		headerIdx := map[string]int{}
		for i, h := range headers {
			headerIdx[strings.TrimSpace(strings.ToLower(h))] = i
		}
		col := func(row []string, name string) string {
			i, ok := headerIdx[name]
			if !ok || i >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[i])
		}

		// Pull existing accounts / categories once to avoid the N+1.
		accountRows, err := deps.Pool.Query(ctx,
			`SELECT id, name FROM accounts WHERE user_id = $1 AND deleted_at IS NULL`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("accounts query failed: %v", err)), nil
		}
		accountMap := map[string]string{}
		for accountRows.Next() {
			var id, name string
			if err := accountRows.Scan(&id, &name); err != nil {
				accountRows.Close()
				return mcp.NewToolResultError(fmt.Sprintf("account scan: %v", err)), nil
			}
			accountMap[name] = id
		}
		accountRows.Close()

		categoryRows, err := deps.Pool.Query(ctx,
			`SELECT id, name FROM categories WHERE user_id = $1 AND deleted_at IS NULL`,
			userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("categories query failed: %v", err)), nil
		}
		categoryMap := map[string]string{}
		for categoryRows.Next() {
			var id, name string
			if err := categoryRows.Scan(&id, &name); err != nil {
				categoryRows.Close()
				return mcp.NewToolResultError(fmt.Sprintf("category scan: %v", err)), nil
			}
			categoryMap[name] = id
		}
		categoryRows.Close()

		var imported, skipped int
		var errors []string

		for i, row := range records[1:] {
			rowNum := i + 2 // header is row 1
			title := col(row, "title")
			amountStr := col(row, "amount")
			txType := col(row, "type")
			currency := col(row, "currency")
			dateStr := col(row, "date")
			accountName := col(row, "account")
			categoryName := col(row, "category")
			note := col(row, "note")

			if title == "" || amountStr == "" || txType == "" || dateStr == "" || accountName == "" {
				skipped++
				errors = append(errors, fmt.Sprintf("row %d: missing required field (title/type/amount/date/account)", rowNum))
				continue
			}

			// Account — auto-create if not found.
			accountID, ok := accountMap[accountName]
			if !ok {
				txCurrency := currency
				if txCurrency == "" {
					txCurrency = "INR"
				}
				var newID string
				err := deps.Pool.QueryRow(ctx,
					`INSERT INTO accounts (user_id, name, type, currency, opening_balance)
					VALUES ($1, $2, 'bank'::account_type, $3, 0)
					RETURNING id`,
					userID, accountName, txCurrency,
				).Scan(&newID)
				if err != nil {
					errors = append(errors, fmt.Sprintf("row %d: failed to create account %q: %v", rowNum, accountName, err))
					skipped++
					continue
				}
				accountID = newID
				accountMap[accountName] = newID
			}

			// Category — optional.
			var categoryID *string
			if categoryName != "" {
				if cid, ok := categoryMap[categoryName]; ok {
					categoryID = &cid
				}
			}

			// Amount.
			amount, err := strconv.ParseFloat(amountStr, 64)
			if err != nil {
				errors = append(errors, fmt.Sprintf("row %d: invalid amount %q: %v", rowNum, amountStr, err))
				skipped++
				continue
			}

			// Date — try multiple formats.
			var txDate time.Time
			parsed, perr := time.Parse("2006-01-02", dateStr)
			if perr != nil {
				parsed, perr = time.Parse("02/01/2006", dateStr)
			}
			if perr != nil {
				parsed, perr = time.Parse("01/02/2006", dateStr)
			}
			if perr != nil {
				errors = append(errors, fmt.Sprintf("row %d: invalid date %q (use YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY)", rowNum, dateStr))
				skipped++
				continue
			}
			txDate = parsed

			// Type.
			switch txType {
			case "income", "expense", "transfer", "credit_payment":
			default:
				errors = append(errors, fmt.Sprintf("row %d: invalid type %q (must be income/expense/transfer/credit_payment)", rowNum, txType))
				skipped++
				continue
			}

			txCurrency := currency
			if txCurrency == "" {
				txCurrency = "INR"
			}

			var newID string
			err = deps.Pool.QueryRow(ctx,
				`INSERT INTO transactions
					(user_id, account_id, type, amount, currency, category_id, title, note, date)
				VALUES
					($1, $2::uuid, $3::transaction_type, $4, $5,
					 NULLIF($6, '')::uuid, NULLIF($7, ''), NULLIF($8, ''), $9::date)
				RETURNING id`,
				userID, accountID, txType, amount, txCurrency,
				derefStrPtr(categoryID), title, note, txDate,
			).Scan(&newID)
			if err != nil {
				errors = append(errors, fmt.Sprintf("row %d: insert failed: %v", rowNum, err))
				skipped++
				continue
			}
			imported++
		}

		result := map[string]any{
			"imported": imported,
			"skipped":  skipped,
			"errors":   errors,
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func derefStrPtr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
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

// ============================================================================
// Net-worth snapshots (Task 1: "make MCP the no-hiccups net-worth tool")
//
// snapshot_networth writes the current get_networth result to a row.
// list_networth_snapshots returns the history.
// get_networth_trend summarises the change over a window (default 30d).
// delete_networth_snapshot removes one (snapshots are ephemeral metrics,
// not financial records, so this is a hard DELETE — not soft).
// ============================================================================

func snapshotNetworthTool() mcp.Tool {
	return mcp.NewTool("snapshot_networth",
		mcp.WithDescription("Take a snapshot of the current net worth and persist it. Returns the snapshot id, the totals, and the as-of timestamp. Use list_networth_snapshots afterwards to see history; use get_networth_trend for a percentage change over a window."),
		readOnlyAnnotation(), // a snapshot is a passive observation, not a mutation of financial data
		mcp.WithString("base_currency", mcp.Description("Override the user's default currency (defaults to users.default_currency)")),
		mcp.WithString("note", mcp.Description("Optional free-form note (e.g. 'end of Q3 2024')")),
	)
}

func snapshotNetworthHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
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

		result, err := computeNetworth(ctx, deps.Pool, userID, baseCurrency)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("compute networth: %v", err)), nil
		}

		breakdown, err := json.Marshal(map[string]any{
			"breakdown":                result.Breakdown,
			"components":               result.Components,
			"unconverted_currencies":   result.UnconvertedCurrencies,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal breakdown: %v", err)), nil
		}
		note := req.GetString("note", "")

		var id string
		var asOf time.Time
		err = deps.Pool.QueryRow(ctx,
			`INSERT INTO networth_snapshots
				(user_id, as_of, currency, total_assets, total_liabilities, net_worth, breakdown, note)
			VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7::jsonb, NULLIF($8, ''))
			RETURNING id, as_of`,
			userID, result.AsOf, result.Currency, result.TotalAssets, result.TotalLiabilities, result.NetWorth, breakdown, note,
		).Scan(&id, &asOf)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("insert snapshot: %v", err)), nil
		}

		resp := map[string]any{
			"id":                id,
			"as_of":             asOf.UTC().Format(time.RFC3339),
			"currency":          result.Currency,
			"net_worth":         result.NetWorth,
			"total_assets":      result.TotalAssets,
			"total_liabilities": result.TotalLiabilities,
			"unconverted_currencies": result.UnconvertedCurrencies,
		}
		data, _ := json.Marshal(resp)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func listNetworthSnapshotsTool() mcp.Tool {
	return mcp.NewTool("list_networth_snapshots",
		mcp.WithDescription("List historical net-worth snapshots, newest first. Each row carries the totals at the as-of timestamp and the full breakdown JSON."),
		readOnlyAnnotation(),
		mcp.WithString("from_date", mcp.Description("Filter: only snapshots on or after this date (YYYY-MM-DD)")),
		mcp.WithString("to_date", mcp.Description("Filter: only snapshots on or before this date (YYYY-MM-DD)")),
		mcp.WithInteger("limit", mcp.Description("Max results (default 100, max 1000)")),
	)
}

func listNetworthSnapshotsHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		fromDate := req.GetString("from_date", "")
		toDate := req.GetString("to_date", "")
		limit := req.GetInt("limit", 100)
		if limit <= 0 || limit > 1000 {
			limit = 100
		}

		rows, err := deps.Pool.Query(ctx,
			`SELECT id, as_of, currency, total_assets, total_liabilities, net_worth, breakdown, note
			FROM networth_snapshots
			WHERE user_id = $1
			  AND ($2 = '' OR as_of >= $2::timestamptz)
			  AND ($3 = '' OR as_of <= $3::timestamptz)
			ORDER BY as_of DESC
			LIMIT $4`,
			userID, fromDate, toDate, limit,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("query failed: %v", err)), nil
		}
		defer rows.Close()

		var results []map[string]any
		for rows.Next() {
			var id, currency string
			var asOf time.Time
			var totalAssets, totalLiabilities, netWorth string
			var breakdown []byte
			var note *string
			if err := rows.Scan(&id, &asOf, &currency, &totalAssets, &totalLiabilities, &netWorth, &breakdown, &note); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("scan failed: %v", err)), nil
			}
			entry := map[string]any{
				"id":                id,
				"as_of":             asOf.UTC().Format(time.RFC3339),
				"currency":          currency,
				"net_worth":         netWorth,
				"total_assets":      totalAssets,
				"total_liabilities": totalLiabilities,
				"breakdown":         json.RawMessage(breakdown),
				"note":              note,
			}
			results = append(results, entry)
		}
		data, err := marshalAsJSONArray(results)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(data), nil
	}
}

func getNetworthTrendTool() mcp.Tool {
	return mcp.NewTool("get_networth_trend",
		mcp.WithDescription("Compute the change in net worth over a window. Returns current_net_worth, baseline_net_worth (the oldest snapshot within the window, or '0' if none), absolute_change, percent_change, and snapshots_in_window. Pass days (default 30) or from_date/to_date."),
		readOnlyAnnotation(),
		mcp.WithInteger("days", mcp.Description("Window size in days ending today (default 30). Ignored if from_date is set.")),
		mcp.WithString("from_date", mcp.Description("Window start (YYYY-MM-DD). Defaults to today - days.")),
		mcp.WithString("to_date", mcp.Description("Window end (YYYY-MM-DD). Defaults to today.")),
		mcp.WithString("base_currency", mcp.Description("Override the user's default currency (defaults to users.default_currency)")),
	)
}

func getNetworthTrendHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

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

		// Resolve the window. to_date defaults to now; from_date
		// defaults to (now - days).
		now := time.Now().UTC()
		toDate := req.GetString("to_date", "")
		fromDate := req.GetString("from_date", "")
		if toDate == "" {
			toDate = now.Format("2006-01-02")
		}
		if fromDate == "" {
			days := req.GetInt("days", 30)
			if days <= 0 {
				days = 30
			}
			fromDate = now.AddDate(0, 0, -days).Format("2006-01-02")
		}

		// Current value.
		current, err := computeNetworth(ctx, deps.Pool, userID, baseCurrency)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("compute current: %v", err)), nil
		}

		// Find the oldest snapshot within the window.
		var baselineNetWorth string
		var snapshotsInWindow int
		err = deps.Pool.QueryRow(ctx,
			`SELECT net_worth, (
				SELECT count(*) FROM networth_snapshots
				WHERE user_id = $1
				  AND as_of >= $2::timestamptz
				  AND as_of <= ($3::date || 'T23:59:59Z')::timestamptz
			) FROM networth_snapshots
			WHERE user_id = $1
			  AND as_of >= $2::timestamptz
			  AND as_of <= ($3::date || 'T23:59:59Z')::timestamptz
			ORDER BY as_of ASC
			LIMIT 1`,
			userID, fromDate, toDate,
		).Scan(&baselineNetWorth, &snapshotsInWindow)
		if err != nil {
			if err != pgx.ErrNoRows {
				return mcp.NewToolResultError(fmt.Sprintf("baseline query: %v", err)), nil
			}
			baselineNetWorth = "0"
			snapshotsInWindow = 0
		}

		absoluteChange := addDecimalStrings(current.NetWorth, negate(baselineNetWorth))
		var pctChange *string
		if baseline, err := strconv.ParseFloat(baselineNetWorth, 64); err == nil && baseline != 0 {
			if cur, err := strconv.ParseFloat(current.NetWorth, 64); err == nil {
				pct := (cur - baseline) / baseline * 100
				s := formatDecimal(pct)
				pctChange = &s
			}
		}

		result := map[string]any{
			"from":               fromDate,
			"to":                 toDate,
			"currency":           baseCurrency,
			"current_net_worth":  current.NetWorth,
			"baseline_net_worth": baselineNetWorth,
			"absolute_change":    absoluteChange,
			"snapshots_in_window": snapshotsInWindow,
		}
		if pctChange != nil {
			result["percent_change"] = pctChange
		} else {
			result["percent_change"] = nil
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

func deleteNetworthSnapshotTool() mcp.Tool {
	return mcp.NewTool("delete_networth_snapshot",
		mcp.WithDescription("Delete a net-worth snapshot row. Hard DELETE — snapshots are not financial records, so there's no audit need for soft-delete."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Snapshot ID")),
	)
}

func deleteNetworthSnapshotHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id := req.GetString("id", "")
		if id == "" {
			return mcp.NewToolResultError("id is required"), nil
		}
		tag, err := deps.Pool.Exec(ctx,
			`DELETE FROM networth_snapshots WHERE id = $1 AND user_id = $2`,
			id, userID,
		)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete failed: %v", err)), nil
		}
		if tag.RowsAffected() == 0 {
			return mcp.NewToolResultError(fmt.Sprintf("snapshot %q not found (or not owned by you)", id)), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
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

		result, err := computeNetworth(ctx, deps.Pool, userID, baseCurrency)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		data, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("marshal failed: %v", err)), nil
		}
		return mcp.NewToolResultText(string(data)), nil
	}
}

// fxRateKey is the canonical key into the in-memory rates cache.
// "USD/INR" means "1 USD = rate INR".
type fxRateKey struct{ base, target string }

// loadFXRates pulls the entire exchange_rates table into a map for O(1)
// per-row lookup during net worth aggregation. The table is small
// (one row per currency pair) so this is fine.
func loadFXRates(ctx context.Context, pool *pgxpool.Pool) (map[fxRateKey]float64, error) {
	rows, err := pool.Query(ctx, `SELECT base, target, rate FROM exchange_rates`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[fxRateKey]float64{}
	for rows.Next() {
		var base, target, rateStr string
		if err := rows.Scan(&base, &target, &rateStr); err != nil {
			return nil, err
		}
		rate, err := strconv.ParseFloat(rateStr, 64)
		if err != nil || rate <= 0 {
			continue
		}
		out[fxRateKey{base, target}] = rate
	}
	return out, nil
}

// convertAmount converts a numeric(18,4) string from native currency to
// base currency. Returns (converted, true) if a direct or inverse rate
// was found, or (original, false) if no rate exists (the agent should
// still see the row in the per-currency breakdown).
func convertAmount(amountStr, nativeCurrency, baseCurrency string, rates map[fxRateKey]float64) (string, bool) {
	if nativeCurrency == baseCurrency {
		return amountStr, true
	}
	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return "0", false
	}
	if rate, ok := rates[fxRateKey{nativeCurrency, baseCurrency}]; ok {
		return formatDecimal(amount * rate), true
	}
	if rate, ok := rates[fxRateKey{baseCurrency, nativeCurrency}]; ok {
		// inverse: amount_native = amount_base / rate
		return formatDecimal(amount / rate), true
	}
	return amountStr, false
}

// networthResult is the shape returned by computeNetworth and stored
// (as JSON) in the networth_snapshots table.
type networthResult struct {
	AsOf             string         `json:"as_of"`
	Currency         string         `json:"currency"`
	NetWorth         string         `json:"net_worth"`
	TotalAssets      string         `json:"total_assets"`
	TotalLiabilities string         `json:"total_liabilities"`
	Breakdown        map[string]any `json:"breakdown"`
	Components       map[string]any `json:"components"`
	// Diagnostic: which native currencies were not converted to base.
	// Helps the agent (and the user) know when set_exchange_rate is
	// needed to get an accurate number.
	UnconvertedCurrencies []string `json:"unconverted_currencies,omitempty"`
}

// computeNetworth is the canonical net-worth computation. Used by
// get_networth (read-only) and snapshot_networth (writes a row). All
// per-row amounts are converted to baseCurrency via the exchange_rates
// table; rows whose native currency is unknown fall through to the
// per-currency breakdown so they're still visible.
func computeNetworth(ctx context.Context, pool *pgxpool.Pool, userID, baseCurrency string) (*networthResult, error) {
	rates, err := loadFXRates(ctx, pool)
	if err != nil {
		return nil, fmt.Errorf("load fx rates: %w", err)
	}

	// --- ASSETS: bank/wallet/cash/savings accounts (positive balance) ---
	// --- LIABILITIES: credit_card accounts (positive balance = owed) ---
	accountRows, err := pool.Query(ctx,
		`SELECT id, name, type, currency, opening_balance, credit_limit
		FROM accounts
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY type, name`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("accounts query failed: %w", err)
	}
	defer accountRows.Close()

	accounts := []map[string]any{}
	assetsByType := map[string]string{
		"bank": "0", "wallet": "0", "cash": "0", "savings": "0", "investment": "0",
	}
	liabilitiesByType := map[string]string{
		"credit_card": "0",
	}
	// Per-native-currency subtotals (in base currency, after conversion).
	// Lets the agent audit "what got counted" at a glance.
	byCurrencyAssets := map[string]string{}
	byCurrencyLiabilities := map[string]string{}
	unconvertedSet := map[string]bool{}
	var totalAssets, totalLiabilities string

	for accountRows.Next() {
		var id, name, typ, currency, openingBalance string
		var creditLimit *string
		if err := accountRows.Scan(&id, &name, &typ, &currency, &openingBalance, &creditLimit); err != nil {
			return nil, fmt.Errorf("account scan failed: %w", err)
		}
		accounts = append(accounts, map[string]any{
			"id":              id,
			"name":            name,
			"type":            typ,
			"currency":        currency,
			"opening_balance": openingBalance,
			"credit_limit":    creditLimit,
		})

		converted, ok := convertAmount(openingBalance, currency, baseCurrency, rates)
		if !ok {
			unconvertedSet[currency] = true
		}

		if typ == "credit_card" {
			liabilitiesByType["credit_card"] = addDecimalStrings(liabilitiesByType["credit_card"], converted)
			byCurrencyLiabilities[currency] = addDecimalStrings(byCurrencyLiabilities[currency], converted)
		} else {
			assetsByType[typ] = addDecimalStrings(assetsByType[typ], converted)
			byCurrencyAssets[currency] = addDecimalStrings(byCurrencyAssets[currency], converted)
		}
	}

	for _, v := range assetsByType {
		totalAssets = addDecimalStrings(totalAssets, v)
	}
	for _, v := range liabilitiesByType {
		totalLiabilities = addDecimalStrings(totalLiabilities, v)
	}

	// --- ASSETS: investments (quantity * current_price, converted) ---
	investmentRows, err := pool.Query(ctx,
		`SELECT id, name, asset_type, currency, quantity, current_price,
		        COALESCE(quantity, 0) * COALESCE(current_price, 0) AS computed_value
		FROM investments
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("investments query failed: %w", err)
	}
	defer investmentRows.Close()

	investments := []map[string]any{}
	investmentsByType := map[string]string{}
	var totalInvestments string

	for investmentRows.Next() {
		var id, name, assetType, currency string
		var quantity, currentPrice, computedValue *string
		if err := investmentRows.Scan(&id, &name, &assetType, &currency, &quantity, &currentPrice, &computedValue); err != nil {
			return nil, fmt.Errorf("investment scan failed: %w", err)
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
		nativeValue := derefStr(computedValue)
		converted, ok := convertAmount(nativeValue, currency, baseCurrency, rates)
		if !ok {
			unconvertedSet[currency] = true
		}
		investmentsByType[assetType] = addDecimalStrings(investmentsByType[assetType], converted)
		totalInvestments = addDecimalStrings(totalInvestments, converted)
		byCurrencyAssets[currency] = addDecimalStrings(byCurrencyAssets[currency], converted)
	}
	totalAssets = addDecimalStrings(totalAssets, totalInvestments)

	// --- LIABILITIES: loans (outstanding_balance, converted) ---
	loanRows, err := pool.Query(ctx,
		`SELECT id, name, loan_type, currency, COALESCE(outstanding_balance, 0) AS outstanding
		FROM loans
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("loans query failed: %w", err)
	}
	defer loanRows.Close()

	loans := []map[string]any{}
	loansByType := map[string]string{}
	var totalLoans string

	for loanRows.Next() {
		var id, name, loanType, currency, outstanding string
		if err := loanRows.Scan(&id, &name, &loanType, &currency, &outstanding); err != nil {
			return nil, fmt.Errorf("loan scan failed: %w", err)
		}
		loans = append(loans, map[string]any{
			"id":                  id,
			"name":                name,
			"loan_type":           loanType,
			"currency":            currency,
			"outstanding_balance": outstanding,
		})
		converted, ok := convertAmount(outstanding, currency, baseCurrency, rates)
		if !ok {
			unconvertedSet[currency] = true
		}
		loansByType[loanType] = addDecimalStrings(loansByType[loanType], converted)
		totalLoans = addDecimalStrings(totalLoans, converted)
		byCurrencyLiabilities[currency] = addDecimalStrings(byCurrencyLiabilities[currency], converted)
	}
	totalLiabilities = addDecimalStrings(totalLiabilities, totalLoans)

	netWorth := addDecimalStrings(totalAssets, negate(totalLiabilities))

	unconverted := make([]string, 0, len(unconvertedSet))
	for c := range unconvertedSet {
		unconverted = append(unconverted, c)
	}
	sort.Strings(unconverted) // stable for tests

	return &networthResult{
		AsOf:             time.Now().UTC().Format(time.RFC3339),
		Currency:         baseCurrency,
		NetWorth:         netWorth,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		Breakdown: map[string]any{
			"assets": map[string]any{
				"by_type":           assetsByType,
				"by_type_investments": investmentsByType,
				"investments_total": totalInvestments,
				"by_currency":       byCurrencyAssets,
			},
			"liabilities": map[string]any{
				"by_type":         liabilitiesByType,
				"by_type_loans":   loansByType,
				"loans_total":     totalLoans,
				"by_currency":     byCurrencyLiabilities,
			},
		},
		Components: map[string]any{
			"accounts":    accounts,
			"investments": investments,
			"loans":       loans,
		},
		UnconvertedCurrencies: unconverted,
	}, nil
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
