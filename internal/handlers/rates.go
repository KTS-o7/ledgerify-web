package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ExchangeRateHandler struct {
	q    *db.Queries
	pool *pgxpool.Pool
}

func NewExchangeRateHandler(q *db.Queries) *ExchangeRateHandler {
	return &ExchangeRateHandler{q: q}
}

// NewExchangeRateHandlerWithPool is used when a pool is available for admin checks.
func NewExchangeRateHandlerWithPool(q *db.Queries, pool *pgxpool.Pool) *ExchangeRateHandler {
	return &ExchangeRateHandler{q: q, pool: pool}
}

type upsertExchangeRateRequest struct {
	Base   string   `json:"base"`
	Target string   `json:"target"`
	Rate   *float64 `json:"rate"`
}

// isAdmin checks whether the given user ID has is_admin = true.
// Returns false on any error (fail-closed).
func (h *ExchangeRateHandler) isAdmin(r *http.Request, userID string) bool {
	if h.pool == nil {
		return false
	}
	var admin bool
	err := h.pool.QueryRow(r.Context(),
		`SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	).Scan(&admin)
	if err != nil {
		return false
	}
	return admin
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

// POST /api/v1/exchange-rates — admin only
func (h *ExchangeRateHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	if !h.isAdmin(r, claims.UserID) {
		http.Error(w, `{"error":"forbidden: admin access required"}`, http.StatusForbidden)
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
