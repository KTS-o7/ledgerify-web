package handlers

import (
	"math/big"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func uuidNewString() string { return uuid.NewString() }

func nullableUUID(s string) pgtype.UUID {
	if s == "" {
		return pgtype.UUID{}
	}
	u, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: u, Valid: true}
}

func nullableString(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func intervalToInt(n pgtype.Numeric) (int, error) {
	if !n.Valid {
		return 0, nil
	}
	bi, ok := new(big.Int).SetString(n.Int.String(), 10)
	if !ok {
		return 0, nil
	}
	if !bi.IsInt64() {
		return 0, nil
	}
	return int(bi.Int64()), nil
}