package handlers

import (
	"context"
	"math"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SummaryHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
	cq   *db.CustomQueries
}

func NewSummaryHandler(pool *pgxpool.Pool, q *db.Queries, cq *db.CustomQueries) *SummaryHandler {
	return &SummaryHandler{pool: pool, q: q, cq: cq}
}

type BudgetStatusItem struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Amount    float64 `json:"amount"`
	Spent     float64 `json:"spent"`
	Remaining float64 `json:"remaining"`
	SpentPct  float64 `json:"spent_pct"`
	Currency  string  `json:"currency"`
}

type SummaryResponse struct {
	TotalIncome       float64                          `json:"total_income"`
	TotalExpenses     float64                          `json:"total_expenses"`
	CategorySpending  []db.CategorySpendingRow         `json:"category_spending"`
	MonthlyNetworth   []db.MonthlyNetworthRow          `json:"monthly_networth"`
	RecentTransactions []db.ListTransactionsByUserRow  `json:"recent_transactions"`
	AccountBalances   []db.UserAccountBalance          `json:"account_balances"`
	BudgetStatus      []BudgetStatusItem               `json:"budget_status"`
}

// GET /api/v1/summary
func (h *SummaryHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	userID := claims.UserID
	userUUID := stringToUUID(userID)
	now := time.Now()

	// This month date range
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)

	// Networth over last 6 months
	sixMonthsAgo := monthStart.AddDate(0, -5, 0)

	// Category spending (this month)
	categorySpending, err := h.cq.GetCategorySpending(r.Context(), userID, monthStart, monthEnd)
	if err != nil {
		categorySpending = []db.CategorySpendingRow{}
	}

	// Monthly networth
	monthlyNetworth, err := h.cq.GetMonthlyNetworth(r.Context(), userID, sixMonthsAgo, monthEnd)
	if err != nil {
		monthlyNetworth = []db.MonthlyNetworthRow{}
	}

	// Account balances
	accountBalances, err := h.cq.ListAccountsWithBalance(r.Context(), userID)
	if err != nil {
		accountBalances = []db.UserAccountBalance{}
	}

	// Recent transactions (last 5)
	var limitRows pgtype.Int4
	_ = limitRows.Scan(5)
	limitRows.Valid = true

	recentTxs, err := h.q.ListTransactionsByUser(r.Context(), db.ListTransactionsByUserParams{
		UserID:    userUUID,
		LimitRows: limitRows,
	})
	if err != nil {
		recentTxs = []db.ListTransactionsByUserRow{}
	}

	// Total income and expenses this month
	totalIncome, totalExpenses := h.computeMonthlyTotals(r.Context(), userUUID, monthStart, monthEnd)

	// Budget status
	budgetStatus := h.computeBudgetStatus(r.Context(), userUUID, monthStart, monthEnd)

	utils.OK(w, SummaryResponse{
		TotalIncome:        math.Round(totalIncome*100) / 100,
		TotalExpenses:      math.Round(totalExpenses*100) / 100,
		CategorySpending:   categorySpending,
		MonthlyNetworth:    monthlyNetworth,
		RecentTransactions: recentTxs,
		AccountBalances:    accountBalances,
		BudgetStatus:       budgetStatus,
	})
}

func (h *SummaryHandler) computeMonthlyTotals(ctx context.Context, userUUID pgtype.UUID, monthStart, monthEnd time.Time) (float64, float64) {
	var income, expenses float64

	err := h.pool.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::numeric(18,4),
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::numeric(18,4)
		FROM transactions
		WHERE user_id = $1 AND deleted_at IS NULL
		  AND date >= $2 AND date <= $3`,
		userUUID, monthStart, monthEnd,
	).Scan(&income, &expenses)
	if err != nil {
		return 0, 0
	}
	return income, expenses
}

func (h *SummaryHandler) computeBudgetStatus(ctx context.Context, userUUID pgtype.UUID, monthStart, monthEnd time.Time) []BudgetStatusItem {
	budgets, err := h.q.ListBudgetsByUser(ctx, userUUID)
	if err != nil || budgets == nil {
		return []BudgetStatusItem{}
	}

	items := make([]BudgetStatusItem, 0, len(budgets))
	for _, b := range budgets {
		amt, _ := b.Amount.Float64Value()
		amount := 0.0
		if amt.Valid {
			amount = amt.Float64
		}

		// Compute spent for this budget's category this month
		var spent float64
		if b.CategoryID.Valid {
			err := h.pool.QueryRow(ctx,
				`SELECT COALESCE(SUM(t.amount), 0)::numeric(18,4)
				FROM transactions t
				JOIN categories c ON c.id = t.category_id
				WHERE t.user_id = $1 AND t.type = 'expense'
				  AND t.category_id = $2
				  AND t.date >= $3 AND t.date <= $4
				  AND t.deleted_at IS NULL`,
				userUUID, b.CategoryID, monthStart, monthEnd,
			).Scan(&spent)
			if err != nil {
				spent = 0
			}
		}

		remaining := amount - spent
		spentPct := 0.0
		if amount > 0 {
			spentPct = math.Round((spent / amount) * 100)
		}

		items = append(items, BudgetStatusItem{
			ID:        uuidToString(b.ID),
			Name:      b.Name,
			Amount:    math.Round(amount*100) / 100,
			Spent:     math.Round(spent*100) / 100,
			Remaining: math.Round(remaining*100) / 100,
			SpentPct:  spentPct,
			Currency:  b.Currency,
		})
	}
	return items
}
