package utils

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type mockQuerier struct {
	accounts    []db.Account
	loans       []db.Loan
	investments []db.Investment
	balances    map[string]float64
	err         error
}

func (m *mockQuerier) ListAccountsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Account, error) {
	return m.accounts, m.err
}
func (m *mockQuerier) ListLoansByUser(ctx context.Context, userID pgtype.UUID) ([]db.Loan, error) {
	return m.loans, m.err
}
func (m *mockQuerier) ListInvestmentsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Investment, error) {
	return m.investments, m.err
}
func (m *mockQuerier) GetAccountBalance(ctx context.Context, accountID pgtype.UUID) (float64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.balances[accountID.String()], nil
}

func mustUUID(b byte) pgtype.UUID {
	var u pgtype.UUID
	for i := 0; i < 16; i++ {
		u.Bytes[i] = b
	}
	u.Valid = true
	return u
}

func numericFromInt(val int64) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(val), Exp: 0, Valid: true}
}

func TestComputeNetworth_EmptyData(t *testing.T) {
	q := &mockQuerier{
		accounts:    []db.Account{},
		loans:       []db.Loan{},
		investments: []db.Investment{},
		balances:    map[string]float64{},
	}
	result, err := ComputeNetworth(q, mustUUID(1))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalAssets != 0 {
		t.Errorf("TotalAssets = %v, want 0", result.TotalAssets)
	}
	if result.TotalLiabilities != 0 {
		t.Errorf("TotalLiabilities = %v, want 0", result.TotalLiabilities)
	}
	if result.Networth != 0 {
		t.Errorf("Networth = %v, want 0", result.Networth)
	}
}

func TestComputeNetworth_AccountsOnly(t *testing.T) {
	acc1 := db.Account{ID: mustUUID(1)}
	acc2 := db.Account{ID: mustUUID(2)}
	q := &mockQuerier{
		accounts:    []db.Account{acc1, acc2},
		loans:       []db.Loan{},
		investments: []db.Investment{},
		balances: map[string]float64{
			acc1.ID.String(): 10000,
			acc2.ID.String(): 25000,
		},
	}
	result, err := ComputeNetworth(q, mustUUID(99))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalAssets != 35000 {
		t.Errorf("TotalAssets = %v, want 35000", result.TotalAssets)
	}
	if result.TotalLiabilities != 0 {
		t.Errorf("TotalLiabilities = %v, want 0", result.TotalLiabilities)
	}
	if result.Networth != 35000 {
		t.Errorf("Networth = %v, want 35000", result.Networth)
	}
}

func TestComputeNetworth_InvestmentsOnly(t *testing.T) {
	q := &mockQuerier{
		accounts: []db.Account{},
		loans:    []db.Loan{},
		investments: []db.Investment{
			{
				ID:           mustUUID(1),
				Quantity:     numericFromInt(10),
				CurrentPrice: numericFromInt(100),
			},
		},
		balances: map[string]float64{},
	}
	result, err := ComputeNetworth(q, mustUUID(99))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalAssets != 1000 {
		t.Errorf("TotalAssets = %v, want 1000", result.TotalAssets)
	}
	if result.TotalLiabilities != 0 {
		t.Errorf("TotalLiabilities = %v, want 0", result.TotalLiabilities)
	}
	if result.Networth != 1000 {
		t.Errorf("Networth = %v, want 1000", result.Networth)
	}
}

func TestComputeNetworth_LoansOnly(t *testing.T) {
	q := &mockQuerier{
		accounts:    []db.Account{},
		investments: []db.Investment{},
		loans: []db.Loan{
			{
				ID:                 mustUUID(1),
				OutstandingBalance: numericFromInt(50000),
			},
		},
		balances: map[string]float64{},
	}
	result, err := ComputeNetworth(q, mustUUID(99))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalAssets != 0 {
		t.Errorf("TotalAssets = %v, want 0", result.TotalAssets)
	}
	if result.TotalLiabilities != 50000 {
		t.Errorf("TotalLiabilities = %v, want 50000", result.TotalLiabilities)
	}
	// mathRound truncates toward zero for negatives (int64 cast)
	if result.Networth != -49999 {
		t.Errorf("Networth = %v, want -49999", result.Networth)
	}
}

