package templates

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/jackc/pgx/v5/pgtype"
)

// AccountRow for display.
type AccountRow struct {
	ID             string
	Name           string
	Type           string
	Currency       string
	Balance        float64
	OpeningBalance float64
	CreditLimit    string
	CreatedAt      string
}

// BudgetRow for display.
type BudgetRow struct {
	ID            string
	Name          string
	CategoryName  string
	CategoryColor string
	Amount        float64
	Currency      string
	PeriodType    string
	StartDate     string
	EndDate       string
	Rollover      bool
}

// AccountsPage renders the accounts list.
func (ph *PageHandlers) AccountsPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Accounts")
	accounts, err := ph.cq.ListAccountsWithBalance(r.Context(), claims.UserID)
	if err != nil {
		SetFlash(w, "error", "Failed to load accounts")
		RenderPage(w, "accounts", data)
		return
	}

	var rows []AccountRow
	for _, a := range accounts {
		cl := ""
		if a.CreditLimit != nil {
			cl = fmt.Sprintf("%.2f", *a.CreditLimit)
		}
		rows = append(rows, AccountRow{
			ID:             pgUUIDToString(a.ID),
			Name:           a.Name,
			Type:           a.Type,
			Currency:       a.Currency,
			Balance:        a.Balance,
			OpeningBalance: a.OpeningBalance,
			CreditLimit:    cl,
			CreatedAt:      a.CreatedAt.Format("Jan 2, 2006"),
		})
	}
	data.Data = rows
	RenderPage(w, "accounts", data)
}

// CreateAccount handles account creation.
func (ph *PageHandlers) CreateAccount(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/accounts", http.StatusSeeOther)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	accType := strings.TrimSpace(r.FormValue("type"))
	currency := strings.TrimSpace(r.FormValue("currency"))
	openBal := strings.TrimSpace(r.FormValue("opening_balance"))

	if name == "" || accType == "" {
		SetFlash(w, "error", "Name and type are required")
		http.Redirect(w, r, "/accounts", http.StatusSeeOther)
		return
	}

	if currency == "" {
		currency = "USD"
	}

	userUUID := parseUUID(claims.UserID)

	var obal pgtype.Numeric
	if openBal != "" {
		if f, err := strconv.ParseFloat(openBal, 64); err == nil {
			_ = obal.Scan(fmt.Sprint(f))
			obal.Valid = true
		}
	}

	_, err := ph.q.CreateAccount(r.Context(), db.CreateAccountParams{
		UserID:         userUUID,
		Name:           name,
		Type:           db.AccountType(accType),
		Currency:       currency,
		OpeningBalance: obal,
	})
	if err != nil {
		SetFlash(w, "error", fmt.Sprintf("Failed to create account: %v", err))
	} else {
		SetFlash(w, "success", "Account created")
	}
	http.Redirect(w, r, "/accounts", http.StatusSeeOther)
}

// BudgetsPage renders the budgets list.
func (ph *PageHandlers) BudgetsPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Budgets")
	budgets, err := ph.q.ListBudgetsByUser(r.Context(), parseUUID(claims.UserID))
	if err != nil {
		SetFlash(w, "error", "Failed to load budgets")
		RenderPage(w, "budgets", data)
		return
	}

	var rows []BudgetRow
	for _, b := range budgets {
		amt, _ := b.Amount.Float64Value()
		amount := 0.0
		if amt.Valid {
			amount = amt.Float64
		}

		catName := ""
		catColor := ""
		if b.CategoryName.Valid {
			catName = b.CategoryName.String
		}
		if b.CategoryColor.Valid {
			catColor = b.CategoryColor.String
		}

		startDate := ""
		if b.StartDate.Valid {
			startDate = b.StartDate.Time.Format("2006-01-02")
		}
		endDate := ""
		if b.EndDate.Valid {
			endDate = b.EndDate.Time.Format("2006-01-02")
		}

		rows = append(rows, BudgetRow{
			ID:            pgUUIDToString(b.ID),
			Name:          b.Name,
			CategoryName:  catName,
			CategoryColor: catColor,
			Amount:        amount,
			Currency:      b.Currency,
			PeriodType:    string(b.PeriodType),
			StartDate:     startDate,
			EndDate:       endDate,
			Rollover:      b.Rollover,
		})
	}
	data.Data = rows
	RenderPage(w, "budgets", data)
}

// CreateBudget handles budget creation.
func (ph *PageHandlers) CreateBudget(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/budgets", http.StatusSeeOther)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	amountStr := strings.TrimSpace(r.FormValue("amount"))
	currency := strings.TrimSpace(r.FormValue("currency"))
	periodType := strings.TrimSpace(r.FormValue("period_type"))
	categoryID := r.FormValue("category_id")
	startDate := r.FormValue("start_date")

	if name == "" || amountStr == "" || periodType == "" {
		SetFlash(w, "error", "Name, amount, and period are required")
		http.Redirect(w, r, "/budgets", http.StatusSeeOther)
		return
	}

	if currency == "" {
		currency = "USD"
	}

	userUUID := parseUUID(claims.UserID)
	catUUID := parseUUID(categoryID)

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amount <= 0 {
		SetFlash(w, "error", "Invalid amount")
		http.Redirect(w, r, "/budgets", http.StatusSeeOther)
		return
	}

	var amt pgtype.Numeric
	_ = amt.Scan(fmt.Sprint(amount))
	amt.Valid = true

	var sdate pgtype.Date
	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			sdate = pgtype.Date{Time: t, Valid: true}
		}
	}

	_, err = ph.q.CreateBudget(r.Context(), db.CreateBudgetParams{
		UserID:     userUUID,
		CategoryID: catUUID,
		Name:       name,
		Amount:     amt,
		Currency:   currency,
		PeriodType: db.PeriodType(periodType),
		StartDate:  sdate,
		Rollover:   r.FormValue("rollover") == "on",
	})
	if err != nil {
		SetFlash(w, "error", fmt.Sprintf("Failed to create budget: %v", err))
	} else {
		SetFlash(w, "success", "Budget created")
	}
	http.Redirect(w, r, "/budgets", http.StatusSeeOther)
}
