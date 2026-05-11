package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BudgetHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewBudgetHandler(pool *pgxpool.Pool, q *db.Queries) *BudgetHandler {
	return &BudgetHandler{pool: pool, q: q}
}

type createBudgetRequest struct {
	Name             string  `json:"name"`
	CategoryID       string  `json:"category_id,omitempty"`
	Amount           float64 `json:"amount"`
	Currency         string  `json:"currency"`
	PeriodType       string  `json:"period_type"`
	StartDate        string  `json:"start_date,omitempty"`
	EndDate          string  `json:"end_date,omitempty"`
	PeriodAnchorDate string  `json:"period_anchor_date,omitempty"`
	Rollover         *bool   `json:"rollover,omitempty"`
}

type updateBudgetRequest struct {
	Name             string  `json:"name"`
	CategoryID       string  `json:"category_id"`
	Amount           float64 `json:"amount"`
	Currency         string  `json:"currency"`
	PeriodType       string  `json:"period_type"`
	StartDate        string  `json:"start_date"`
	EndDate          string  `json:"end_date"`
	PeriodAnchorDate string  `json:"period_anchor_date"`
	Rollover         *bool   `json:"rollover"`
}

type budgetWithSpent struct {
	ID               pgtype.UUID        `json:"id"`
	UserID           pgtype.UUID        `json:"user_id"`
	CategoryID       pgtype.UUID        `json:"category_id"`
	Name             string             `json:"name"`
	Amount           pgtype.Numeric     `json:"amount"`
	Currency         string             `json:"currency"`
	PeriodType       db.PeriodType      `json:"period_type"`
	StartDate        pgtype.Date        `json:"start_date"`
	EndDate          pgtype.Date        `json:"end_date"`
	PeriodAnchorDate pgtype.Date        `json:"period_anchor_date"`
	Rollover         bool               `json:"rollover"`
	CreatedAt        pgtype.Timestamptz `json:"created_at"`
	UpdatedAt        pgtype.Timestamptz `json:"updated_at"`
	DeletedAt        pgtype.Timestamptz `json:"deleted_at"`
	CategoryName     pgtype.Text        `json:"category_name"`
	CategoryColor    pgtype.Text        `json:"category_color"`
	Spent            float64            `json:"spent"`
	Remaining        float64            `json:"remaining"`
	SpentPct         float64            `json:"spent_pct"`
}

// GET /api/v1/budgets
func (h *BudgetHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userID := stringToUUID(claims.UserID)
	budgets, err := h.q.ListBudgetsByUser(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if budgets == nil {
		budgets = []db.ListBudgetsByUserRow{}
	}

	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)

	results := make([]budgetWithSpent, 0, len(budgets))
	for _, b := range budgets {
		amt, _ := b.Amount.Float64Value()
		amount := 0.0
		if amt.Valid {
			amount = amt.Float64
		}

		var spent float64
		if b.CategoryID.Valid {
			err := h.pool.QueryRow(r.Context(),
				`SELECT COALESCE(SUM(t.amount), 0)::numeric(18,4)
				FROM transactions t
				JOIN categories c ON c.id = t.category_id
				WHERE t.user_id = $1 AND t.type = 'expense'
				  AND t.category_id = $2
				  AND t.date >= $3 AND t.date <= $4
				  AND t.deleted_at IS NULL`,
				userID, b.CategoryID, monthStart, monthEnd,
			).Scan(&spent)
			if err != nil {
				spent = 0
			}
		}

		remaining := amount - spent
		spentPct := 0.0
		if amount > 0 {
			spentPct = (spent / amount) * 100
		}

		results = append(results, budgetWithSpent{
			ID:               b.ID,
			UserID:           b.UserID,
			CategoryID:       b.CategoryID,
			Name:             b.Name,
			Amount:           b.Amount,
			Currency:         b.Currency,
			PeriodType:       b.PeriodType,
			StartDate:        b.StartDate,
			EndDate:          b.EndDate,
			PeriodAnchorDate: b.PeriodAnchorDate,
			Rollover:         b.Rollover,
			CreatedAt:        b.CreatedAt,
			UpdatedAt:        b.UpdatedAt,
			DeletedAt:        b.DeletedAt,
			CategoryName:     b.CategoryName,
			CategoryColor:    b.CategoryColor,
			Spent:            spent,
			Remaining:        remaining,
			SpentPct:         spentPct,
		})
	}

	utils.OK(w, results)
}

