package mcp

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestContainsIgnoreCase_ExactMatch(t *testing.T) {
	if !containsIgnoreCase("hello world", "world") {
		t.Error("expected true")
	}
}

func TestContainsIgnoreCase_CaseInsensitive(t *testing.T) {
	if !containsIgnoreCase("Hello World", "hello") {
		t.Error("expected true")
	}
}

func TestContainsIgnoreCase_NotFound(t *testing.T) {
	if containsIgnoreCase("hello world", "xyz") {
		t.Error("expected false")
	}
}

func TestContainsIgnoreCase_EmptySubstring(t *testing.T) {
	if !containsIgnoreCase("hello", "") {
		t.Error("expected true for empty substring")
	}
}

func TestContainsIgnoreCase_SubstringLonger(t *testing.T) {
	if containsIgnoreCase("", "hello") {
		t.Error("expected false")
	}
}

func TestEqualIgnoreCase_Same(t *testing.T) {
	if !equalIgnoreCase("hello", "hello") {
		t.Error("expected true")
	}
}

func TestEqualIgnoreCase_DifferentCase(t *testing.T) {
	if !equalIgnoreCase("Hello", "hello") {
		t.Error("expected true")
	}
}

func TestEqualIgnoreCase_DifferentLength(t *testing.T) {
	if equalIgnoreCase("hello", "hello world") {
		t.Error("expected false")
	}
}

func TestEqualIgnoreCase_Empty(t *testing.T) {
	if !equalIgnoreCase("", "") {
		t.Error("expected true")
	}
}

func TestGetUserID_Success(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserIDKey, "user-123")
	got, ok := GetUserID(ctx)
	if !ok || got != "user-123" {
		t.Errorf("got %q, %v; want \"user-123\", true", got, ok)
	}
}

func TestGetUserID_Missing(t *testing.T) {
	_, ok := GetUserID(context.Background())
	if ok {
		t.Error("expected false for empty context")
	}
}

func TestRequireUserID_Success(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserIDKey, "user-123")
	got, err := requireUserID(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "user-123" {
		t.Errorf("got %q, want \"user-123\"", got)
	}
}

func TestRequireUserID_Missing(t *testing.T) {
	_, err := requireUserID(context.Background())
	if err == nil {
		t.Error("expected error for empty context")
	}
}

func TestRequireUserID_EmptyString(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserIDKey, "")
	_, err := requireUserID(ctx)
	if err == nil {
		t.Error("expected error for empty string user ID")
	}
}

// Regression: read-only tools must report DestructiveHint=false so MCP clients
// (Claude Desktop, Cursor, etc.) don't warn the user or refuse to call them.
// All mcp.NewTool() calls default to DestructiveHint=true, so each read-only
// tool must opt out explicitly.
func TestReadOnlyTools_NotDestructive(t *testing.T) {
	readOnly := []struct {
		name string
		tool mcp.Tool
	}{
		{"list_transactions", listTransactionsTool()},
		{"get_transaction", getTransactionTool()},
		{"list_accounts", listAccountsTool()},
		{"list_categories", listCategoriesTool()},
		{"get_summary", getSummaryTool()},
		{"list_budgets", listBudgetsTool()},
		{"list_investments", listInvestmentsTool()},
	}
	for _, tc := range readOnly {
		if tc.tool.Annotations.DestructiveHint == nil {
			t.Errorf("%s: DestructiveHint is nil (should be set explicitly to false)", tc.name)
			continue
		}
		if *tc.tool.Annotations.DestructiveHint {
			t.Errorf("%s: DestructiveHint=true (should be false for read-only tool)", tc.name)
		}
		if tc.tool.Annotations.ReadOnlyHint == nil {
			t.Errorf("%s: ReadOnlyHint is nil (should be set explicitly to true)", tc.name)
			continue
		}
		if !*tc.tool.Annotations.ReadOnlyHint {
			t.Errorf("%s: ReadOnlyHint=false (should be true for read-only tool)", tc.name)
		}
	}
}

