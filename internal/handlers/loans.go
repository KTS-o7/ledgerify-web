package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/recalc"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type LoanHandler struct {
	q      *db.Queries
	recalc *recalc.Service
}

func NewLoanHandler(q *db.Queries, recalc *recalc.Service) *LoanHandler {
	return &LoanHandler{q: q, recalc: recalc}
}

type createLoanRequest struct {
	Name               string   `json:"name"`
	LoanType           string   `json:"loan_type"`
	Principal          *float64 `json:"principal"`
	InterestRate       *float64 `json:"interest_rate"`
	TenureMonths       int32    `json:"term_months"`
	StartDate          string   `json:"start_date"`
	EmiAmount          *float64 `json:"emi_amount"`
	Currency           string   `json:"currency"`
	OutstandingBalance *float64 `json:"outstanding_balance"`
}

type updateLoanRequest struct {
	Name               string   `json:"name"`
	LoanType           string   `json:"loan_type"`
	Principal          *float64 `json:"principal"`
	InterestRate       *float64 `json:"interest_rate"`
	TenureMonths       int32    `json:"term_months"`
	StartDate          string   `json:"start_date"`
	EmiAmount          *float64 `json:"emi_amount"`
	Currency           string   `json:"currency"`
	OutstandingBalance *float64 `json:"outstanding_balance"`
}

type createLoanPaymentRequest struct {
	Date               string   `json:"date"`
	Amount             *float64 `json:"amount"`
	PrincipalComponent *float64 `json:"principal_component"`
	InterestComponent  *float64 `json:"interest_component"`
	Status             string   `json:"status"`
}

// fireRecalc runs the per-user recalculation in the background.
func (h *LoanHandler) fireRecalc(userID string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = h.recalc.RecalculateUser(ctx, userID)
	}()
}

// GET /api/v1/loans
func (h *LoanHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	loans, err := h.q.ListLoansByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if loans == nil {
		loans = []db.Loan{}
	}

	utils.OK(w, loans)
}

