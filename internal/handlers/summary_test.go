package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestSummaryResponse_Fields verifies the SummaryResponse struct exposes
// both category_spending and income_category_spending fields that the
// frontend depends on.
func TestSummaryResponse_Fields(t *testing.T) {
	resp := SummaryResponse{
		TotalIncome:            1000.00,
		TotalExpenses:          500.00,
		CategorySpending:       nil,
		IncomeCategorySpending: nil,
		MonthlyNetworth:        nil,
		RecentTransactions:     nil,
		AccountBalances:        nil,
		BudgetStatus:           nil,
	}

	// Both slices should be nil-able (empty arrays once serialised with omitempty
	// is not used, they serialise as null — but the field must exist).
	if resp.TotalIncome != 1000.00 {
		t.Errorf("TotalIncome = %v, want 1000.00", resp.TotalIncome)
	}
}

// TestSummaryResponse_JSONFields verifies that the JSON serialisation of
// SummaryResponse includes the income_category_spending key.
func TestSummaryResponse_JSONFields(t *testing.T) {
	resp := SummaryResponse{
		TotalIncome:            250.00,
		TotalExpenses:          100.00,
		CategorySpending:       nil,
		IncomeCategorySpending: nil,
	}

	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal SummaryResponse: %v", err)
	}

	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if _, ok := m["income_category_spending"]; !ok {
		t.Error("expected key 'income_category_spending' in JSON response, but it was missing")
	}
	if _, ok := m["category_spending"]; !ok {
		t.Error("expected key 'category_spending' in JSON response, but it was missing")
	}
	if _, ok := m["total_income"]; !ok {
		t.Error("expected key 'total_income' in JSON response, but it was missing")
	}
}

// TestGetSummary_Unauthenticated verifies the handler returns 401 when no
// JWT claims are present in the request context.
func TestGetSummary_Unauthenticated(t *testing.T) {
	h := &SummaryHandler{pool: nil, q: nil, cq: nil}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/summary", nil)
	// No claims injected — middleware.GetUserClaims will return nil.
	w := httptest.NewRecorder()

	h.GetSummary(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d (body: %s)", w.Code, w.Body.String())
	}
}
