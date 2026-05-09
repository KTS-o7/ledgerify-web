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

type CategoryHandler struct {
	q *db.Queries
}

func NewCategoryHandler(q *db.Queries) *CategoryHandler {
	return &CategoryHandler{q: q}
}

type createCategoryRequest struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

type updateCategoryRequest struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

// GET /api/v1/categories
func (h *CategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	categories, err := h.q.ListCategoriesByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if categories == nil {
		categories = []db.Category{}
	}

	utils.OK(w, categories)
}

// GET /api/v1/categories/{id}
func (h *CategoryHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	categoryID := stringToUUID(chi.URLParam(r, "id"))
	category, err := h.q.GetCategoryByID(r.Context(), categoryID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	if category.UserID.Valid && category.UserID.Bytes != stringToUUID(claims.UserID).Bytes {
		utils.NotFound(w)
		return
	}

	utils.OK(w, category)
}

// POST /api/v1/categories
func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Type == "" {
		utils.BadRequest(w, "name and type are required")
		return
	}

	var catType db.CategoryType
	switch req.Type {
	case "income":
		catType = db.CategoryTypeIncome
	case "expense":
		catType = db.CategoryTypeExpense
	default:
		utils.BadRequest(w, "invalid category type. Must be 'income' or 'expense'")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	category, err := h.q.CreateCategory(r.Context(), db.CreateCategoryParams{
		UserID: userUUID,
		Name:   req.Name,
		Type:   catType,
		Icon:   pgtype.Text{String: req.Icon, Valid: req.Icon != ""},
		Color:  pgtype.Text{String: req.Color, Valid: req.Color != ""},
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, category)
}

// PUT /api/v1/categories/{id}
func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	categoryID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	var req updateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Type == "" {
		utils.BadRequest(w, "name and type are required")
		return
	}

	var catType db.CategoryType
	switch req.Type {
	case "income":
		catType = db.CategoryTypeIncome
	case "expense":
		catType = db.CategoryTypeExpense
	default:
		utils.BadRequest(w, "invalid category type. Must be 'income' or 'expense'")
		return
	}

	category, err := h.q.UpdateCategory(r.Context(), db.UpdateCategoryParams{
		ID:     categoryID,
		Name:   req.Name,
		Type:   catType,
		Icon:   pgtype.Text{String: req.Icon, Valid: req.Icon != ""},
		Color:  pgtype.Text{String: req.Color, Valid: req.Color != ""},
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, category)
}

// DELETE /api/v1/categories/{id}
func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	categoryID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteCategory(r.Context(), db.DeleteCategoryParams{
		ID:     categoryID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "category deleted"})
}