// POST /api/v1/loans
func (h *LoanHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createLoanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.LoanType == "" || req.Currency == "" {
		utils.BadRequest(w, "name, loan_type, and currency are required")
		return
	}

	// Default outstanding balance to principal when the caller didn't supply
	// one — the recalc engine assumes the loan is fresh in that case.
	if req.OutstandingBalance == nil && req.Principal != nil {
		ob := *req.Principal
		req.OutstandingBalance = &ob
	}

	var loanType db.LoanType
	switch req.LoanType {
	case "home":
		loanType = db.LoanTypeHome
	case "personal":
		loanType = db.LoanTypePersonal
	case "vehicle":
		loanType = db.LoanTypeVehicle
	case "education":
		loanType = db.LoanTypeEducation
	case "other":
		loanType = db.LoanTypeOther
	default:
		utils.BadRequest(w, "invalid loan_type. Must be one of: home, personal, vehicle, education, other")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	var principal, interestRate, emiAmount, outstandingBalance pgtype.Numeric
	if req.Principal != nil {
		principal.Scan(strconv.FormatFloat(*req.Principal, 'f', -1, 64))
	} else {
		principal.Scan("0")
	}
	if req.InterestRate != nil {
		interestRate.Scan(strconv.FormatFloat(*req.InterestRate, 'f', -1, 64))
	} else {
		interestRate.Scan("0")
	}
	if req.EmiAmount != nil {
		emiAmount.Scan(strconv.FormatFloat(*req.EmiAmount, 'f', -1, 64))
	} else {
		emiAmount.Scan("0")
	}
	if req.OutstandingBalance != nil {
		outstandingBalance.Scan(strconv.FormatFloat(*req.OutstandingBalance, 'f', -1, 64))
	}

	var startDate pgtype.Date
	if req.StartDate != "" {
		startDate.Scan(fmt.Sprint(req.StartDate))
		startDate.Valid = true
	}

	loan, err := h.q.CreateLoan(r.Context(), db.CreateLoanParams{
		UserID:             userUUID,
		Name:               req.Name,
		LoanType:           loanType,
		Principal:          principal,
		InterestRate:       interestRate,
		TenureMonths:       req.TenureMonths,
		StartDate:          startDate,
		EmiAmount:          emiAmount,
		Currency:           req.Currency,
		OutstandingBalance: outstandingBalance,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	h.fireRecalc(claims.UserID)
	utils.Created(w, loan)
}

// GET /api/v1/loans/{id}
func (h *LoanHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	loanID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	loan, err := h.q.GetLoanByID(r.Context(), loanID)
	if err != nil {
		utils.NotFound(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	if loan.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	utils.OK(w, loan)
}

// PUT /api/v1/loans/{id}
func (h *LoanHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	loanID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	userUUID := stringToUUID(claims.UserID)

	// Verify ownership
	existing, err := h.q.GetLoanByID(r.Context(), loanID)
	if err != nil || existing.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req updateLoanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.LoanType == "" || req.Currency == "" {
		utils.BadRequest(w, "name, loan_type, and currency are required")
		return
	}

	if req.OutstandingBalance == nil && req.Principal != nil {
		ob := *req.Principal
		req.OutstandingBalance = &ob
	}

	var loanType db.LoanType
	switch req.LoanType {
	case "home":
		loanType = db.LoanTypeHome
	case "personal":
		loanType = db.LoanTypePersonal
	case "vehicle":
		loanType = db.LoanTypeVehicle
	case "education":
		loanType = db.LoanTypeEducation
	case "other":
		loanType = db.LoanTypeOther
	default:
		utils.BadRequest(w, "invalid loan_type. Must be one of: home, personal, vehicle, education, other")
		return
	}

	var principal, interestRate, emiAmount, outstandingBalance pgtype.Numeric
	if req.Principal != nil {
		principal.Scan(strconv.FormatFloat(*req.Principal, 'f', -1, 64))
	} else {
		principal.Scan("0")
	}
	if req.InterestRate != nil {
		interestRate.Scan(strconv.FormatFloat(*req.InterestRate, 'f', -1, 64))
	} else {
		interestRate.Scan("0")
	}
	if req.EmiAmount != nil {
		emiAmount.Scan(strconv.FormatFloat(*req.EmiAmount, 'f', -1, 64))
	} else {
		emiAmount.Scan("0")
	}
	if req.OutstandingBalance != nil {
		outstandingBalance.Scan(strconv.FormatFloat(*req.OutstandingBalance, 'f', -1, 64))
	}

	var startDate pgtype.Date
	if req.StartDate != "" {
		startDate.Scan(fmt.Sprint(req.StartDate))
		startDate.Valid = true
	}

	loan, err := h.q.UpdateLoan(r.Context(), db.UpdateLoanParams{
		ID:                 loanID,
		Name:               req.Name,
		LoanType:           loanType,
		Principal:          principal,
		InterestRate:       interestRate,
		TenureMonths:       req.TenureMonths,
		StartDate:          startDate,
		EmiAmount:          emiAmount,
		Currency:           req.Currency,
		OutstandingBalance: outstandingBalance,
		UserID:             userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	h.fireRecalc(claims.UserID)
	utils.OK(w, loan)
}

// DELETE /api/v1/loans/{id}
func (h *LoanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	loanID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteLoan(r.Context(), db.DeleteLoanParams{
		ID:     loanID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "loan deleted"})
}

// GET /api/v1/loans/{id}/payments
func (h *LoanHandler) ListPayments(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	loanID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	// Verify ownership
	loan, err := h.q.GetLoanByID(r.Context(), loanID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if loan.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	payments, err := h.q.ListLoanPayments(r.Context(), loanID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if payments == nil {
		payments = []db.LoanPayment{}
	}

	utils.OK(w, payments)
}

// amortizationRow is a single row in the amortization schedule.
type amortizationRow struct {
	Installment        int     `json:"installment"`
	PaymentDate        string  `json:"payment_date"`
	EMI                float64 `json:"emi"`
	PrincipalComponent float64 `json:"principal_component"`
	InterestComponent  float64 `json:"interest_component"`
	RemainingBalance   float64 `json:"remaining_balance"`
}

// amortizationResponse is the full amortization schedule response.
type amortizationResponse struct {
	LoanID       string            `json:"loan_id"`
	LoanName     string            `json:"loan_name"`
	EMI          float64           `json:"emi"`
	TotalPayment float64           `json:"total_payment"`
	TotalInterest float64          `json:"total_interest"`
	Schedule     []amortizationRow `json:"schedule"`
}

// computeAmortization builds a full reducing-balance amortization schedule.
// It is exported (via the internal test) as a pure function so unit tests
// can exercise the math without a real HTTP round-trip.
func computeAmortization(outstandingBalance, annualRatePct float64, termMonths int, startDate time.Time) (amortizationResponse, error) {
	if outstandingBalance == 0 || termMonths == 0 {
		return amortizationResponse{}, fmt.Errorf("insufficient loan data for amortization")
	}

	n := termMonths
	r := annualRatePct / 100.0 / 12.0

	var emi float64
	if r == 0 {
		emi = outstandingBalance / float64(n)
	} else {
		factor := math.Pow(1+r, float64(n))
		emi = outstandingBalance * r * factor / (factor - 1)
	}

	schedule := make([]amortizationRow, 0, n)
	balance := outstandingBalance
	var totalPayment, totalInterest float64

	for i := 1; i <= n; i++ {
		interest := balance * r
		principal := emi - interest
		// Clamp final installment rounding
		if principal > balance {
			principal = balance
		}
		balance -= principal
		if balance < 0 {
			balance = 0
		}

		paymentDate := startDate.AddDate(0, i-1, 0)

		schedule = append(schedule, amortizationRow{
			Installment:        i,
			PaymentDate:        paymentDate.Format("2006-01-02"),
			EMI:                math.Round(emi*100) / 100,
			PrincipalComponent: math.Round(principal*100) / 100,
			InterestComponent:  math.Round(interest*100) / 100,
			RemainingBalance:   math.Round(balance*100) / 100,
		})

		totalPayment += emi
		totalInterest += interest
	}

	// Use the loan's UUID from the caller — we return a partial struct here;
	// the handler fills in LoanID and LoanName.
	return amortizationResponse{
		EMI:           math.Round(emi*100) / 100,
		TotalPayment:  math.Round(totalPayment*100) / 100,
		TotalInterest: math.Round(totalInterest*100) / 100,
		Schedule:      schedule,
	}, nil
}

// numericToFloatValue extracts a float64 from pgtype.Numeric, returning 0 on
// invalid/missing values. (Distinct from the *float64 variant used elsewhere.)
func numericToFloatValue(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

// GET /api/v1/loans/{id}/amortization
func (h *LoanHandler) GetAmortization(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	loanID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	loan, err := h.q.GetLoanByID(r.Context(), loanID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if loan.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	outstandingBalance := numericToFloatValue(loan.OutstandingBalance)
	interestRate := numericToFloatValue(loan.InterestRate)
	termMonths := int(loan.TenureMonths)

	if outstandingBalance == 0 || termMonths == 0 {
		utils.Error(w, http.StatusUnprocessableEntity, "insufficient loan data for amortization")
		return
	}

	// Determine the start date; fall back to today if unset.
	startDate := time.Now()
	if loan.StartDate.Valid {
		startDate = loan.StartDate.Time
	}

	result, err := computeAmortization(outstandingBalance, interestRate, termMonths, startDate)
	if err != nil {
		utils.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	result.LoanID = uuidToString(loan.ID)
	result.LoanName = loan.Name

	utils.OK(w, result)
}

// POST /api/v1/loans/{id}/payments
func (h *LoanHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	loanID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	// Verify ownership
	loan, err := h.q.GetLoanByID(r.Context(), loanID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if loan.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req createLoanPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Date == "" || req.Status == "" {
		utils.BadRequest(w, "date and status are required")
		return
	}

	var paymentStatus db.PaymentStatus
	switch req.Status {
	case "scheduled":
		paymentStatus = db.PaymentStatusScheduled
	case "paid":
		paymentStatus = db.PaymentStatusPaid
	case "missed":
		paymentStatus = db.PaymentStatusMissed
	case "partial":
		paymentStatus = db.PaymentStatusPartial
	default:
		utils.BadRequest(w, "invalid status. Must be one of: scheduled, paid, missed, partial")
		return
	}

	var amount, principalComponent, interestComponent pgtype.Numeric
	if req.Amount != nil {
		amount.Scan(strconv.FormatFloat(*req.Amount, 'f', -1, 64))
	}
	if req.PrincipalComponent != nil {
		principalComponent.Scan(strconv.FormatFloat(*req.PrincipalComponent, 'f', -1, 64))
	}
	if req.InterestComponent != nil {
		interestComponent.Scan(strconv.FormatFloat(*req.InterestComponent, 'f', -1, 64))
	}

	var paymentDate pgtype.Date
	paymentDate.Scan(fmt.Sprint(req.Date))
	paymentDate.Valid = true

	payment, err := h.q.CreateLoanPayment(r.Context(), db.CreateLoanPaymentParams{
		LoanID:             loanID,
		Date:               paymentDate,
		Amount:             amount,
		PrincipalComponent: principalComponent,
		InterestComponent:  interestComponent,
		Status:             paymentStatus,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, payment)
}