// Regression: mutating tools must keep DestructiveHint=true so MCP clients
// prompt the user before invoking them.
func TestMutatingTools_AreDestructive(t *testing.T) {
	mutating := []struct {
		name string
		tool mcp.Tool
	}{
		{"create_transaction", createTransactionTool()},
		{"update_transaction", updateTransactionTool()},
		{"delete_transaction", deleteTransactionTool()},
		{"create_account", createAccountTool()},
		{"categorise_transactions", categoriseTransactionsTool()},
	}
	for _, tc := range mutating {
		if tc.tool.Annotations.DestructiveHint == nil || !*tc.tool.Annotations.DestructiveHint {
			t.Errorf("%s: DestructiveHint should be true for mutating tool", tc.name)
		}
	}
}

// Regression: update_transaction COALESCE bug.
// Live test against money.shenthar.me on 2026-06-04 returned:
//   "update failed: ERROR: COALESCE types text and uuid cannot be matched (SQLSTATE 42804)"
// Root cause: the SQL bound a Go `string` ($7 = catID) directly to a `uuid`
// column, and the same risk exists for $3 (accountID).
// Fix: wrap with COALESCE(NULLIF($N, '')::uuid, <col>) like the other branches.
func TestUpdateTransactionSQL_UsesCOALESCEForUUIDColumns(t *testing.T) {
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	mustContain := []string{
		`category_id = COALESCE(NULLIF($7, '')::uuid, category_id)`,
		`account_id = COALESCE(NULLIF($3, '')::uuid, account_id)`,
	}
	for _, want := range mustContain {
		if !strings.Contains(src, want) {
			t.Errorf("tools.go missing SQL fragment: %q\n(add it inside the UPDATE in updateTransactionHandler)", want)
		}
	}
	// Negative assertion: the broken pattern must not be present.
	notWant := []string{
		"category_id = $7",
		"account_id = $3",
	}
	for _, bad := range notWant {
		if strings.Contains(src, bad) {
			t.Errorf("tools.go still contains broken SQL fragment: %q", bad)
		}
	}
}

// Regression: update_transaction `type` column is a Postgres ENUM
// (transaction_type). Same COALESCE-mismatch class as the uuid columns:
// NULLIF($4, '') returns text, COALESCE on text vs an enum fails with
// "COALESCE types text and transaction_type cannot be matched".
// Live test on 2026-06-04 hit this with $4='' (the update scenario where
// type is left unchanged).
func TestUpdateTransactionSQL_UsesCOALESCEForEnumTypeColumn(t *testing.T) {
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	want := `type = COALESCE(NULLIF($4, '')::transaction_type, type)`
	if !strings.Contains(src, want) {
		t.Errorf("tools.go missing SQL fragment: %q\n(add it inside the UPDATE in updateTransactionHandler)", want)
	}
}

// TestNetWorthTools_Registered ensures all four net-worth tools are
// exposed to MCP clients. An LLM agent can't manage net worth through
// the server if any of these are missing.
func TestNetWorthTools_Registered(t *testing.T) {
	want := []string{
		"list_loans",
		"get_loan",
		"list_insurance",
		"get_networth",
	}
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	for _, name := range want {
		ctor := snakeToCamel(name) + "Tool"
		if !strings.Contains(src, "func "+ctor+"()") {
			t.Errorf("missing tool constructor %q (expected func %s)", name, ctor)
		}
		if !strings.Contains(src, "{Tool: "+ctor+"()") {
			t.Errorf("%s not wired into RegisterTools", ctor)
		}
	}
}

// TestNetWorthTools_AllReadOnly: list_loans, get_loan, list_insurance,
// get_networth are all read-only. An LLM agent should be able to call
// them without the user being prompted for destructive-action consent.
func TestNetWorthTools_AllReadOnly(t *testing.T) {
	tools := map[string]mcp.Tool{
		"list_loans":     listLoansTool(),
		"get_loan":       getLoanTool(),
		"list_insurance": listInsuranceTool(),
		"get_networth":   getNetworthTool(),
	}
	for name, tool := range tools {
		if tool.Annotations.DestructiveHint == nil || *tool.Annotations.DestructiveHint {
			t.Errorf("%s: DestructiveHint should be false (read-only tool)", name)
		}
		if tool.Annotations.ReadOnlyHint == nil || !*tool.Annotations.ReadOnlyHint {
			t.Errorf("%s: ReadOnlyHint should be true (read-only tool)", name)
		}
	}
}

