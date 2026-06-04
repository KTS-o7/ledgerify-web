package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCategorize_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("expected Bearer test-key, got %s", r.Header.Get("Authorization"))
		}
		if r.Header.Get("User-Agent") != "curl/8.4.0" {
			t.Errorf("expected curl/8.4.0, got %s", r.Header.Get("User-Agent"))
		}

		resp := chatResponse{
			Choices: []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			}{
				{Message: struct {
					Content string `json:"content"`
				}{Content: `{"category": "Transportation"}`}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "test-model", "curl/8.4.0")
	categories := []Category{
		{ID: "1", Name: "Transportation"},
		{ID: "2", Name: "Groceries"},
	}

	result, err := client.Categorize(context.Background(), "UBER TRIP 12.45", categories)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "Transportation" {
		t.Errorf("expected Transportation, got %s", result)
	}
}

func TestCategorize_Uncategorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := chatResponse{
			Choices: []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			}{
				{Message: struct {
					Content string `json:"content"`
				}{Content: `{"category": "Uncategorized"}`}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "test-model", "curl/8.4.0")
	result, err := client.Categorize(context.Background(), "RANDOM TEXT", []Category{
		{ID: "1", Name: "Transportation"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "" {
		t.Errorf("expected empty string for Uncategorized, got %s", result)
	}
}

func TestCategorize_NotConfigured(t *testing.T) {
	client := NewClient("", "", "", "")
	_, err := client.Categorize(context.Background(), "test", nil)
	if err == nil {
		t.Error("expected error when not configured")
	}
}

func TestCategorize_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "test-model", "curl/8.4.0")
	_, err := client.Categorize(context.Background(), "test", nil)
	if err == nil {
		t.Error("expected error on server error")
	}
}
