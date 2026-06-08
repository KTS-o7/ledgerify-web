package recalc

import (
	"context"
	"fmt"
	"log"
	"math"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CompoundFD: A = P * (1 + r/n)^(n*t)
// annualRate is a decimal (0.0775 = 7.75%), freq is compounds per year, years is elapsed years.
func CompoundFD(principal, annualRate float64, freq int, years float64) float64 {
	if annualRate == 0 || principal == 0 || years <= 0 {
		return principal
	}
	return principal * math.Pow(1+annualRate/float64(freq), float64(freq)*years)
}

// EMI: P * r * (1+r)^n / ((1+r)^n - 1), r=monthly rate, n=months.
// annualRatePct is in percent (7.75 = 7.75%).
func EMI(principal, annualRatePct float64, months int) float64 {
	if months == 0 {
		return 0
	}
	r := (annualRatePct / 100.0) / 12.0
	if r == 0 {
		return principal / float64(months)
	}
	pow := math.Pow(1+r, float64(months))
	return principal * r * pow / (pow - 1)
}

// SIPFutureValue: P * [((1 + r)^n - 1) / r] * (1 + r), r=monthly rate, n=months.
// annualRatePct is in percent (12 = 12%).
func SIPFutureValue(monthlyAmount, annualRatePct float64, months int) float64 {
	if months == 0 {
		return 0
	}
	r := (annualRatePct / 100.0) / 12.0
	if r == 0 {
		return monthlyAmount * float64(months)
	}
	pow := math.Pow(1+r, float64(months))
	return monthlyAmount * ((pow - 1) / r) * (1 + r)
}

// numericToFloat converts a pgtype.Numeric to a float64. Invalid numerics return 0.
func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, _ := n.Float64Value()
	return f.Float64
}

// numericFromFloat builds a pgtype.Numeric from a float64 by way of string scan,
// matching the pattern the rest of the codebase uses for InsertPath.
func numericFromFloat(v float64) pgtype.Numeric {
	var n pgtype.Numeric
	_ = n.Scan(strconv.FormatFloat(v, 'f', -1, 64))
	return n
}

// monthsBetween floors the number of whole months between two dates.
func monthsBetween(start, end time.Time) int {
	if !end.After(start) {
		return 0
	}
	years := end.Year() - start.Year()
	months := int(end.Month()) - int(start.Month())
	total := years*12 + months
	if end.Day() < start.Day() {
		total--
	}
	if total < 0 {
		return 0
	}
	return total
}

type Service struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{Pool: pool}
}

// RecalculateUser: recomputes all investments/loans/sips for one user. Errors
// are logged but do not abort sibling work — a single bad row should not stall
// the rest of the user's data.
func (s *Service) RecalculateUser(ctx context.Context, userID string) error {
	if err := s.recalcInvestments(ctx, userID); err != nil {
		log.Printf("recalc investments for user %s: %v", userID, err)
	}
	if err := s.recalcLoans(ctx, userID); err != nil {
		log.Printf("recalc loans for user %s: %v", userID, err)
	}
	if err := s.recalcSips(ctx, userID); err != nil {
		log.Printf("recalc sips for user %s: %v", userID, err)
	}
	return nil
}

// RecalculateAll: iterate every non-deleted user and recalculate. Intended for
// the daily cron.
func (s *Service) RecalculateAll(ctx context.Context) error {
	rows, err := s.Pool.Query(ctx, "SELECT id::text FROM users WHERE deleted_at IS NULL")
	if err != nil {
		return err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, id := range ids {
		if err := s.RecalculateUser(ctx, id); err != nil {
			log.Printf("recalc user %s: %v", id, err)
		}
	}
	return nil
}

// frequencyToCompoundsPerYear maps the compounding_frequency enum to the n in
// A = P * (1 + r/n)^(n*t). Unknown / un-set values default to quarterly (4),
// matching the prior behaviour of the engine.
func frequencyToCompoundsPerYear(freq string) int {
	switch freq {
	case "monthly":
		return 12
	case "quarterly":
		return 4
	case "semi_annual":
		return 2
	case "annual":
		return 1
	default:
		return 4
	}
}

// recalcInvestments: for each interest-bearing investment, project the future
// value using compound interest and persist it to computed_value.
func (s *Service) recalcInvestments(ctx context.Context, userID string) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("parse user id: %w", err)
	}

	const query = `
SELECT id::text,
       asset_type::text,
       quantity,
       buy_price,
       interest_rate,
       compounding_frequency::text,
       created_at,
       current_price
FROM investments
WHERE user_id = $1
  AND deleted_at IS NULL
  AND asset_type IN ('fd', 'ppf', 'nps', 'savings', 'other')
  AND interest_rate IS NOT NULL`

	rows, err := s.Pool.Query(ctx, query, userUUID)
	if err != nil {
		return err
	}
	defer rows.Close()

	now := time.Now()
	for rows.Next() {
		var (
			id        string
			assetType string
			quantity  pgtype.Numeric
			buyPrice  pgtype.Numeric
			rate      pgtype.Numeric
			freq      *string
			created   time.Time
			curPrice  pgtype.Numeric
		)
		if err := rows.Scan(&id, &assetType, &quantity, &buyPrice, &rate, &freq, &created, &curPrice); err != nil {
			log.Printf("recalc investments scan id=%s: %v", id, err)
			continue
		}

		// Principal preference: live current_price > buy_price. If neither
		// is set, there is nothing to compound.
		principal := numericToFloat(curPrice)
		if principal == 0 {
			principal = numericToFloat(buyPrice)
		}
		if principal == 0 {
			continue
		}

		ratePct := numericToFloat(rate)
		if ratePct == 0 {
			continue
		}
		annualRate := ratePct / 100.0

		years := now.Sub(created).Hours() / 24.0 / 365.25
		if years <= 0 {
			continue
		}

		freqStr := ""
		if freq != nil {
			freqStr = *freq
		}
		compounds := frequencyToCompoundsPerYear(freqStr)

		computed := CompoundFD(principal, annualRate, compounds, years)
		value := numericFromFloat(computed)

		if _, err := s.Pool.Exec(ctx,
			`UPDATE investments SET computed_value = $1, current_price_updated_at = now() WHERE id = $2 AND deleted_at IS NULL`,
			value, uuid.MustParse(id),
		); err != nil {
			log.Printf("recalc investments update id=%s: %v", id, err)
		}
	}
	return rows.Err()
}

