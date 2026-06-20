package handlers

import (
	"testing"
)

// TestNewNetWorthSnapshotHandler verifies the handler can be instantiated with
// a nil pool without panicking.  Integration tests (which need a real DB) are
// left to the CI environment.
func TestNewNetWorthSnapshotHandler_NilPool(t *testing.T) {
	h := NewNetWorthSnapshotHandler(nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
	if h.pool != nil {
		t.Fatal("expected pool to be nil for this unit test")
	}
}

// TestSnapshotResponse_Fields verifies the SnapshotResponse struct has the
// expected exported fields the frontend depends on.
func TestSnapshotResponse_Fields(t *testing.T) {
	s := SnapshotResponse{
		ID:               "abc",
		AsOf:             "2025-01-01T00:00:00Z",
		Currency:         "INR",
		TotalAssets:      100000,
		TotalLiabilities: 50000,
		NetWorth:         50000,
		Note:             nil,
	}
	if s.ID == "" {
		t.Error("ID should not be empty")
	}
	if s.Currency != "INR" {
		t.Errorf("Currency = %q, want INR", s.Currency)
	}
	if s.NetWorth != 50000 {
		t.Errorf("NetWorth = %v, want 50000", s.NetWorth)
	}
}
