package handlers

import (
	"strconv"
	"encoding/json"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgtype"
)

type ExchangeRateHandler struct {
	q *db.Queries
}

func NewExchangeRateHandler(q *db.Queries) *ExchangeRateHandler {
	return &ExchangeRateHandler{q: q}
}

type upsertExchangeRateRequest struct {
	Base   string   `json:"base"`
	Target string   `json:"target"`
	Rate   *float64 `json:"rate"`
}

// GET /api/v1/exchange-rates
func (h *ExchangeRateHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	rates, err := h.q.ListExchangeRates(r.Context())
	if err != nil {
		utils.InternalError(w)
		return
	}
	if rates == nil {
		rates = []db.ExchangeRate{}
	}

	utils.OK(w, rates)
}

// POST /api/v1/exchange-rates
func (h *ExchangeRateHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req upsertExchangeRateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Base == "" || req.Target == "" || req.Rate == nil {
		utils.BadRequest(w, "base, target, and rate are required")
		return
	}

	var rate pgtype.Numeric
	if err := rate.Scan(strconv.FormatFloat(*req.Rate, 'f', -1, 64)); err != nil {
		utils.BadRequest(w, "invalid rate")
		return
	}

	err := h.q.UpsertExchangeRate(r.Context(), db.UpsertExchangeRateParams{
		Base:      req.Base,
		Target:    req.Target,
		Rate:      rate,
		FetchedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, map[string]string{"message": "exchange rate upserted"})
}
