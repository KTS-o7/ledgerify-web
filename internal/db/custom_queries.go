package db

import (
	"context"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CustomQueries adds aggregate query methods not handled by sqlc
type CustomQueries struct {
	pool *pgxpool.Pool
}

func NewCustomQueries(pool *pgxpool.Pool) *CustomQueries {
	return &CustomQueries{pool: pool}
}

type CategorySpendingRow struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Color        string  `json:"color"`
	Total        float64 `json:"total"`
}

func (q *CustomQueries) GetCategorySpending(ctx context.Context, userID string, fromDate, toDate time.Time) ([]CategorySpendingRow, error) {
	rows, err := q.pool.Query(ctx, `
		SELECT c.id, c.name, c.color, COALESCE(SUM(t.amount), 0)::numeric(18,4) as total
		FROM transactions t
		JOIN categories c ON c.id = t.category_id
		WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.type = 'expense'
		  AND t.date >= $2 AND t.date <= $3
		GROUP BY c.id, c.name, c.color
		ORDER BY total DESC
	`, userID, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CategorySpendingRow
	for rows.Next() {
		var r CategorySpendingRow
		if err := rows.Scan(&r.CategoryID, &r.CategoryName, &r.Color, &r.Total); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

type MonthlyNetworthRow struct {
	Date         string  `json:"date"`
	TotalBalance float64 `json:"total_balance"`
}

func (q *CustomQueries) GetMonthlyNetworth(ctx context.Context, userID string, fromDate, toDate time.Time) ([]MonthlyNetworthRow, error) {
	rows, err := q.pool.Query(ctx, `
		SELECT date::text, SUM(balance) as total_balance FROM (
			SELECT t.date,
				SUM(CASE WHEN t.type = 'income' THEN t.amount
						 WHEN t.type = 'expense' THEN -t.amount
						 ELSE 0 END) as balance
			FROM transactions t
			WHERE t.user_id = $1 AND t.deleted_at IS NULL
			  AND t.date >= $2 AND t.date <= $3
			GROUP BY t.date
		) subq GROUP BY date ORDER BY date
	`, userID, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []MonthlyNetworthRow
	for rows.Next() {
		var r MonthlyNetworthRow
		if err := rows.Scan(&r.Date, &r.TotalBalance); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (q *CustomQueries) GetAccountBalanceForUser(ctx context.Context, accountID pgtype.UUID) (float64, error) {
	var balance float64
	err := q.pool.QueryRow(ctx, `
		SELECT COALESCE(a.opening_balance, 0) + COALESCE(SUM(
			CASE WHEN t.type = 'income' THEN t.amount
				 WHEN t.type = 'expense' THEN -t.amount
				 ELSE 0 END
		), 0)::numeric(18,4) as balance
		FROM accounts a
		LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
		WHERE a.id = $1 AND a.deleted_at IS NULL
		GROUP BY a.id, a.opening_balance
	`, accountID).Scan(&balance)
	return balance, err
}

// UserAccountBalance holds account with computed balance
type UserAccountBalance struct {
	ID             pgtype.UUID `json:"id"`
	UserID         pgtype.UUID `json:"user_id"`
	Name           string      `json:"name"`
	Type           string      `json:"type"`
	Currency       string      `json:"currency"`
	OpeningBalance float64     `json:"opening_balance"`
	Balance        float64     `json:"balance"`
	CreditLimit    *float64    `json:"credit_limit"`
	CreatedAt      time.Time   `json:"created_at"`
}

func (q *CustomQueries) ListAccountsWithBalance(ctx context.Context, userID string) ([]UserAccountBalance, error) {
	rows, err := q.pool.Query(ctx, `
		SELECT a.id, a.user_id, a.name, a.type::text, a.currency,
			COALESCE(a.opening_balance, 0)::numeric(18,4) as opening_balance,
			COALESCE(a.opening_balance, 0) + COALESCE(SUM(
				CASE WHEN t.type = 'income' THEN t.amount
					 WHEN t.type = 'expense' THEN -t.amount
					 ELSE 0 END
			), 0)::numeric(18,4) as balance,
			a.credit_limit, a.created_at
		FROM accounts a
		LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
		WHERE a.user_id = $1 AND a.deleted_at IS NULL
		GROUP BY a.id, a.user_id, a.name, a.type, a.currency, a.opening_balance, a.credit_limit, a.created_at
		ORDER BY a.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []UserAccountBalance
	for rows.Next() {
		var r UserAccountBalance
		if err := rows.Scan(&r.ID, &r.UserID, &r.Name, &r.Type, &r.Currency, &r.OpeningBalance, &r.Balance, &r.CreditLimit, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.Balance = math.Round(r.Balance*100) / 100
		result = append(result, r)
	}
	return result, rows.Err()
}
