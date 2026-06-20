package handlers

import (
	"math"
	"testing"
	"time"
)

// approxEqual returns true when a and b differ by less than epsilon.
func approxEqual(a, b, epsilon float64) bool {
	return math.Abs(a-b) < epsilon
}

func TestComputeAmortization_Standard(t *testing.T) {
	// principal=100000, rate=10%, term=12 months
	// Expected EMI ≈ 8791.59
	// First installment interest ≈ 833.33
	start := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	result, err := computeAmortization(100000, 10.0, 12, start)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Schedule) != 12 {
		t.Fatalf("expected 12 rows, got %d", len(result.Schedule))
	}

	const wantEMI = 8791.59
	if !approxEqual(result.EMI, wantEMI, 1.0) {
		t.Errorf("EMI: want ~%.2f, got %.2f", wantEMI, result.EMI)
	}

	firstRow := result.Schedule[0]
	const wantInterest = 833.33
	if !approxEqual(firstRow.InterestComponent, wantInterest, 0.5) {
		t.Errorf("first installment interest: want ~%.2f, got %.2f", wantInterest, firstRow.InterestComponent)
	}

	// Payment date for first installment should be 2024-01-01
	if firstRow.PaymentDate != "2024-01-01" {
		t.Errorf("first payment date: want 2024-01-01, got %s", firstRow.PaymentDate)
	}

	// Payment date for second installment should be 2024-02-01
	if result.Schedule[1].PaymentDate != "2024-02-01" {
		t.Errorf("second payment date: want 2024-02-01, got %s", result.Schedule[1].PaymentDate)
	}

	// Total payment should be approximately EMI * 12
	if !approxEqual(result.TotalPayment, result.EMI*12, 1.0) {
		t.Errorf("total payment mismatch: %.2f vs %.2f", result.TotalPayment, result.EMI*12)
	}
}

func TestComputeAmortization_ZeroInterest(t *testing.T) {
	// principal=12000, rate=0%, term=12 → each principal component = 1000, interest = 0
	start := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	result, err := computeAmortization(12000, 0.0, 12, start)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Schedule) != 12 {
		t.Fatalf("expected 12 rows, got %d", len(result.Schedule))
	}

	for i, row := range result.Schedule {
		if !approxEqual(row.PrincipalComponent, 1000.0, 0.01) {
			t.Errorf("installment %d principal: want 1000.00, got %.2f", i+1, row.PrincipalComponent)
		}
		if row.InterestComponent != 0 {
			t.Errorf("installment %d interest: want 0, got %.2f", i+1, row.InterestComponent)
		}
	}

	// Final balance should be 0
	lastRow := result.Schedule[len(result.Schedule)-1]
	if !approxEqual(lastRow.RemainingBalance, 0, 0.01) {
		t.Errorf("final balance: want 0, got %.2f", lastRow.RemainingBalance)
	}
}

func TestComputeAmortization_InsufficientData_ZeroTerm(t *testing.T) {
	start := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	_, err := computeAmortization(100000, 10.0, 0, start)
	if err == nil {
		t.Fatal("expected error for term=0, got nil")
	}
}

func TestComputeAmortization_InsufficientData_ZeroBalance(t *testing.T) {
	start := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	_, err := computeAmortization(0, 10.0, 12, start)
	if err == nil {
		t.Fatal("expected error for balance=0, got nil")
	}
}