// TestGetNetworthTool_TakesNoRequiredParams: an LLM should be able to
// call get_networth with zero arguments. The handler reads the user's
// default_currency from context — anything else would force the agent
// to discover the user's preferred currency first.
func TestGetNetworthTool_TakesNoRequiredParams(t *testing.T) {
	tool := getNetworthTool()
	if len(tool.InputSchema.Required) != 0 {
		t.Errorf("get_networth must not require any arguments; InputSchema.Required = %v", tool.InputSchema.Required)
	}
}

// TestGetNetworthSQL_AggregatesAcrossAllSources: the net-worth query
// must sum assets (bank/wallet/cash/savings accounts + investments) and
// liabilities (credit_card accounts + loan outstanding balances). If
// any of these sources is missing, the agent's number is wrong.
func TestGetNetworthSQL_AggregatesAcrossAllSources(t *testing.T) {
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	// Must touch every relevant table. A missing source means the
	// agent can call get_networth and get a confidently-wrong answer.
	mustReference := []string{
		"FROM accounts",         // bank + credit_card balances
		"FROM investments",      // investment values
		"FROM loans",            // outstanding balance
		"asset",                 // asset/liability classification
		"outstanding_balance",   // loan liability
	}
	for _, want := range mustReference {
		if !strings.Contains(src, want) {
			t.Errorf("get_networth source missing reference to %q (the net-worth number will be wrong)", want)
		}
	}
}

// TestGetNetworthSQL_HandlesNullBalances: investment quantity and
// current_price can be NULL (e.g. for real estate or fixed deposits
// that don't have a market price). outstanding_balance on a loan can
// also be NULL when the user hasn't entered it. The aggregation must
// use COALESCE to treat NULL as 0, not NULL + NULL = NULL.
func TestGetNetworthSQL_HandlesNullBalances(t *testing.T) {
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	want := []string{
		"COALESCE",   // for NULL handling on balances/prices
		"quantity",
		"current_price",
	}
	for _, w := range want {
		if !strings.Contains(src, w) {
			t.Errorf("get_networth source missing %q", w)
		}
	}
}

func lowerFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToLower(s[:1]) + s[1:]
}

// snakeToCamel converts a snake_case tool name (e.g. "list_loans") to
// the Go CamelCase identifier suffix used by the constructor
// (e.g. "listLoans").
func snakeToCamel(s string) string {
	parts := strings.Split(s, "_")
	if len(parts) == 1 {
		return strings.ToLower(s)
	}
	out := strings.ToLower(parts[0])
	for _, p := range parts[1:] {
		if p == "" {
			continue
		}
		out += strings.ToUpper(p[:1]) + p[1:]
	}
	return out
}

// ============================================================================
// Write-tool coverage tests (groups 1-7 of the net-worth batch)
// ============================================================================

// TestWriteToolsForNetWorth_Registered: every tool needed for an LLM
// agent to actually MANAGE net worth (not just read it) must be
// registered. If any of these is missing, the agent's "I added a new
// loan" prompt silently fails.
func TestWriteToolsForNetWorth_Registered(t *testing.T) {
	want := []string{
		// accounts
		"update_account", "delete_account",
		// categories
		"create_category", "update_category", "delete_category",
		// budgets
		"create_budget", "update_budget", "delete_budget",
		// investments
		"create_investment", "update_investment", "delete_investment",
		// loans + payments
		"create_loan", "update_loan", "delete_loan",
		"create_loan_payment", "update_loan_payment", "mark_loan_payment_paid",
		// insurance + payments
		"create_insurance", "update_insurance", "delete_insurance",
		"create_insurance_payment", "mark_insurance_premium_paid",
		// currency + profile
		"get_exchange_rates", "set_exchange_rate", "update_user_profile",
	}
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	for _, name := range want {
		ctor := snakeToCamel(name) + "Tool"
		if !strings.Contains(src, "func "+ctor+"()") {
			t.Errorf("missing tool constructor %q (expected func %s)", name, ctor)
		}
		if !strings.Contains(src, "{Tool: "+ctor+"()") {
			t.Errorf("%s not wired into RegisterTools", ctor)
		}
	}
}