// GET /api/v1/budgets/{id}
func (h *BudgetHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	budgetID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	budget, err := h.q.GetBudgetByID(r.Context(), budgetID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	if budget.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	utils.OK(w, budget)
}

// POST /api/v1/budgets
func (h *BudgetHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}

	if req.Name == "" || req.Amount <= 0 || req.Currency == "" || req.PeriodType == "" {
		utils.BadRequest(w, "name, amount, currency, and period_type are required")
		return
	}

	catUUID := pgtype.UUID{Valid: false}
	if req.CategoryID != "" {
		catUUID = stringToUUID(req.CategoryID)
	}

	var amount pgtype.Numeric
	if err := amount.Scan(req.Amount); err != nil {
		utils.BadRequest(w, "invalid amount")
		return
	}

	var startDate, endDate, anchorDate pgtype.Date
	if req.StartDate != "" {
		if err := startDate.Scan(req.StartDate); err != nil {
			utils.BadRequest(w, "invalid start date")
			return
		}
		startDate.Valid = true
	}
	if req.EndDate != "" {
		if err := endDate.Scan(req.EndDate); err != nil {
			utils.BadRequest(w, "invalid end date")
			return
		}
		endDate.Valid = true
	}
	if req.PeriodAnchorDate != "" {
		if err := anchorDate.Scan(req.PeriodAnchorDate); err != nil {
			utils.BadRequest(w, "invalid period anchor date")
			return
		}
		anchorDate.Valid = true
	}

	rollover := false
	if req.Rollover != nil {
		rollover = *req.Rollover
	}

	budget, err := h.q.CreateBudget(r.Context(), db.CreateBudgetParams{
		UserID:           stringToUUID(claims.UserID),
		Name:             req.Name,
		CategoryID:       catUUID,
		Amount:           amount,
		Currency:         req.Currency,
		PeriodType:       db.PeriodType(req.PeriodType),
		StartDate:        startDate,
		EndDate:          endDate,
		PeriodAnchorDate: anchorDate,
		Rollover:         rollover,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, budget)
}

// PUT /api/v1/budgets/{id}
func (h *BudgetHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	budgetID := stringToUUID(chi.URLParam(r, "id"))
	userID := stringToUUID(claims.UserID)

	var req updateBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Amount <= 0 || req.Currency == "" || req.PeriodType == "" {
		utils.BadRequest(w, "name, amount, currency, and period_type are required")
		return
	}

	var catUUID pgtype.UUID
	if req.CategoryID != "" {
		catUUID = stringToUUID(req.CategoryID)
	}

	var amount pgtype.Numeric
	if err := amount.Scan(req.Amount); err != nil {
		utils.BadRequest(w, "invalid amount")
		return
	}

	var startDate pgtype.Date
	if req.StartDate != "" {
		if err := startDate.Scan(req.StartDate); err != nil {
			utils.BadRequest(w, "invalid start date")
			return
		}
	}

	var endDate pgtype.Date
	if req.EndDate != "" {
		if err := endDate.Scan(req.EndDate); err != nil {
			utils.BadRequest(w, "invalid end date")
			return
		}
	}

	var anchorDate pgtype.Date
	if req.PeriodAnchorDate != "" {
		if err := anchorDate.Scan(req.PeriodAnchorDate); err != nil {
			utils.BadRequest(w, "invalid period anchor date")
			return
		}
	}

	rollover := false
	if req.Rollover != nil {
		rollover = *req.Rollover
	}

	budget, err := h.q.UpdateBudget(r.Context(), db.UpdateBudgetParams{
		ID:               budgetID,
		UserID:           userID,
		Name:             req.Name,
		CategoryID:       catUUID,
		Amount:           amount,
		Currency:         req.Currency,
		PeriodType:       db.PeriodType(req.PeriodType),
		StartDate:        startDate,
		EndDate:          endDate,
		PeriodAnchorDate: anchorDate,
		Rollover:         rollover,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, budget)
}

// DELETE /api/v1/budgets/{id}
func (h *BudgetHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		utils.BadRequest(w, "missing id")
		return
	}

	budgetID := stringToUUID(id)
	userID := stringToUUID(claims.UserID)

	existing, err := h.q.GetBudgetByID(r.Context(), budgetID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	if existing.UserID.Bytes != userID.Bytes {
		utils.NotFound(w)
		return
	}

	err = h.q.DeleteBudget(r.Context(), db.DeleteBudgetParams{
		ID:     budgetID,
		UserID: userID,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, map[string]string{"message": "deleted"})
}
