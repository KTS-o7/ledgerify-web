package recurring

import (
	"testing"
	"time"
)

func TestComputeNext_Weekly(t *testing.T) {
	last := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	got := ComputeNext(last, "weekly", nil, nil)
	want := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestComputeNext_Monthly(t *testing.T) {
	last := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	got := ComputeNext(last, "monthly", nil, nil)
	want := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestComputeNext_Monthly_ClampsToMonthEnd(t *testing.T) {
	last := time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC)
	got := ComputeNext(last, "monthly", nil, nil)
	want := time.Date(2026, 2, 28, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestComputeNext_Custom_Days(t *testing.T) {
	last := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	n := 14
	unit := "day"
	got := ComputeNext(last, "custom", &n, &unit)
	want := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestGenerateOccurrences_Weekly(t *testing.T) {
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	asOf := time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC)
	dates := GenerateOccurrences(start, asOf, "weekly", nil, nil, nil)
	if len(dates) != 5 {
		t.Errorf("expected 5 weekly occurrences, got %d: %v", len(dates), dates)
	}
	want := []time.Time{
		time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 22, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC),
	}
	for i, d := range dates {
		if !d.Equal(want[i]) {
			t.Errorf("occurrence %d: got %v, want %v", i, d, want[i])
		}
	}
}

func TestGenerateOccurrences_RespectsEndDate(t *testing.T) {
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	asOf := time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC)
	dates := GenerateOccurrences(start, asOf, "weekly", nil, nil, &end)
	if len(dates) != 3 {
		t.Errorf("expected 3 occurrences before end_date, got %d: %v", len(dates), dates)
	}
}

func TestGenerateOccurrences_Empty(t *testing.T) {
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	asOf := time.Date(2026, 5, 30, 0, 0, 0, 0, time.UTC)
	dates := GenerateOccurrences(start, asOf, "monthly", nil, nil, nil)
	if len(dates) != 0 {
		t.Errorf("expected 0 occurrences (asOf before start), got %d", len(dates))
	}
}
