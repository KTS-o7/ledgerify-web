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
