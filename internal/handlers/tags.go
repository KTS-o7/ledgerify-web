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

type TagHandler struct {
	q *db.Queries
}

func NewTagHandler(q *db.Queries) *TagHandler {
	return &TagHandler{q: q}
}

type createTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// GET /api/v1/tags
func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	tags, err := h.q.ListTagsByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if tags == nil {
		tags = []db.Tag{}
	}

	utils.OK(w, tags)
}

// POST /api/v1/tags
func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" {
		utils.BadRequest(w, "name is required")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	tag, err := h.q.CreateTag(r.Context(), db.CreateTagParams{
		UserID: userUUID,
		Name:   req.Name,
		Color:  pgtype.Text{String: req.Color, Valid: req.Color != ""},
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, tag)
}

type updateTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// GET /api/v1/tags/{id}
func (h *TagHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	tagID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	tag, err := h.q.GetTagByID(r.Context(), db.GetTagByIDParams{
		ID:     tagID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, tag)
}

// PUT /api/v1/tags/{id}
func (h *TagHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	tagID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	var req updateTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" {
		utils.BadRequest(w, "name is required")
		return
	}

	tag, err := h.q.UpdateTag(r.Context(), db.UpdateTagParams{
		ID:     tagID,
		UserID: userUUID,
		Name:   req.Name,
		Color:  pgtype.Text{String: req.Color, Valid: req.Color != ""},
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, tag)
}

// DELETE /api/v1/tags/{id}
func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	tagID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteTag(r.Context(), db.DeleteTagParams{
		ID:     tagID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "tag deleted"})
}
