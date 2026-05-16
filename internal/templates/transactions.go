package templates

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// TransactionsPageData holds all data for the transactions page.
type TransactionsPageData struct {
	Transactions []TransactionRow
	Accounts     []AccountOption
	Categories   []CategoryOption
	Filters      TransactionFilters
	Count        int
	HasMore      bool
}

// TransactionRow is a display-friendly transaction.
type TransactionRow struct {
	ID            string
	DateFormatted string
	DateISO       string
	Title         string
	Note          string
	Type          string
	Amount        float64
	Currency      string
	CategoryName  string
	CategoryColor string
	AccountName   string
}

// AccountOption for dropdowns.
type AccountOption struct {
	ID       string
	Name     string
	Currency string
}

// CategoryOption for dropdowns.
type CategoryOption struct {
	ID    string
	Name  string
	Color string
}

// TransactionFilters holds the current filter state.
type TransactionFilters struct {
	Type       string
	AccountID  string
	CategoryID string
	FromDate   string
	ToDate     string
	Search     string
	Page       int
}

// TransactionsPage renders the transactions list with filters.
func (ph *PageHandlers) TransactionsPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Transactions")
	td := ph.fetchTransactionsData(r.Context(), claims.UserID, r.URL.Query())
	data.Data = td
	RenderPage(w, "transactions", data)
}