// TestWriteToolsForNetWorth_AllDestructive: every write tool listed
// in TestWriteToolsForNetWorth_Registered must report DestructiveHint
// (or OpenWorldHint) so the client asks the user before invoking.
// Otherwise a malicious prompt could mutate the user's books without
// consent.
func TestWriteToolsForNetWorth_AllDestructive(t *testing.T) {
	tools := map[string]mcp.Tool{
		// accounts
		"update_account": updateAccountTool(),
		"delete_account": deleteAccountTool(),
		// categories
		"create_category": createCategoryTool(),
		"update_category": updateCategoryTool(),
		"delete_category": deleteCategoryTool(),
		// budgets
		"create_budget": createBudgetTool(),
		"update_budget": updateBudgetTool(),
		"delete_budget": deleteBudgetTool(),
		// investments
		"create_investment": createInvestmentTool(),
		"update_investment": updateInvestmentTool(),
		"delete_investment": deleteInvestmentTool(),
		// loans + payments
		"create_loan":            createLoanTool(),
		"update_loan":            updateLoanTool(),
		"delete_loan":            deleteLoanTool(),
		"create_loan_payment":    createLoanPaymentTool(),
		"update_loan_payment":    updateLoanPaymentTool(),
		"mark_loan_payment_paid": markLoanPaymentPaidTool(),
		// insurance + payments
		"create_insurance":            createInsuranceTool(),
		"update_insurance":            updateInsuranceTool(),
		"delete_insurance":            deleteInsuranceTool(),
		"create_insurance_payment":    createInsurancePaymentTool(),
		"mark_insurance_premium_paid": markInsurancePremiumPaidTool(),
		// currency + profile
		"set_exchange_rate":   setExchangeRateTool(),
		"update_user_profile": updateUserProfileTool(),
	}
	for name, tool := range tools {
		if tool.Annotations.DestructiveHint == nil || !*tool.Annotations.DestructiveHint {
			t.Errorf("%s: DestructiveHint should be true for write tool", name)
		}
	}
}

// TestSoftDelete_AccountLoanInsuranceInsurancePayment: all DELETE-style
// tools must use soft-delete (UPDATE ... SET deleted_at = now()) — never
// a hard DELETE — so historical transactions, snapshots, and reports
// stay intact when a resource is removed.
func TestSoftDelete_AccountLoanInsuranceInsurancePayment(t *testing.T) {
	src, err := readSourceFile("tools.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	// Each delete handler must touch a deleted_at column. If any of
	// these is missing, the corresponding tool will hard-delete and
	// break historical reporting.
	mustUpdate := []string{
		"UPDATE accounts SET deleted_at = now()",     // delete_account
		"UPDATE loans SET deleted_at = now()",        // delete_loan
		"UPDATE insurance_policies SET deleted_at",   // delete_insurance
	}
	for _, want := range mustUpdate {
		if !strings.Contains(src, want) {
			t.Errorf("missing soft-delete SQL fragment: %q", want)
		}
	}
}

// Regression: list_transactions returned "null" (text) when no rows matched,
// because the handler used `var results []map[string]any` (nil slice) and
// encoding/json marshals a nil slice as "null". MCP clients expect "[]".
// Fix: initialize to an empty slice (or normalize before marshal).
func TestMarshalAsJSONArray_EmptySliceBecomesEmptyArray(t *testing.T) {
	got, err := marshalAsJSONArray([]map[string]any(nil))
	if err != nil {
		t.Fatalf("marshalAsJSONArray: %v", err)
	}
	if got != "[]" {
		t.Errorf("nil slice should marshal to %q, got %q", "[]", got)
	}
}

func TestMarshalAsJSONArray_NonEmptyRoundTrip(t *testing.T) {
	in := []map[string]any{{"id": "abc", "amount": "12.50"}}
	got, err := marshalAsJSONArray(in)
	if err != nil {
		t.Fatalf("marshalAsJSONArray: %v", err)
	}
	if !strings.Contains(got, `"id":"abc"`) || !strings.Contains(got, `"amount":"12.50"`) {
		t.Errorf("unexpected marshal output: %s", got)
	}
}

// readSourceFile is a tiny helper for the SQL-regression test. It reads a
// file from the same package directory.
func readSourceFile(name string) (string, error) {
	// The test runs with the package's working dir, so a relative path works.
	data, err := os.ReadFile(name)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
