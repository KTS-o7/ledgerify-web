package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type LoanHandler struct {
	q *db.Queries
}

func NewLoanHandler(q *db.Queries) *LoanHandler {
	return &LoanHandler{q: q}
}

type createLoanRequest struct {
	Name               string   `json:"name"`
	LoanType           string   `json:"loan_type"`
	Principal          *float64 `json:"principal"`
	InterestRate       *float64 `json:"interest_rate"`
	TenureMonths       int32    `json:"tenure_months"`
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
	TenureMonths       int32    `json:"tenure_months"`
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

// GET /api/v1/loans
func (h *LoanHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
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
		utils.BadRequest(w, "unauthorized")
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

	var loanType db.LoanType
	loanType, err := ParseLoanType(req.LoanType)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	userUUID := stringToUUID(claims.UserID)

	var principal, interestRate, emiAmount, outstandingBalance pgtype.Numeric
	if req.Principal != nil {
		if err := principal.Scan(*req.Principal); err != nil {
			utils.BadRequest(w, "invalid principal")
			return
		}
	}
	if req.InterestRate != nil {
		if err := interestRate.Scan(*req.InterestRate); err != nil {
			utils.BadRequest(w, "invalid interest rate")
			return
		}
	}
	if req.EmiAmount != nil {
		if err := emiAmount.Scan(*req.EmiAmount); err != nil {
			utils.BadRequest(w, "invalid EMI amount")
			return
		}
	}
	if req.OutstandingBalance != nil {
		if err := outstandingBalance.Scan(*req.OutstandingBalance); err != nil {
			utils.BadRequest(w, "invalid outstanding balance")
			return
		}
	}

	var startDate pgtype.Date
	if req.StartDate != "" {
		if err := startDate.Scan(req.StartDate); err != nil {
			utils.BadRequest(w, "invalid start date")
			return
		}
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

	utils.Created(w, loan)
}

// GET /api/v1/loans/{id}
func (h *LoanHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	loanID := stringToUUID(chi.URLParam(r, "id"))
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
		utils.BadRequest(w, "unauthorized")
		return
	}

	loanID := stringToUUID(chi.URLParam(r, "id"))
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

	var loanType db.LoanType
	loanType, err = ParseLoanType(req.LoanType)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	var principal, interestRate, emiAmount, outstandingBalance pgtype.Numeric
	if req.Principal != nil {
		if err := principal.Scan(*req.Principal); err != nil {
			utils.BadRequest(w, "invalid principal")
			return
		}
	}
	if req.InterestRate != nil {
		if err := interestRate.Scan(*req.InterestRate); err != nil {
			utils.BadRequest(w, "invalid interest rate")
			return
		}
	}
	if req.EmiAmount != nil {
		if err := emiAmount.Scan(*req.EmiAmount); err != nil {
			utils.BadRequest(w, "invalid EMI amount")
			return
		}
	}
	if req.OutstandingBalance != nil {
		if err := outstandingBalance.Scan(*req.OutstandingBalance); err != nil {
			utils.BadRequest(w, "invalid outstanding balance")
			return
		}
	}

	var startDate pgtype.Date
	if req.StartDate != "" {
		if err := startDate.Scan(req.StartDate); err != nil {
			utils.BadRequest(w, "invalid start date")
			return
		}
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

	utils.OK(w, loan)
}

// DELETE /api/v1/loans/{id}
func (h *LoanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	loanID := stringToUUID(chi.URLParam(r, "id"))
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
		utils.BadRequest(w, "unauthorized")
		return
	}

	loanID := stringToUUID(chi.URLParam(r, "id"))

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

// POST /api/v1/loans/{id}/payments
func (h *LoanHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	loanID := stringToUUID(chi.URLParam(r, "id"))

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
	paymentStatus, err = ParsePaymentStatus(req.Status)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	var amount, principalComponent, interestComponent pgtype.Numeric
	if req.Amount != nil {
		if err := amount.Scan(*req.Amount); err != nil {
			utils.BadRequest(w, "invalid amount")
			return
		}
	}
	if req.PrincipalComponent != nil {
		if err := principalComponent.Scan(*req.PrincipalComponent); err != nil {
			utils.BadRequest(w, "invalid principal component")
			return
		}
	}
	if req.InterestComponent != nil {
		if err := interestComponent.Scan(*req.InterestComponent); err != nil {
			utils.BadRequest(w, "invalid interest component")
			return
		}
	}

	var paymentDate pgtype.Date
	if err := paymentDate.Scan(req.Date); err != nil {
		utils.BadRequest(w, "invalid payment date")
		return
	}
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
