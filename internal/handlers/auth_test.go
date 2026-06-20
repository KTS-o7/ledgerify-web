package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/jackc/pgx/v5/pgtype"
)

// mockQuerier implements db.Querier with stubs for every method.
// Only DeleteUser is exercised in these tests; all others return zero values.
type mockQuerier struct {
	deleteUserErr error
	deletedID     pgtype.UUID
}

func (m *mockQuerier) DeleteUser(ctx context.Context, id pgtype.UUID) error {
	m.deletedID = id
	return m.deleteUserErr
}

// ---- All remaining Querier stubs (not under test) ----

func (m *mockQuerier) CreateAccount(ctx context.Context, arg db.CreateAccountParams) (db.Account, error) {
	return db.Account{}, nil
}
func (m *mockQuerier) CreateBudget(ctx context.Context, arg db.CreateBudgetParams) (db.Budget, error) {
	return db.Budget{}, nil
}
func (m *mockQuerier) CreateCategory(ctx context.Context, arg db.CreateCategoryParams) (db.Category, error) {
	return db.Category{}, nil
}
func (m *mockQuerier) CreateCategoryKeyword(ctx context.Context, arg db.CreateCategoryKeywordParams) (db.CategoryKeyword, error) {
	return db.CategoryKeyword{}, nil
}
func (m *mockQuerier) CreateInsurancePayment(ctx context.Context, arg db.CreateInsurancePaymentParams) (db.InsurancePayment, error) {
	return db.InsurancePayment{}, nil
}
func (m *mockQuerier) CreateInsurancePolicy(ctx context.Context, arg db.CreateInsurancePolicyParams) (db.InsurancePolicy, error) {
	return db.InsurancePolicy{}, nil
}
func (m *mockQuerier) CreateInvestment(ctx context.Context, arg db.CreateInvestmentParams) (db.Investment, error) {
	return db.Investment{}, nil
}
func (m *mockQuerier) CreateInvestmentTx(ctx context.Context, arg db.CreateInvestmentTxParams) (db.InvestmentTransaction, error) {
	return db.InvestmentTransaction{}, nil
}
func (m *mockQuerier) CreateLoan(ctx context.Context, arg db.CreateLoanParams) (db.Loan, error) {
	return db.Loan{}, nil
}
func (m *mockQuerier) CreateLoanPayment(ctx context.Context, arg db.CreateLoanPaymentParams) (db.LoanPayment, error) {
	return db.LoanPayment{}, nil
}
func (m *mockQuerier) CreateSavingsGoal(ctx context.Context, arg db.CreateSavingsGoalParams) (db.SavingsGoal, error) {
	return db.SavingsGoal{}, nil
}
func (m *mockQuerier) CreateSip(ctx context.Context, arg db.CreateSipParams) (db.Sip, error) {
	return db.Sip{}, nil
}
func (m *mockQuerier) CreateTag(ctx context.Context, arg db.CreateTagParams) (db.Tag, error) {
	return db.Tag{}, nil
}
func (m *mockQuerier) CreateTransaction(ctx context.Context, arg db.CreateTransactionParams) (db.Transaction, error) {
	return db.Transaction{}, nil
}
func (m *mockQuerier) CreateUser(ctx context.Context, arg db.CreateUserParams) (db.User, error) {
	return db.User{}, nil
}
func (m *mockQuerier) DeleteAccount(ctx context.Context, arg db.DeleteAccountParams) error {
	return nil
}
func (m *mockQuerier) DeleteBudget(ctx context.Context, arg db.DeleteBudgetParams) error {
	return nil
}
func (m *mockQuerier) DeleteCategory(ctx context.Context, arg db.DeleteCategoryParams) error {
	return nil
}
func (m *mockQuerier) DeleteCategoryKeyword(ctx context.Context, arg db.DeleteCategoryKeywordParams) error {
	return nil
}
func (m *mockQuerier) DeleteInsurancePolicy(ctx context.Context, arg db.DeleteInsurancePolicyParams) error {
	return nil
}
func (m *mockQuerier) DeleteInvestment(ctx context.Context, arg db.DeleteInvestmentParams) error {
	return nil
}
func (m *mockQuerier) DeleteLoan(ctx context.Context, arg db.DeleteLoanParams) error {
	return nil
}
func (m *mockQuerier) DeleteSavingsGoal(ctx context.Context, arg db.DeleteSavingsGoalParams) error {
	return nil
}
func (m *mockQuerier) DeleteSip(ctx context.Context, arg db.DeleteSipParams) error {
	return nil
}
func (m *mockQuerier) DeleteTag(ctx context.Context, arg db.DeleteTagParams) error {
	return nil
}
func (m *mockQuerier) DeleteTransaction(ctx context.Context, arg db.DeleteTransactionParams) error {
	return nil
}
func (m *mockQuerier) GetAccountByID(ctx context.Context, id pgtype.UUID) (db.Account, error) {
	return db.Account{}, nil
}
func (m *mockQuerier) GetBudgetByID(ctx context.Context, id pgtype.UUID) (db.Budget, error) {
	return db.Budget{}, nil
}
func (m *mockQuerier) GetCategoryByID(ctx context.Context, id pgtype.UUID) (db.Category, error) {
	return db.Category{}, nil
}
func (m *mockQuerier) GetExchangeRate(ctx context.Context, arg db.GetExchangeRateParams) (db.ExchangeRate, error) {
	return db.ExchangeRate{}, nil
}
func (m *mockQuerier) GetExpensesByPeriod(ctx context.Context, arg db.GetExpensesByPeriodParams) ([]db.GetExpensesByPeriodRow, error) {
	return nil, nil
}
func (m *mockQuerier) GetIncomeByPeriod(ctx context.Context, arg db.GetIncomeByPeriodParams) ([]db.GetIncomeByPeriodRow, error) {
	return nil, nil
}
func (m *mockQuerier) GetInsurancePolicyByID(ctx context.Context, id pgtype.UUID) (db.InsurancePolicy, error) {
	return db.InsurancePolicy{}, nil
}
func (m *mockQuerier) GetInvestmentByID(ctx context.Context, id pgtype.UUID) (db.Investment, error) {
	return db.Investment{}, nil
}
func (m *mockQuerier) GetLoanByID(ctx context.Context, id pgtype.UUID) (db.Loan, error) {
	return db.Loan{}, nil
}
func (m *mockQuerier) GetSavingsGoalByID(ctx context.Context, arg db.GetSavingsGoalByIDParams) (db.SavingsGoal, error) {
	return db.SavingsGoal{}, nil
}
func (m *mockQuerier) GetSipByID(ctx context.Context, id pgtype.UUID) (db.Sip, error) {
	return db.Sip{}, nil
}
func (m *mockQuerier) GetTagByID(ctx context.Context, arg db.GetTagByIDParams) (db.Tag, error) {
	return db.Tag{}, nil
}
func (m *mockQuerier) GetTransactionByID(ctx context.Context, id pgtype.UUID) (db.GetTransactionByIDRow, error) {
	return db.GetTransactionByIDRow{}, nil
}
func (m *mockQuerier) GetTransactionTags(ctx context.Context, transactionID pgtype.UUID) ([]db.Tag, error) {
	return nil, nil
}
func (m *mockQuerier) GetTransactionsByDateRange(ctx context.Context, arg db.GetTransactionsByDateRangeParams) ([]db.GetTransactionsByDateRangeRow, error) {
	return nil, nil
}
func (m *mockQuerier) GetUserByEmail(ctx context.Context, email string) (db.User, error) {
	return db.User{}, nil
}
func (m *mockQuerier) GetUserByID(ctx context.Context, id pgtype.UUID) (db.User, error) {
	return db.User{}, nil
}
func (m *mockQuerier) ListAccountsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Account, error) {
	return nil, nil
}
func (m *mockQuerier) ListBudgetsByUser(ctx context.Context, userID pgtype.UUID) ([]db.ListBudgetsByUserRow, error) {
	return nil, nil
}
func (m *mockQuerier) ListCategoriesByUser(ctx context.Context, userID pgtype.UUID) ([]db.Category, error) {
	return nil, nil
}
func (m *mockQuerier) ListCategoryKeywordsByUser(ctx context.Context, userID pgtype.UUID) ([]db.ListCategoryKeywordsByUserRow, error) {
	return nil, nil
}
func (m *mockQuerier) ListExchangeRates(ctx context.Context) ([]db.ExchangeRate, error) {
	return nil, nil
}
func (m *mockQuerier) ListInsurancePayments(ctx context.Context, policyID pgtype.UUID) ([]db.InsurancePayment, error) {
	return nil, nil
}
func (m *mockQuerier) ListInsurancePoliciesByUser(ctx context.Context, userID pgtype.UUID) ([]db.InsurancePolicy, error) {
	return nil, nil
}
func (m *mockQuerier) ListInvestmentTxByInvestment(ctx context.Context, investmentID pgtype.UUID) ([]db.InvestmentTransaction, error) {
	return nil, nil
}
func (m *mockQuerier) ListInvestmentsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Investment, error) {
	return nil, nil
}
func (m *mockQuerier) ListLoanPayments(ctx context.Context, loanID pgtype.UUID) ([]db.LoanPayment, error) {
	return nil, nil
}
func (m *mockQuerier) ListLoansByUser(ctx context.Context, userID pgtype.UUID) ([]db.Loan, error) {
	return nil, nil
}
func (m *mockQuerier) ListSavingsGoalsByUser(ctx context.Context, userID pgtype.UUID) ([]db.SavingsGoal, error) {
	return nil, nil
}
func (m *mockQuerier) ListSipsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Sip, error) {
	return nil, nil
}
func (m *mockQuerier) ListTagsByUser(ctx context.Context, userID pgtype.UUID) ([]db.Tag, error) {
	return nil, nil
}
func (m *mockQuerier) ListTransactionsByUser(ctx context.Context, arg db.ListTransactionsByUserParams) ([]db.ListTransactionsByUserRow, error) {
	return nil, nil
}
func (m *mockQuerier) SetTransactionTags(ctx context.Context, transactionID pgtype.UUID) error {
	return nil
}
func (m *mockQuerier) SumPaidAmount(ctx context.Context, loanID pgtype.UUID) (pgtype.Numeric, error) {
	return pgtype.Numeric{}, nil
}
func (m *mockQuerier) SumPaidPrincipal(ctx context.Context, loanID pgtype.UUID) (pgtype.Numeric, error) {
	return pgtype.Numeric{}, nil
}
func (m *mockQuerier) UpdateAccount(ctx context.Context, arg db.UpdateAccountParams) (db.Account, error) {
	return db.Account{}, nil
}
func (m *mockQuerier) UpdateBudget(ctx context.Context, arg db.UpdateBudgetParams) (db.Budget, error) {
	return db.Budget{}, nil
}
func (m *mockQuerier) UpdateCategory(ctx context.Context, arg db.UpdateCategoryParams) (db.Category, error) {
	return db.Category{}, nil
}
func (m *mockQuerier) UpdateInsurancePolicy(ctx context.Context, arg db.UpdateInsurancePolicyParams) (db.InsurancePolicy, error) {
	return db.InsurancePolicy{}, nil
}
func (m *mockQuerier) UpdateInvestment(ctx context.Context, arg db.UpdateInvestmentParams) (db.Investment, error) {
	return db.Investment{}, nil
}
func (m *mockQuerier) UpdateInvestmentComputed(ctx context.Context, arg db.UpdateInvestmentComputedParams) error {
	return nil
}
func (m *mockQuerier) UpdateLoan(ctx context.Context, arg db.UpdateLoanParams) (db.Loan, error) {
	return db.Loan{}, nil
}
func (m *mockQuerier) UpdateLoanComputed(ctx context.Context, arg db.UpdateLoanComputedParams) error {
	return nil
}
func (m *mockQuerier) UpdateSavingsGoal(ctx context.Context, arg db.UpdateSavingsGoalParams) (db.SavingsGoal, error) {
	return db.SavingsGoal{}, nil
}
func (m *mockQuerier) UpdateSip(ctx context.Context, arg db.UpdateSipParams) (db.Sip, error) {
	return db.Sip{}, nil
}
func (m *mockQuerier) UpdateSipCorpus(ctx context.Context, arg db.UpdateSipCorpusParams) error {
	return nil
}
func (m *mockQuerier) UpdateTag(ctx context.Context, arg db.UpdateTagParams) (db.Tag, error) {
	return db.Tag{}, nil
}
func (m *mockQuerier) UpdateTransaction(ctx context.Context, arg db.UpdateTransactionParams) (db.Transaction, error) {
	return db.Transaction{}, nil
}
func (m *mockQuerier) UpdateUser(ctx context.Context, arg db.UpdateUserParams) (db.User, error) {
	return db.User{}, nil
}
func (m *mockQuerier) UpsertExchangeRate(ctx context.Context, arg db.UpsertExchangeRateParams) error {
	return nil
}

