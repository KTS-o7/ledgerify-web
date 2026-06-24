package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecurringHandler_Create_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	body, _ := json.Marshal(map[string]any{"name": "Rent"})
	r := httptest.NewRequest("POST", "/", strings.NewReader(string(body)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Create(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_Create_InvalidJSON_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	r := httptest.NewRequest("POST", "/", strings.NewReader("not json"))
	w := httptest.NewRecorder()
	h.Create(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_SetStatus_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	body, _ := json.Marshal(map[string]string{"status": "weird"})
	r := httptest.NewRequest("POST", "/status", strings.NewReader(string(body)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.SetStatus(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_List_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	r := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	h.List(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_Get_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	r := httptest.NewRequest("GET", "/abc", nil)
	w := httptest.NewRecorder()
	h.Get(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_Delete_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	r := httptest.NewRequest("DELETE", "/abc", nil)
	w := httptest.NewRecorder()
	h.Delete(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_Update_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	body, _ := json.Marshal(map[string]any{"name": "X"})
	r := httptest.NewRequest("PUT", "/abc", strings.NewReader(string(body)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Update(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRecurringHandler_RunNow_NoClaims(t *testing.T) {
	h := &RecurringHandler{}
	r := httptest.NewRequest("POST", "/run-now", nil)
	w := httptest.NewRecorder()
	h.RunNow(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}
