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

type InsuranceHandler struct {
	q *db.Queries
}

func NewInsuranceHandler(q *db.Queries) *InsuranceHandler {
	return &InsuranceHandler{q: q}
}

type createInsurancePolicyRequest struct {
	Name             string   `json:"name"`
	Provider         *string  `json:"provider"`
	PolicyType       string   `json:"policy_type"`
	PremiumAmount    *float64 `json:"premium_amount"`
	PremiumFrequency string   `json:"premium_frequency"`
	CoverageAmount   *float64 `json:"coverage_amount"`
	Currency         string   `json:"currency"`
	StartDate        string   `json:"start_date"`
	EndDate          string   `json:"end_date"`
	RenewalDate      *string  `json:"renewal_date"`
	Nominee          *string  `json:"nominee"`
	Notes            *string  `json:"notes"`
}

type updateInsurancePolicyRequest struct {
	Name             string   `json:"name"`
	Provider         *string  `json:"provider"`
	PolicyType       string   `json:"policy_type"`
	PremiumAmount    *float64 `json:"premium_amount"`
	PremiumFrequency string   `json:"premium_frequency"`
	CoverageAmount   *float64 `json:"coverage_amount"`
	Currency         string   `json:"currency"`
	StartDate        string   `json:"start_date"`
	EndDate          string   `json:"end_date"`
	RenewalDate      *string  `json:"renewal_date"`
	Nominee          *string  `json:"nominee"`
	Notes            *string  `json:"notes"`
}

type createInsurancePaymentRequest struct {
	Date   string   `json:"date"`
	Amount *float64 `json:"amount"`
	Status string   `json:"status"`
}

// GET /api/v1/insurance-policies
func (h *InsuranceHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	policies, err := h.q.ListInsurancePoliciesByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if policies == nil {
		policies = []db.InsurancePolicy{}
	}

	utils.OK(w, policies)
}