func (ph *PageHandlers) fetchTransactionsData(ctx context.Context, userID string, qs map[string][]string) TransactionsPageData {
	userUUID := parseUUID(userID)

	td := TransactionsPageData{
		Filters: TransactionFilters{
			Type:       first(qs, "type"),
			AccountID:  first(qs, "account_id"),
			CategoryID: first(qs, "category_id"),
			FromDate:   first(qs, "from_date"),
			ToDate:     first(qs, "to_date"),
			Search:     first(qs, "search"),
		},
	}

	if p := first(qs, "page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			td.Filters.Page = n
		}
	}
	if td.Filters.Page < 1 {
		td.Filters.Page = 1
	}

	perPage := 25

	// Fetch accounts and categories for dropdowns
	if accts, err := ph.q.ListAccountsByUser(ctx, userUUID); err == nil {
		for _, a := range accts {
			td.Accounts = append(td.Accounts, AccountOption{
				ID:       pgUUIDToString(a.ID),
				Name:     a.Name,
				Currency: a.Currency,
			})
		}
	}
	if cats, err := ph.q.ListCategoriesByUser(ctx, userUUID); err == nil {
		for _, c := range cats {
			td.Categories = append(td.Categories, CategoryOption{
				ID:    pgUUIDToString(c.ID),
				Name:  c.Name,
				Color: c.Color.String,
			})
		}
	}

	// Build filters for the query
	var typeFilter pgtype.Text
	if td.Filters.Type != "" {
		typeFilter = pgtype.Text{String: td.Filters.Type, Valid: true}
	}

	var accountFilter pgtype.UUID
	if td.Filters.AccountID != "" {
		accountFilter = parseUUID(td.Filters.AccountID)
	}

	var fromDate pgtype.Date
	if td.Filters.FromDate != "" {
		if t, err := time.Parse("2006-01-02", td.Filters.FromDate); err == nil {
			fromDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	var toDate pgtype.Date
	if td.Filters.ToDate != "" {
		if t, err := time.Parse("2006-01-02", td.Filters.ToDate); err == nil {
			toDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	// Fetch one extra to detect HasMore
	limitRows := pgtype.Int4{Int32: int32(perPage + 1), Valid: true}

	txns, err := ph.q.ListTransactionsByUser(ctx, db.ListTransactionsByUserParams{
		UserID:    userUUID,
		Type:      typeFilter,
		AccountID: accountFilter,
		FromDate:  fromDate,
		ToDate:    toDate,
		LimitRows: limitRows,
	})
	if err != nil {
		return td
	}

	// Check if there are more
	if len(txns) > perPage {
		td.HasMore = true
		txns = txns[:perPage]
	}

	for _, t := range txns {
		amt, _ := t.Amount.Float64Value()
		amount := 0.0
		if amt.Valid {
			amount = amt.Float64
		}

		catName := ""
		if t.CategoryName.Valid {
			catName = t.CategoryName.String
		}

		title := ""
		if t.Title.Valid {
			title = t.Title.String
		}

		dateFormatted := ""
		dateISO := ""
		if t.Date.Valid {
			dateFormatted = t.Date.Time.Format("Jan 2, 2006")
			dateISO = t.Date.Time.Format("2006-01-02")
		}

		// Apply search filter client-side (post-query) for title/category/account
		if td.Filters.Search != "" {
			search := strings.ToLower(td.Filters.Search)
			if !strings.Contains(strings.ToLower(title), search) &&
				!strings.Contains(strings.ToLower(catName), search) &&
				!strings.Contains(strings.ToLower(t.AccountName), search) {
				continue
			}
		}

		td.Transactions = append(td.Transactions, TransactionRow{
			ID:            pgUUIDToString(t.ID),
			DateFormatted: dateFormatted,
			DateISO:       dateISO,
			Title:         title,
			Type:          string(t.Type),
			Amount:        math.Round(amount*100) / 100,
			Currency:      t.Currency,
			CategoryName:  catName,
			AccountName:   t.AccountName,
		})
		td.Count++
	}

	return td
}

// CreateTransaction handles the form submission to add a new transaction.
func (ph *PageHandlers) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	userUUID := parseUUID(claims.UserID)
	accountUUID := parseUUID(r.FormValue("account_id"))
	txType := r.FormValue("type")
	amountStr := r.FormValue("amount")
	currency := r.FormValue("currency")
	title := r.FormValue("title")
	dateStr := r.FormValue("date")
	categoryUUID := parseUUID(r.FormValue("category_id"))

	if !accountUUID.Valid || txType == "" || amountStr == "" || dateStr == "" {
		SetFlash(w, "error", "Account, type, amount, and date are required")
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		SetFlash(w, "error", "Invalid date format")
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amount <= 0 {
		SetFlash(w, "error", "Invalid amount")
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	var txnType db.TransactionType
	switch strings.ToLower(txType) {
	case "income":
		txnType = db.TransactionTypeIncome
	case "expense":
		txnType = db.TransactionTypeExpense
	default:
		SetFlash(w, "error", fmt.Sprintf("Invalid type: %s (must be income or expense)", txType))
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	var amt pgtype.Numeric
	_ = amt.Scan(fmt.Sprint(amount))
	amt.Valid = true

	if currency == "" {
		currency = "USD"
	}

	_, err = ph.q.CreateTransaction(r.Context(), db.CreateTransactionParams{
		UserID:     userUUID,
		AccountID:  accountUUID,
		Type:       txnType,
		Amount:     amt,
		Currency:   currency,
		CategoryID: categoryUUID,
		Title:      pgtype.Text{String: title, Valid: title != ""},
		Date:       pgtype.Date{Time: parsedDate, Valid: true},
	})
	if err != nil {
		SetFlash(w, "error", "Failed to create transaction")
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	SetFlash(w, "success", "Transaction added")
	http.Redirect(w, r, "/transactions", http.StatusSeeOther)
}

// DeleteTransaction handles transaction deletion.
func (ph *PageHandlers) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	txnID := r.FormValue("id")
	if txnID == "" {
		SetFlash(w, "error", "Missing transaction ID")
		http.Redirect(w, r, "/transactions", http.StatusSeeOther)
		return
	}

	userUUID := parseUUID(claims.UserID)
	txnUUID := parseUUID(txnID)

	err := ph.q.DeleteTransaction(r.Context(), db.DeleteTransactionParams{
		ID:     txnUUID,
		UserID: userUUID,
	})
	if err != nil {
		SetFlash(w, "error", "Transaction not found")
	} else {
		SetFlash(w, "success", "Transaction deleted")
	}
	http.Redirect(w, r, "/transactions", http.StatusSeeOther)
}

func parseUUID(s string) pgtype.UUID {
	parsed, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}
}

func pgUUIDToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	val, _ := id.Value()
	if val == nil {
		return ""
	}
	return fmt.Sprintf("%v", val)
}

func first(m map[string][]string, key string) string {
	vals := m[key]
	if len(vals) == 0 {
		return ""
	}
	return vals[0]
}