// recalcLoans: project EMI from rate+principal+tenure, then reduce outstanding
// balance by total paid principal (or amount, when principal_component is not
// tracked per row).
func (s *Service) recalcLoans(ctx context.Context, userID string) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("parse user id: %w", err)
	}

	const query = `
SELECT id::text,
       principal,
       interest_rate,
       tenure_months,
       start_date,
       outstanding_balance
FROM loans
WHERE user_id = $1 AND deleted_at IS NULL`

	rows, err := s.Pool.Query(ctx, query, userUUID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			id              string
			principal       pgtype.Numeric
			interestRate    pgtype.Numeric
			tenureMonths    int32
			startDate       pgtype.Date
			existingBalance pgtype.Numeric
		)
		if err := rows.Scan(&id, &principal, &interestRate, &tenureMonths, &startDate, &existingBalance); err != nil {
			log.Printf("recalc loans scan id=%s: %v", id, err)
			continue
		}

		principalF := numericToFloat(principal)
		ratePct := numericToFloat(interestRate)
		months := int(tenureMonths)

		emi := EMI(principalF, ratePct, months)
		emiNum := numericFromFloat(emi)

		// Reduce outstanding by the sum of paid principal_component. Fall
		// back to the existing stored value if there's no principal split
		// tracked.
		loanUUID := uuid.MustParse(id)
		var paidPrincipal pgtype.Numeric
		if err := s.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(principal_component), 0)::numeric FROM loan_payments WHERE loan_id = $1 AND status IN ('paid', 'partial') AND deleted_at IS NULL`,
			loanUUID,
		).Scan(&paidPrincipal); err != nil {
			log.Printf("recalc loans sum principal id=%s: %v", id, err)
			continue
		}

		paidPrincipalF := numericToFloat(paidPrincipal)
		outstanding := principalF - paidPrincipalF
		if outstanding < 0 {
			outstanding = 0
		}
		// If the user already set an outstanding_balance that is below the
		// computed value, keep theirs — it might be tracking a settlement or
		// write-off the engine can't infer.
		if existingBalance.Valid {
			existing := numericToFloat(existingBalance)
			if existing < outstanding {
				outstanding = existing
			}
		}
		balanceNum := numericFromFloat(outstanding)

		if _, err := s.Pool.Exec(ctx,
			`UPDATE loans SET computed_emi = $1, outstanding_balance = $2, updated_at = now() WHERE id = $3 AND deleted_at IS NULL`,
			emiNum, balanceNum, loanUUID,
		); err != nil {
			log.Printf("recalc loans update id=%s: %v", id, err)
		}
	}
	return rows.Err()
}

// recalcSips: project corpus value from monthly contributions, with two
// branches: equity SIPs are marked-to-market via nav * units, while debt /
// hybrid / other SIPs accumulate future value using the expected return rate.
func (s *Service) recalcSips(ctx context.Context, userID string) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("parse user id: %w", err)
	}

	const query = `
SELECT id::text,
       sip_type::text,
       monthly_amount,
       start_date,
       expected_return_rate,
       current_nav,
       units_accumulated
FROM sips
WHERE user_id = $1 AND deleted_at IS NULL`

	rows, err := s.Pool.Query(ctx, query, userUUID)
	if err != nil {
		return err
	}
	defer rows.Close()

	now := time.Now()
	for rows.Next() {
		var (
			id         string
			sipType    string
			monthly    pgtype.Numeric
			startDate  pgtype.Date
			rate       pgtype.Numeric
			nav        pgtype.Numeric
			units      pgtype.Numeric
		)
		if err := rows.Scan(&id, &sipType, &monthly, &startDate, &rate, &nav, &units); err != nil {
			log.Printf("recalc sips scan id=%s: %v", id, err)
			continue
		}

		monthlyF := numericToFloat(monthly)
		ratePct := numericToFloat(rate)
		navF := numericToFloat(nav)
		unitsF := numericToFloat(units)

		var start time.Time
		if startDate.Valid {
			start = startDate.Time
		}
		months := monthsBetween(start, now)

		var corpus float64
		switch sipType {
		case "equity":
			// Mark to market when the user has provided units + NAV.
			if unitsF > 0 && navF > 0 {
				corpus = unitsF * navF
			} else {
				corpus = monthlyF * float64(months)
			}
		default:
			// debt / hybrid / other: future-value of monthly contributions
			// if a return rate is set, else linear accumulation.
			if ratePct > 0 && months > 0 {
				corpus = SIPFutureValue(monthlyF, ratePct, months)
			} else {
				corpus = monthlyF * float64(months)
			}
		}

		value := numericFromFloat(corpus)

		if _, err := s.Pool.Exec(ctx,
			`UPDATE sips SET corpus_value = $1, corpus_updated_at = now() WHERE id = $2 AND deleted_at IS NULL`,
			value, uuid.MustParse(id),
		); err != nil {
			log.Printf("recalc sips update id=%s: %v", id, err)
		}
	}
	return rows.Err()
}