// POST /api/v1/insurance-policies
func (h *InsuranceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createInsurancePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.PolicyType == "" || req.Currency == "" || req.PremiumFrequency == "" {
		utils.BadRequest(w, "name, policy_type, currency, and premium_frequency are required")
		return
	}

	var policyType db.PolicyType
	switch req.PolicyType {
	case "life":
		policyType = db.PolicyTypeLife
	case "health":
		policyType = db.PolicyTypeHealth
	case "vehicle":
		policyType = db.PolicyTypeVehicle
	case "property":
		policyType = db.PolicyTypeProperty
	case "term":
		policyType = db.PolicyTypeTerm
	case "other":
		policyType = db.PolicyTypeOther
	default:
		utils.BadRequest(w, "invalid policy_type. Must be one of: life, health, vehicle, property, term, other")
		return
	}

	var premiumFrequency db.PremiumFrequency
	switch req.PremiumFrequency {
	case "monthly":
		premiumFrequency = db.PremiumFrequencyMonthly
	case "quarterly":
		premiumFrequency = db.PremiumFrequencyQuarterly
	case "annual":
		premiumFrequency = db.PremiumFrequencyAnnual
	default:
		utils.BadRequest(w, "invalid premium_frequency. Must be one of: monthly, quarterly, annual")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	var provider pgtype.Text
	if req.Provider != nil && *req.Provider != "" {
		provider = pgtype.Text{String: *req.Provider, Valid: true}
	}

	var premiumAmount, coverageAmount pgtype.Numeric
	if req.PremiumAmount != nil {
		premiumAmount.Scan(*req.PremiumAmount)
	}
	if req.CoverageAmount != nil {
		coverageAmount.Scan(*req.CoverageAmount)
	}

	var startDate, endDate pgtype.Date
	if req.StartDate != "" {
		startDate.Scan(req.StartDate)
		startDate.Valid = true
	}
	if req.EndDate != "" {
		endDate.Scan(req.EndDate)
		endDate.Valid = true
	}

	var renewalDate pgtype.Date
	if req.RenewalDate != nil && *req.RenewalDate != "" {
		renewalDate.Scan(*req.RenewalDate)
		renewalDate.Valid = true
	}

	var nominee pgtype.Text
	if req.Nominee != nil && *req.Nominee != "" {
		nominee = pgtype.Text{String: *req.Nominee, Valid: true}
	}

	var notes pgtype.Text
	if req.Notes != nil && *req.Notes != "" {
		notes = pgtype.Text{String: *req.Notes, Valid: true}
	}

	policy, err := h.q.CreateInsurancePolicy(r.Context(), db.CreateInsurancePolicyParams{
		UserID:           userUUID,
		Name:             req.Name,
		Provider:         provider,
		PolicyType:       policyType,
		PremiumAmount:    premiumAmount,
		PremiumFrequency: premiumFrequency,
		CoverageAmount:   coverageAmount,
		Currency:         req.Currency,
		StartDate:        startDate,
		EndDate:          endDate,
		RenewalDate:      renewalDate,
		Nominee:          nominee,
		Notes:            notes,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, policy)
}

// GET /api/v1/insurance-policies/{id}
func (h *InsuranceHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	policyID := stringToUUID(chi.URLParam(r, "id"))
	policy, err := h.q.GetInsurancePolicyByID(r.Context(), policyID)
	if err != nil {
		utils.NotFound(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	if policy.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	utils.OK(w, policy)
}

// PUT /api/v1/insurance-policies/{id}
func (h *InsuranceHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	policyID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	// Verify ownership
	existing, err := h.q.GetInsurancePolicyByID(r.Context(), policyID)
	if err != nil || existing.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req updateInsurancePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.PolicyType == "" || req.Currency == "" || req.PremiumFrequency == "" {
		utils.BadRequest(w, "name, policy_type, currency, and premium_frequency are required")
		return
	}

	var policyType db.PolicyType
	switch req.PolicyType {
	case "life":
		policyType = db.PolicyTypeLife
	case "health":
		policyType = db.PolicyTypeHealth
	case "vehicle":
		policyType = db.PolicyTypeVehicle
	case "property":
		policyType = db.PolicyTypeProperty
	case "term":
		policyType = db.PolicyTypeTerm
	case "other":
		policyType = db.PolicyTypeOther
	default:
		utils.BadRequest(w, "invalid policy_type. Must be one of: life, health, vehicle, property, term, other")
		return
	}

	var premiumFrequency db.PremiumFrequency
	switch req.PremiumFrequency {
	case "monthly":
		premiumFrequency = db.PremiumFrequencyMonthly
	case "quarterly":
		premiumFrequency = db.PremiumFrequencyQuarterly
	case "annual":
		premiumFrequency = db.PremiumFrequencyAnnual
	default:
		utils.BadRequest(w, "invalid premium_frequency. Must be one of: monthly, quarterly, annual")
		return
	}

	var provider pgtype.Text
	if req.Provider != nil && *req.Provider != "" {
		provider = pgtype.Text{String: *req.Provider, Valid: true}
	}

	var premiumAmount, coverageAmount pgtype.Numeric
	if req.PremiumAmount != nil {
		premiumAmount.Scan(*req.PremiumAmount)
	}
	if req.CoverageAmount != nil {
		coverageAmount.Scan(*req.CoverageAmount)
	}

	var startDate, endDate pgtype.Date
	if req.StartDate != "" {
		startDate.Scan(req.StartDate)
		startDate.Valid = true
	}
	if req.EndDate != "" {
		endDate.Scan(req.EndDate)
		endDate.Valid = true
	}

	var renewalDate pgtype.Date
	if req.RenewalDate != nil && *req.RenewalDate != "" {
		renewalDate.Scan(*req.RenewalDate)
		renewalDate.Valid = true
	}

	var nominee pgtype.Text
	if req.Nominee != nil && *req.Nominee != "" {
		nominee = pgtype.Text{String: *req.Nominee, Valid: true}
	}

	var notes pgtype.Text
	if req.Notes != nil && *req.Notes != "" {
		notes = pgtype.Text{String: *req.Notes, Valid: true}
	}

	policy, err := h.q.UpdateInsurancePolicy(r.Context(), db.UpdateInsurancePolicyParams{
		ID:               policyID,
		UserID:           userUUID,
		Name:             req.Name,
		Provider:         provider,
		PolicyType:       policyType,
		PremiumAmount:    premiumAmount,
		PremiumFrequency: premiumFrequency,
		CoverageAmount:   coverageAmount,
		Currency:         req.Currency,
		StartDate:        startDate,
		EndDate:          endDate,
		RenewalDate:      renewalDate,
		Nominee:          nominee,
		Notes:            notes,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, policy)
}

// DELETE /api/v1/insurance-policies/{id}
func (h *InsuranceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	policyID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteInsurancePolicy(r.Context(), db.DeleteInsurancePolicyParams{
		ID:     policyID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "insurance policy deleted"})
}

// GET /api/v1/insurance-policies/{id}/payments
func (h *InsuranceHandler) ListPayments(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	policyID := stringToUUID(chi.URLParam(r, "id"))

	// Verify ownership
	policy, err := h.q.GetInsurancePolicyByID(r.Context(), policyID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if policy.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	payments, err := h.q.ListInsurancePayments(r.Context(), policyID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if payments == nil {
		payments = []db.InsurancePayment{}
	}

	utils.OK(w, payments)
}

// POST /api/v1/insurance-policies/{id}/payments
func (h *InsuranceHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	policyID := stringToUUID(chi.URLParam(r, "id"))

	// Verify ownership
	policy, err := h.q.GetInsurancePolicyByID(r.Context(), policyID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if policy.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req createInsurancePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Date == "" || req.Status == "" {
		utils.BadRequest(w, "date and status are required")
		return
	}

	var paymentStatus db.InsurancePaymentStatus
	paymentStatus, err = ParseInsurancePaymentStatus(req.Status)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	var amount pgtype.Numeric
	if req.Amount != nil {
		amount.Scan(*req.Amount)
	}

	var paymentDate pgtype.Date
	paymentDate.Scan(req.Date)
	paymentDate.Valid = true

	payment, err := h.q.CreateInsurancePayment(r.Context(), db.CreateInsurancePaymentParams{
		PolicyID: policyID,
		Date:     paymentDate,
		Amount:   amount,
		Status:   paymentStatus,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, payment)
}