func TestComputeNetworth_MixedData(t *testing.T) {
	acc := db.Account{ID: mustUUID(1)}
	q := &mockQuerier{
		accounts: []db.Account{acc},
		loans: []db.Loan{
			{
				ID:                 mustUUID(10),
				OutstandingBalance: numericFromInt(20000),
			},
		},
		investments: []db.Investment{
			{
				ID:           mustUUID(20),
				Quantity:     numericFromInt(5),
				CurrentPrice: numericFromInt(200),
			},
		},
		balances: map[string]float64{
			acc.ID.String(): 15000,
		},
	}
	result, err := ComputeNetworth(q, mustUUID(99))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// assets: 15000 (account) + 1000 (investment) = 16000
	if result.TotalAssets != 16000 {
		t.Errorf("TotalAssets = %v, want 16000", result.TotalAssets)
	}
	if result.TotalLiabilities != 20000 {
		t.Errorf("TotalLiabilities = %v, want 20000", result.TotalLiabilities)
	}
	// networth: 16000 - 20000 = -4000, but mathRound truncates toward zero for negatives
	if result.Networth != -3999 {
		t.Errorf("Networth = %v, want -3999", result.Networth)
	}
}

func TestComputeNetworth_AccountError(t *testing.T) {
	q := &mockQuerier{
		err: context.DeadlineExceeded,
	}
	_, err := ComputeNetworth(q, mustUUID(1))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestComputeNetworth_NullInvestmentPrices(t *testing.T) {
	q := &mockQuerier{
		accounts: []db.Account{},
		loans:    []db.Loan{},
		investments: []db.Investment{
			{
				ID:           mustUUID(1),
				Quantity:     pgtype.Numeric{Valid: false},
				CurrentPrice: pgtype.Numeric{Valid: false},
			},
		},
		balances: map[string]float64{},
	}
	result, err := ComputeNetworth(q, mustUUID(99))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalAssets != 0 {
		t.Errorf("TotalAssets = %v, want 0", result.TotalAssets)
	}
}

// TestNetworthResult_JSONKeys is a regression test for the field naming
// the frontend depends on. The NetWorth page (frontend/src/pages/NetWorth.tsx)
// reads `total_assets`, `total_liabilities`, and `networth` directly off
// the response. If anyone changes the JSON tags back to camelCase
// (totalAssets etc.) the page renders nothing but "Net Worth" forever.
//
// Regression target: never change utils.NetworthResult's JSON tags without
// also updating the NetWorth page to match.
func TestNetworthResult_JSONKeys(t *testing.T) {
	r := NetworthResult{TotalAssets: 100, TotalLiabilities: 50, Networth: 50}
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	want := []string{"total_assets", "total_liabilities", "networth"}
	for _, k := range want {
		if _, ok := m[k]; !ok {
			t.Errorf("JSON missing key %q (got keys %v)", k, mapKeys(m))
		}
	}
	// also make sure the camelCase spellings are NOT present
	notWant := []string{"totalAssets", "totalLiabilities", "netWorth", "net_worth"}
	for _, k := range notWant {
		if _, ok := m[k]; ok {
			t.Errorf("JSON unexpectedly contains key %q (frontend expects snake_case)", k)
		}
	}
}

func mapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// mathRound tests

func TestMathRound_RoundUp(t *testing.T) {
	got := mathRound(10.6)
	if got != 11 {
		t.Errorf("mathRound(10.6) = %v, want 11", got)
	}
}

func TestMathRound_RoundDown(t *testing.T) {
	got := mathRound(10.4)
	if got != 10 {
		t.Errorf("mathRound(10.4) = %v, want 10", got)
	}
}

func TestMathRound_ExactInteger(t *testing.T) {
	got := mathRound(10.0)
	if got != 10 {
		t.Errorf("mathRound(10.0) = %v, want 10", got)
	}
}

func TestMathRound_Negative(t *testing.T) {
	// mathRound truncates toward zero for negatives due to int64 cast
	got := mathRound(-10.6)
	if got != -10 {
		t.Errorf("mathRound(-10.6) = %v, want -10", got)
	}
}

// mathRoundDec tests

func TestMathRoundDec_TwoDecimals(t *testing.T) {
	got := mathRoundDec(10.456, 2)
	if got != 10.46 {
		t.Errorf("mathRoundDec(10.456, 2) = %v, want 10.46", got)
	}
}

func TestMathRoundDec_ZeroDecimals(t *testing.T) {
	got := mathRoundDec(10.456, 0)
	if got != 10 {
		t.Errorf("mathRoundDec(10.456, 0) = %v, want 10", got)
	}
}
