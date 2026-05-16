package templates

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/jackc/pgx/v5/pgtype"
)

// ReportsPage renders the reports index.
func (ph *PageHandlers) ReportsPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Reports")
	RenderPage(w, "reports-index", data)
}

// CashFlowPage renders the cash flow report.
func (ph *PageHandlers) CashFlowPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	data := NewPageData(r, "Cash Flow")

	if claims != nil {
		now := time.Now()
		// Last 12 months
		type monthData struct {
			Label   string
			Income  float64
			Expense float64
		}
		var months []monthData
		for i := 0; i < 12; i++ {
			start := time.Date(now.Year(), now.Month()-time.Month(i), 1, 0, 0, 0, 0, now.Location())
			end := start.AddDate(0, 1, 0)
			inc, exp := computeMonthlyTotals(r.Context(), ph.pool, parseUUID(claims.UserID), start, end)
			months = append([]monthData{
				{Label: start.Format("2006-01"), Income: inc, Expense: exp},
			}, months...)
		}
		type cfData struct {
			Labels  []string
			Income  []float64
			Expense []float64
		}
		cf := cfData{}
		for _, m := range months {
			cf.Labels = append(cf.Labels, m.Label)
			cf.Income = append(cf.Income, m.Income)
			cf.Expense = append(cf.Expense, m.Expense)
		}
		jsonBytes, _ := json.Marshal(cf)
		data.Data = string(jsonBytes)
	}
	RenderPage(w, "reports-cashflow", data)
}

// CategoryBreakdownPage renders the category spending pie chart.
func (ph *PageHandlers) CategoryBreakdownPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	data := NewPageData(r, "Category Breakdown")

	if claims != nil {
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end := start.AddDate(0, 1, -1) // end of current month

		cq := db.NewCustomQueries(ph.pool)
		rows, err := cq.GetCategorySpending(r.Context(), claims.UserID, start, end)
		if err == nil {
			type catData struct {
				Labels  []string
				Amounts []float64
				Colors  []string
			}
			cd := catData{}
			for _, row := range rows {
				cd.Labels = append(cd.Labels, row.CategoryName)
				cd.Amounts = append(cd.Amounts, row.Total)
				col := row.Color
				if col == "" { col = "#6b7280" }
				cd.Colors = append(cd.Colors, col)
			}
			jsonBytes, _ := json.Marshal(cd)
			data.Data = map[string]any{
				"chartData": string(jsonBytes),
				"Period":    start.Format("Jan 2006"),
			}
		}
	}
	RenderPage(w, "reports-category", data)
}

// BudgetVsActualPage renders the budget comparison chart.
func (ph *PageHandlers) BudgetVsActualPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	data := NewPageData(r, "Budget vs Actual")

	if claims != nil {
		budgets, err := ph.q.ListBudgetsByUser(r.Context(), parseUUID(claims.UserID))
		if err == nil {
			type bvaData struct {
				Labels  []string
				Budget  []float64
				Actual  []float64
			}
			bva := bvaData{}
			for _, b := range budgets {
				budgetAmt := 0.0
				if b.Amount.Valid {
					amt, _ := b.Amount.Float64Value()
					budgetAmt = amt.Float64
				}
				// Get actual spending for this budget period
				var startDate, endDate time.Time
				if b.StartDate.Valid { startDate = b.StartDate.Time }
				if b.EndDate.Valid { endDate = b.EndDate.Time }
				actual := 0.0
				if !startDate.IsZero() && !endDate.IsZero() {
					_, exp := computeMonthlyTotals(r.Context(), ph.pool, parseUUID(claims.UserID), startDate, endDate)
					actual = exp
				}
				bva.Labels = append(bva.Labels, b.Name)
				bva.Budget = append(bva.Budget, budgetAmt)
				bva.Actual = append(bva.Actual, actual)
			}
			jsonBytes, _ := json.Marshal(bva)
			data.Data = string(jsonBytes)
		}
	}
	RenderPage(w, "reports-budget", data)
}

// NetworthPage renders the net worth over time chart.
func (ph *PageHandlers) NetworthPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	data := NewPageData(r, "Net Worth")

	if claims != nil {
		now := time.Now()
		start := now.AddDate(-3, 0, 0) // 3 years back
		cq := db.NewCustomQueries(ph.pool)
		rows, err := cq.GetMonthlyNetworth(r.Context(), claims.UserID, start, now)
		if err == nil {
			type nwData struct {
				Labels  []string
				Balance []float64
			}
			nw := nwData{}
			for _, row := range rows {
				nw.Labels = append(nw.Labels, row.Date)
				nw.Balance = append(nw.Balance, row.TotalBalance)
			}
			jsonBytes, _ := json.Marshal(nw)
			data.Data = string(jsonBytes)
		} else {
			log.Printf("Networth fetch error: %v", err)
		}
	}
	RenderPage(w, "reports-networth", data)
}

// InvestmentReturnsPage placeholder.
func (ph *PageHandlers) InvestmentReturnsPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Investment Returns")
	RenderPage(w, "reports-investments", data)
}

// DebtPayoffPage placeholder.
func (ph *PageHandlers) DebtPayoffPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Debt Payoff")
	RenderPage(w, "reports-debt", data)
}

// ensure we import pgtype
var _ pgtype.UUID
