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

type SavingsGoalHandler struct {
	q *db.Queries
}

func NewSavingsGoalHandler(q *db.Queries) *SavingsGoalHandler {
	return &SavingsGoalHandler{q: q}
}

type createSavingsGoalRequest struct {
	Name            string   `json:"name"`
	Description     *string  `json:"description"`
	TargetAmount    *float64 `json:"target_amount"`
	Currency        string   `json:"currency"`
	CurrentAmount   *float64 `json:"current_amount"`
	LinkedAccountID *string  `json:"linked_account_id"`
	Deadline        *string  `json:"deadline"`
	Status          string   `json:"status"`
}

type updateSavingsGoalRequest struct {
	Name            string   `json:"name"`
	Description     *string  `json:"description"`
	TargetAmount    *float64 `json:"target_amount"`
	Currency        string   `json:"currency"`
	CurrentAmount   *float64 `json:"current_amount"`
	LinkedAccountID *string  `json:"linked_account_id"`
	Deadline        *string  `json:"deadline"`
	Status          string   `json:"status"`
}

// GET /api/v1/savings
func (h *SavingsGoalHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	goals, err := h.q.ListSavingsGoalsByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if goals == nil {
		goals = []db.SavingsGoal{}
	}

	utils.OK(w, goals)
}

// POST /api/v1/savings
func (h *SavingsGoalHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createSavingsGoalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Currency == "" || req.Status == "" {
		utils.BadRequest(w, "name, currency, and status are required")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	var description pgtype.Text
	if req.Description != nil && *req.Description != "" {
		description = pgtype.Text{String: *req.Description, Valid: true}
	}

	var targetAmount, currentAmount pgtype.Numeric
	if req.TargetAmount != nil {
		if err := targetAmount.Scan(*req.TargetAmount); err != nil {
			utils.BadRequest(w, "invalid target amount")
			return
		}
	}
	if req.CurrentAmount != nil {
		if err := currentAmount.Scan(*req.CurrentAmount); err != nil {
			utils.BadRequest(w, "invalid current amount")
			return
		}
	}

	var linkedAccountID pgtype.UUID
	if req.LinkedAccountID != nil && *req.LinkedAccountID != "" {
		linkedAccountID = stringToUUID(*req.LinkedAccountID)
	}

	var deadline pgtype.Date
	if req.Deadline != nil && *req.Deadline != "" {
		if err := deadline.Scan(*req.Deadline); err != nil {
			utils.BadRequest(w, "invalid deadline")
			return
		}
		deadline.Valid = true
	}

	var goalStatus db.GoalStatus
	goalStatus, err := ParseGoalStatus(req.Status)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	goal, err := h.q.CreateSavingsGoal(r.Context(), db.CreateSavingsGoalParams{
		UserID:          userUUID,
		Name:            req.Name,
		Description:     description,
		TargetAmount:    targetAmount,
		Currency:        req.Currency,
		CurrentAmount:   currentAmount,
		LinkedAccountID: linkedAccountID,
		Deadline:        deadline,
		Status:          goalStatus,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, goal)
}

// GET /api/v1/savings/{id}
func (h *SavingsGoalHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	goalID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	goal, err := h.q.GetSavingsGoalByID(r.Context(), db.GetSavingsGoalByIDParams{
		ID:     goalID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, goal)
}

// PUT /api/v1/savings/{id}
func (h *SavingsGoalHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	goalID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	var req updateSavingsGoalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Currency == "" || req.Status == "" {
		utils.BadRequest(w, "name, currency, and status are required")
		return
	}

	var description pgtype.Text
	if req.Description != nil && *req.Description != "" {
		description = pgtype.Text{String: *req.Description, Valid: true}
	}

	var targetAmount, currentAmount pgtype.Numeric
	if req.TargetAmount != nil {
		if err := targetAmount.Scan(*req.TargetAmount); err != nil {
			utils.BadRequest(w, "invalid target amount")
			return
		}
	}
	if req.CurrentAmount != nil {
		if err := currentAmount.Scan(*req.CurrentAmount); err != nil {
			utils.BadRequest(w, "invalid current amount")
			return
		}
	}

	var linkedAccountID pgtype.UUID
	if req.LinkedAccountID != nil && *req.LinkedAccountID != "" {
		linkedAccountID = stringToUUID(*req.LinkedAccountID)
	}

	var deadline pgtype.Date
	if req.Deadline != nil && *req.Deadline != "" {
		if err := deadline.Scan(*req.Deadline); err != nil {
			utils.BadRequest(w, "invalid deadline")
			return
		}
		deadline.Valid = true
	}

	var goalStatus db.GoalStatus
	goalStatus, err := ParseGoalStatus(req.Status)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	goal, err := h.q.UpdateSavingsGoal(r.Context(), db.UpdateSavingsGoalParams{
		ID:              goalID,
		UserID:          userUUID,
		Name:            req.Name,
		Description:     description,
		TargetAmount:    targetAmount,
		Currency:        req.Currency,
		CurrentAmount:   currentAmount,
		LinkedAccountID: linkedAccountID,
		Deadline:        deadline,
		Status:          goalStatus,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, goal)
}

// DELETE /api/v1/savings/{id}
func (h *SavingsGoalHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	goalID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteSavingsGoal(r.Context(), db.DeleteSavingsGoalParams{
		ID:     goalID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "savings goal deleted"})
}
