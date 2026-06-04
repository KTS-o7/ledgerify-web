package mcp

import (
	"context"
	"testing"
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