// ---- Test helpers ----

// newTestAuthHandler returns an AuthHandler wired to the given mock querier.
func newTestAuthHandler(q db.Querier) *AuthHandler {
	// We pass nil for pool and jwtCfg because DeleteAccount does not use them.
	h := &AuthHandler{pool: nil, jwtCfg: nil, q: q}
	return h
}

// requestWithClaims injects JWT claims into the request context.
func requestWithClaims(r *http.Request, userID string) *http.Request {
	claims := &auth.Claims{UserID: userID}
	ctx := middleware.WithUserClaims(r.Context(), claims)
	return r.WithContext(ctx)
}

// ---- Tests ----

func TestDeleteAccount_Success(t *testing.T) {
	const testUserID = "00000000-0000-0000-0000-000000000001"

	mq := &mockQuerier{}
	h := newTestAuthHandler(mq)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/users/me", nil)
	req = requestWithClaims(req, testUserID)
	w := httptest.NewRecorder()

	h.DeleteAccount(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["message"] != "account deleted" {
		t.Errorf("expected message 'account deleted', got %q", resp["message"])
	}

	// Verify that the correct user UUID was passed to DeleteUser.
	wantUUID := stringToUUID(testUserID)
	if mq.deletedID != wantUUID {
		t.Errorf("DeleteUser called with %v, want %v", mq.deletedID, wantUUID)
	}
}

func TestDeleteAccount_Unauthenticated(t *testing.T) {
	mq := &mockQuerier{}
	h := newTestAuthHandler(mq)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/users/me", nil)
	// No claims injected.
	w := httptest.NewRecorder()

	h.DeleteAccount(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
