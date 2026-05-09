package utils

import (
	"context"
	"encoding/csv"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type ImportRow struct {
	AccountName  string
	Type         string
	Amount       float64
	Currency     string
	CategoryName string
	Date         string
	Note         string
	Title        string
	Tags         []string
}

func ParseCSV(reader io.Reader) ([]map[string]string, error) {
	r := csv.NewReader(reader)
	r.TrimLeadingSpace = true
	rows, err := r.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return nil, nil
	}
	headers := rows[0]
	var result []map[string]string
	for _, row := range rows[1:] {
		record := make(map[string]string, len(headers))
		for i, h := range headers {
			if i < len(row) {
				record[h] = strings.TrimSpace(row[i])
			}
		}
		result = append(result, record)
	}
	return result, nil
}

func ParseLedgerifyCSV(reader io.Reader) ([]ImportRow, error) {
	rows, err := ParseCSV(reader)
	if err != nil {
		return nil, err
	}
	var result []ImportRow
	for _, r := range rows {
		amount, _ := strconv.ParseFloat(r["amount"], 64)
		var tags []string
		if t := strings.TrimSpace(r["tags"]); t != "" {
			tags = strings.Split(t, ",")
		}
		result = append(result, ImportRow{
			AccountName:  r["account"],
			Type:         r["type"],
			Amount:       amount,
			Currency:     strings.ToUpper(r["currency"]),
			CategoryName: r["category"],
			Date:         r["date"],
			Note:         r["note"],
			Title:        r["title"],
			Tags:         tags,
		})
	}
	return result, nil
}

// CurrencyRateQuerier defines the subset of db.Querier needed for rate lookups.
type CurrencyRateQuerier interface {
	GetExchangeRate(ctx context.Context, base pgtype.Text, target pgtype.Text) (db.ExchangeRate, error)
}

func GetRate(querier CurrencyRateQuerier, base, target string) (float64, error) {
	if base == target {
		return 1, nil
	}
	rateObj, err := querier.GetExchangeRate(context.Background(), pgtype.Text{String: base, Valid: true}, pgtype.Text{String: target, Valid: true})
	if err != nil {
		return 1, err // fallback to 1 if no rate found
	}
	f, _ := rateObj.Rate.Float64Value()
	if !f.Valid {
		return 1, nil
	}
	return f.Float64, nil
}

func ConvertAmount(amount float64, from, to string, querier CurrencyRateQuerier) (float64, error) {
	if from == to {
		return amount, nil
	}
	rate, err := GetRate(querier, from, to)
	if err != nil {
		return amount, err
	}
	return amount * rate, nil
}

// TransactionQuerier for summary operations
type TransactionQuerier interface {
	GetTransactionsByDateRange(ctx context.Context, userID pgtype.UUID, fromDate time.Time, toDate time.Time) ([]*db.GetTransactionsByDateRangeRow, error)
}
