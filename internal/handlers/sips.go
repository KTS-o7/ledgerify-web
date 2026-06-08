package handlers

import (
	"context"
	"encoding/json"
	"fmt"
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

type SipHandler struct {
	q      *db.Queries
	recalc *recalc.Service
}

func NewSipHandler(q *db.Queries, recalc *recalc.Service) *SipHandler {
	return &SipHandler{q: q, recalc: recalc}
}

type createSipRequest struct {
	Name               string   `json:"name"`
	SipType            string   `json:"sip_type"`
	Currency           string   `json:"currency"`
	MonthlyAmount      *float64 `json:"monthly_amount"`
	StartDate          string   `json:"start_date"`
	ExpectedReturnRate *float64 `json:"expected_return_rate"`
	CurrentNav         *float64 `json:"current_nav"`
	UnitsAccumulated   *float64 `json:"units_accumulated"`
	Metadata           *string  `json:"metadata"`
}

type updateSipRequest struct {
	Name               string   `json:"name"`
	SipType            string   `json:"sip_type"`
	Currency           string   `json:"currency"`
	MonthlyAmount      *float64 `json:"monthly_amount"`
	StartDate          string   `json:"start_date"`
	ExpectedReturnRate *float64 `json:"expected_return_rate"`
	CurrentNav         *float64 `json:"current_nav"`
	UnitsAccumulated   *float64 `json:"units_accumulated"`
	Metadata           *string  `json:"metadata"`
}

func parseSipType(s string) (db.SipType, error) {
	switch s {
	case "equity":
		return db.SipTypeEquity, nil
	case "debt":
		return db.SipTypeDebt, nil
	case "hybrid":
		return db.SipTypeHybrid, nil
	case "other":
		return db.SipTypeOther, nil
	default:
		return "", fmt.Errorf("invalid sip_type")
	}
}

// fireRecalc runs the per-user recalculation in the background. The request
// response is returned immediately; the recalculation is best-effort.
func (h *SipHandler) fireRecalc(userID string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = h.recalc.RecalculateUser(ctx, userID)
	}()
}

// GET /api/v1/sips
func (h *SipHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	userUUID := stringToUUID(claims.UserID)
	sips, err := h.q.ListSipsByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if sips == nil {
		sips = []db.Sip{}
	}

	utils.OK(w, sips)
}

// POST /api/v1/sips
func (h *SipHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	var req createSipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.SipType == "" || req.Currency == "" || req.MonthlyAmount == nil || req.StartDate == "" {
		utils.BadRequest(w, "name, sip_type, currency, monthly_amount, and start_date are required")
		return
	}

	sipType, err := parseSipType(req.SipType)
	if err != nil {
		utils.BadRequest(w, "invalid sip_type. Must be one of: equity, debt, hybrid, other")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	var monthly, expectedReturn, currentNav, units pgtype.Numeric
	monthly.Scan(strconv.FormatFloat(*req.MonthlyAmount, 'f', -1, 64))
	if req.ExpectedReturnRate != nil {
		expectedReturn.Scan(strconv.FormatFloat(*req.ExpectedReturnRate, 'f', -1, 64))
	}
	if req.CurrentNav != nil {
		currentNav.Scan(strconv.FormatFloat(*req.CurrentNav, 'f', -1, 64))
	}
	if req.UnitsAccumulated != nil {
		units.Scan(strconv.FormatFloat(*req.UnitsAccumulated, 'f', -1, 64))
	}

	var startDate pgtype.Date
	startDate.Scan(fmt.Sprint(req.StartDate))
	startDate.Valid = true

	var metadata []byte
	if req.Metadata != nil {
		metadata = []byte(*req.Metadata)
	}

	sip, err := h.q.CreateSip(r.Context(), db.CreateSipParams{
		UserID:             userUUID,
		Name:               req.Name,
		SipType:            sipType,
		Currency:           req.Currency,
		MonthlyAmount:      monthly,
		StartDate:          startDate,
		ExpectedReturnRate: expectedReturn,
		CurrentNav:         currentNav,
		UnitsAccumulated:   units,
		Metadata:           metadata,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	h.fireRecalc(claims.UserID)
	utils.Created(w, sip)
}

// GET /api/v1/sips/{id}
func (h *SipHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	sipID := stringToUUID(chi.URLParam(r, "id"))
	sip, err := h.q.GetSipByID(r.Context(), sipID)
	if err != nil {
		utils.NotFound(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	if sip.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	utils.OK(w, sip)
}

// PUT /api/v1/sips/{id}
func (h *SipHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	sipID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	existing, err := h.q.GetSipByID(r.Context(), sipID)
	if err != nil || existing.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req updateSipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.SipType == "" || req.Currency == "" || req.MonthlyAmount == nil || req.StartDate == "" {
		utils.BadRequest(w, "name, sip_type, currency, monthly_amount, and start_date are required")
		return
	}

	sipType, err := parseSipType(req.SipType)
	if err != nil {
		utils.BadRequest(w, "invalid sip_type. Must be one of: equity, debt, hybrid, other")
		return
	}

	var monthly, expectedReturn, currentNav, units pgtype.Numeric
	monthly.Scan(strconv.FormatFloat(*req.MonthlyAmount, 'f', -1, 64))
	if req.ExpectedReturnRate != nil {
		expectedReturn.Scan(strconv.FormatFloat(*req.ExpectedReturnRate, 'f', -1, 64))
	}
	if req.CurrentNav != nil {
		currentNav.Scan(strconv.FormatFloat(*req.CurrentNav, 'f', -1, 64))
	}
	if req.UnitsAccumulated != nil {
		units.Scan(strconv.FormatFloat(*req.UnitsAccumulated, 'f', -1, 64))
	}

	var startDate pgtype.Date
	startDate.Scan(fmt.Sprint(req.StartDate))
	startDate.Valid = true

	var metadata []byte
	if req.Metadata != nil {
		metadata = []byte(*req.Metadata)
	}

	sip, err := h.q.UpdateSip(r.Context(), db.UpdateSipParams{
		ID:                 sipID,
		Name:               req.Name,
		SipType:            sipType,
		Currency:           req.Currency,
		MonthlyAmount:      monthly,
		StartDate:          startDate,
		ExpectedReturnRate: expectedReturn,
		CurrentNav:         currentNav,
		UnitsAccumulated:   units,
		Metadata:           metadata,
		UserID:             userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	h.fireRecalc(claims.UserID)
	utils.OK(w, sip)
}

// DELETE /api/v1/sips/{id}
func (h *SipHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	sipID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteSip(r.Context(), db.DeleteSipParams{
		ID:     sipID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "sip deleted"})
}
