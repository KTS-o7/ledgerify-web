package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type KeywordHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewKeywordHandler(pool *pgxpool.Pool, q *db.Queries) *KeywordHandler {
	return &KeywordHandler{pool: pool, q: q}
}

// GET /api/v1/keywords
func (h *KeywordHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	keywords, err := h.q.ListCategoryKeywordsByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if keywords == nil {
		keywords = []db.ListCategoryKeywordsByUserRow{}
	}
	utils.OK(w, keywords)
}

// POST /api/v1/keywords
func (h *KeywordHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)

	var req struct {
		Keyword    string `json:"keyword"`
		CategoryID string `json:"category_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Keyword == "" || req.CategoryID == "" {
		utils.BadRequest(w, "keyword and category_id are required")
		return
	}

	categoryUUID := stringToUUID(req.CategoryID)

	keyword, err := h.q.CreateCategoryKeyword(r.Context(), db.CreateCategoryKeywordParams{
		UserID:     userUUID,
		CategoryID: categoryUUID,
		Keyword:    req.Keyword,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, map[string]string{
		"id":          uuidToString(keyword.ID),
		"keyword":     keyword.Keyword,
		"category_id": uuidToString(keyword.CategoryID),
	})
}

// DELETE /api/v1/keywords/{id}
func (h *KeywordHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	kwID := stringToUUID(chi.URLParam(r, "id"))

	err := h.q.DeleteCategoryKeyword(r.Context(), db.DeleteCategoryKeywordParams{
		ID:     kwID,
		UserID: userUUID,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}
	utils.OK(w, map[string]string{"message": "keyword deleted"})
}
