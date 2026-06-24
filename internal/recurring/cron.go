package recurring

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Engine struct {
	pool *pgxpool.Pool
}

func NewEngine(pool *pgxpool.Pool) *Engine {
	return &Engine{pool: pool}
}

// ruleRow is the internal struct we scan DB rows into.
type ruleRow struct {
	ID             string
	UserID         string
	Type           string
	Amount         float64
	Currency       string
	AccountID      pgtype.UUID
	CategoryID     pgtype.UUID
	TransferToID   pgtype.UUID
	Title          pgtype.Text
	Note           pgtype.Text
	Frequency      string
	IntervalValue  pgtype.Numeric
	IntervalUnit   pgtype.Text
	StartDate      time.Time
	NextDue        time.Time
	EndDate        pgtype.Date
}

// RunOnce generates all due occurrences across all active rules.
// Idempotent within the same `asOf` day (calling twice on the same day is a no-op).
func (e *Engine) RunOnce(ctx context.Context, asOf time.Time) (int, error) {
	asOf = startOnly(asOf)
	rows, err := e.pool.Query(ctx,
		`SELECT id, user_id, type, amount, currency, account_id, category_id, transfer_to_id,
		        title, note, frequency, interval_value, interval_unit,
		        start_date, next_due_date, end_date
		   FROM recurring_transactions
		  WHERE status='active' AND deleted_at IS NULL AND next_due_date <= $1`, asOf)
	if err != nil {
		return 0, fmt.Errorf("query recurring rules: %w", err)
	}
	defer rows.Close()

	var rules []ruleRow
	for rows.Next() {
		var rl ruleRow
		if err := rows.Scan(
			&rl.ID, &rl.UserID, &rl.Type, &rl.Amount, &rl.Currency, &rl.AccountID,
			&rl.CategoryID, &rl.TransferToID, &rl.Title, &rl.Note,
			&rl.Frequency, &rl.IntervalValue, &rl.IntervalUnit,
			&rl.StartDate, &rl.NextDue, &rl.EndDate,
		); err != nil {
			return 0, fmt.Errorf("scan rule: %w", err)
		}
		rules = append(rules, rl)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	generated := 0
	for _, rl := range rules {
		var endDate *time.Time
		if rl.EndDate.Valid {
			t := rl.EndDate.Time
			endDate = &t
		}
		var iv *int
		if rl.IntervalValue.Valid {
			n, err := intervalToIntCron(rl.IntervalValue)
			if err == nil {
				iv = &n
			}
		}
		var iu *string
		if rl.IntervalUnit.Valid {
			s := rl.IntervalUnit.String
			iu = &s
		}

		dates := GenerateOccurrences(rl.NextDue, asOf, rl.Frequency, iv, iu, endDate)
		if len(dates) == 0 {
			continue
		}
		for _, d := range dates {
			if err := e.insertOccurrence(ctx, rl, d); err != nil {
				log.Printf("recurring: insert occurrence for rule %s on %s: %v", rl.ID, d.Format("2006-01-02"), err)
				continue
			}
			generated++
		}
		nextNext := ComputeNext(dates[len(dates)-1], rl.Frequency, iv, iu)
		if _, err := e.pool.Exec(ctx,
			`UPDATE recurring_transactions SET last_generated_date=$1, next_due_date=$2, updated_at=now() WHERE id=$3`,
			dates[len(dates)-1], nextNext, rl.ID); err != nil {
			log.Printf("recurring: update next_due for rule %s: %v", rl.ID, err)
		}
	}
	return generated, nil
}

func (e *Engine) insertOccurrence(ctx context.Context, rl ruleRow, date time.Time) error {
	_, err := e.pool.Exec(ctx,
		`INSERT INTO transactions
		   (user_id, account_id, type, amount, currency, category_id, transfer_to_id, title, note, date, is_recurring, parent_recurring_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)
		 ON CONFLICT (parent_recurring_id, date) WHERE parent_recurring_id IS NOT NULL DO NOTHING`,
		rl.UserID, rl.AccountID, rl.Type, rl.Amount, rl.Currency,
		rl.CategoryID, rl.TransferToID, rl.Title, rl.Note, date, rl.ID)
	return err
}

func intervalToIntCron(n pgtype.Numeric) (int, error) {
	if !n.Valid {
		return 0, nil
	}
	bi, ok := new(big.Int).SetString(n.Int.String(), 10)
	if !ok {
		return 0, fmt.Errorf("invalid numeric")
	}
	return int(bi.Int64()), nil
}

// Start launches the background goroutine. Runs 60s after start, then every 24h.
// Cancelled when ctx is cancelled.
func (e *Engine) Start(ctx context.Context) {
	go func() {
		select {
		case <-ctx.Done():
			return
		case <-time.After(60 * time.Second):
		}
		if _, err := e.RunOnce(ctx, time.Now().UTC()); err != nil {
			log.Printf("recurring: initial run failed: %v", err)
		}
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := e.RunOnce(ctx, time.Now().UTC()); err != nil {
					log.Printf("recurring: scheduled run failed: %v", err)
				}
			}
		}
	}()
}
