package templates

import (
	"context"
	"math"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DashboardData contains all data for the dashboard page.
type DashboardData struct {
	TotalIncome        float64
	TotalExpenses      float64
	NetAmount          float64
	TotalBalance       float64
	Currency           string
	AccountCount       int
	RecentTransactions []DashboardTxn
	BudgetStatus       []DashboardBudget
	MonthlyNetworth    []DashboardNetworth
}

// DashboardTxn is a simplified transaction for the dashboard table.
type DashboardTxn struct {
	DateFormatted string
	Title         string
	CategoryName  string
	AccountName   string
	Amount        float64
}

// DashboardBudget is a budget status for the dashboard.
type DashboardBudget struct {
	Name      string
	Amount    float64
	Spent     float64
	Remaining float64
	SpentPct  float64
	Currency  string
}

// DashboardNetworth is a monthly net worth data point.
type DashboardNetworth struct {
	MonthLabel string
	Networth   float64
}

// DashboardPage renders the dashboard with real data.
func (ph *PageHandlers) DashboardPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Dashboard")
	dd := ph.fetchDashboardData(r.Context(), claims.UserID)
	data.Data = dd
	RenderPage(w, "dashboard", data)
}

func (ph *PageHandlers) fetchDashboardData(ctx context.Context, userID string) DashboardData {
	userUUID := pgtype.UUID{Bytes: uuid.MustParse(userID), Valid: true}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)

	dd := DashboardData{
		Currency: "USD",
	}

	// Fetch in parallel where possible
	// Total income/expenses
	dd.TotalIncome, dd.TotalExpenses = computeMonthlyTotals(ctx, ph.pool, userUUID, monthStart, monthEnd)
	dd.NetAmount = math.Round((dd.TotalIncome-dd.TotalExpenses)*100) / 100

	// Account balances
	accounts, err := ph.cq.ListAccountsWithBalance(ctx, userID)
	if err == nil {
		for _, a := range accounts {
			dd.TotalBalance += a.Balance
		}
		dd.AccountCount = len(accounts)
		// Get user's default currency
		if len(accounts) > 0 && accounts[0].Currency != "" {
			dd.Currency = accounts[0].Currency
		}
	}
	dd.TotalBalance = math.Round(dd.TotalBalance*100) / 100

	// Recent transactions (last 5)
	limitRows := pgtype.Int4{Int32: 5, Valid: true}
	txns, err := ph.q.ListTransactionsByUser(ctx, db.ListTransactionsByUserParams{
		UserID:    userUUID,
		LimitRows: limitRows,
	})
	if err == nil {
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
			if t.Date.Valid {
				dateFormatted = t.Date.Time.Format("Jan 2")
			}

			dd.RecentTransactions = append(dd.RecentTransactions, DashboardTxn{
				DateFormatted: dateFormatted,
				Title:         title,
				CategoryName:  catName,
				AccountName:   t.AccountName,
				Amount:        amount,
			})
		}
	}

	// Budget status
	budgets, err := ph.q.ListBudgetsByUser(ctx, userUUID)
	if err == nil {
		for _, b := range budgets {
			amt, _ := b.Amount.Float64Value()
			amount := 0.0
			if amt.Valid {
				amount = amt.Float64
			}

			var spent float64
			if b.CategoryID.Valid {
				_ = ph.pool.QueryRow(ctx,
					`SELECT COALESCE(SUM(t.amount), 0)::numeric(18,4)
					FROM transactions t
					WHERE t.user_id = $1 AND t.type = 'expense'
					  AND t.category_id = $2
					  AND t.date >= $3 AND t.date <= $4
					  AND t.deleted_at IS NULL`,
					userUUID, b.CategoryID, monthStart, monthEnd,
				).Scan(&spent)
			}

			remaining := amount - spent
			spentPct := 0.0
			if amount > 0 {
				spentPct = math.Round((spent / amount) * 100)
			}

			dd.BudgetStatus = append(dd.BudgetStatus, DashboardBudget{
				Name:      b.Name,
				Amount:    math.Round(amount*100) / 100,
				Spent:     math.Round(spent*100) / 100,
				Remaining: math.Round(remaining*100) / 100,
				SpentPct:  spentPct,
				Currency:  b.Currency,
			})
		}
	}

	// Monthly net worth
	sixMonthsAgo := monthStart.AddDate(0, -5, 0)
	nw, err := ph.cq.GetMonthlyNetworth(ctx, userID, sixMonthsAgo, monthEnd)
	if err == nil {
		for _, row := range nw {
			// Parse date and format month label
			t, err := time.Parse("2006-01-02", row.Date)
			label := row.Date
			if err == nil {
				label = t.Format("Jan")
			}
			dd.MonthlyNetworth = append(dd.MonthlyNetworth, DashboardNetworth{
				MonthLabel: label,
				Networth:   math.Round(row.TotalBalance*100) / 100,
			})
		}
	}

	return dd
}

// computeMonthlyTotals calculates total income and expenses for a date range.
func computeMonthlyTotals(ctx context.Context, pool *pgxpool.Pool, userUUID pgtype.UUID, monthStart, monthEnd time.Time) (income, expenses float64) {
	_ = pool.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::numeric(18,4),
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::numeric(18,4)
		FROM transactions
		WHERE user_id = $1 AND deleted_at IS NULL
		  AND date >= $2 AND date <= $3`,
		userUUID, monthStart, monthEnd,
	).Scan(&income, &expenses)
	return
}
