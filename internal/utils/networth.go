package utils

import (
	"context"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type NetworthResult struct {
	TotalAssets      float64 `json:"total_assets"`
	TotalLiabilities float64 `json:"total_liabilities"`
	Networth         float64 `json:"networth"`
}

type NetworthQuerier interface {
	ListAccountsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Account, error)
	ListLoansByUser(ctx context.Context, userID pgtype.UUID) ([]db.Loan, error)
	ListInvestmentsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Investment, error)
	GetAccountBalance(ctx context.Context, accountID pgtype.UUID) (float64, error)
}

func ComputeNetworth(querier NetworthQuerier, userID pgtype.UUID) (NetworthResult, error) {
	ctx := context.Background()

	accounts, err := querier.ListAccountsByUser(ctx, userID)
	if err != nil {
		return NetworthResult{}, err
	}

	loans, err := querier.ListLoansByUser(ctx, userID)
	if err != nil {
		return NetworthResult{}, err
	}

	investments, err := querier.ListInvestmentsByUser(ctx, userID)
	if err != nil {
		return NetworthResult{}, err
	}

	var totalAssets float64
	var totalLiabilities float64

	for _, a := range accounts {
		bal, err := querier.GetAccountBalance(ctx, a.ID)
		if err == nil {
			totalAssets += bal
		}
	}

	for _, inv := range investments {
		if inv.CurrentPrice.Valid && inv.Quantity.Valid {
			qtyV, _ := inv.Quantity.Float64Value()
			priceV, _ := inv.CurrentPrice.Float64Value()
			if qtyV.Valid && priceV.Valid {
				totalAssets += qtyV.Float64 * priceV.Float64
			}
		}
	}

	for _, l := range loans {
		if l.OutstandingBalance.Valid {
			balV, _ := l.OutstandingBalance.Float64Value()
			if balV.Valid {
				totalLiabilities += balV.Float64
			}
		}
	}

	return NetworthResult{
		TotalAssets:      mathRound(totalAssets),
		TotalLiabilities: mathRound(totalLiabilities),
		Networth:         mathRound(totalAssets - totalLiabilities),
	}, nil
}

func mathRound(f float64) float64 {
	return mathRoundDec(f, 0)
}

func mathRoundDec(f float64, decimals int) float64 {
	if decimals == 0 {
		return float64(int64(f + 0.5))
	}
	pow := 1.0
	for i := 0; i < decimals; i++ {
		pow *= 10
	}
	return float64(int64(f*pow+0.5)) / pow
}
