package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	pool   *pgxpool.Pool
	jwtCfg *auth.JWTConfig
	q      db.Querier
}

func NewAuthHandler(pool *pgxpool.Pool, jwtCfg *auth.JWTConfig) *AuthHandler {
	return &AuthHandler{pool: pool, jwtCfg: jwtCfg, q: db.New(pool)}
}

type authRegisterRequest struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	Name            string `json:"name"`
	DefaultCurrency string `json:"default_currency"`
}

type authLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userResponse struct {
	ID              string `json:"id"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	DefaultCurrency string `json:"default_currency"`
	Timezone        string `json:"timezone"`
}

type authResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

func userToResponse(u db.User) userResponse {
	return userResponse{
		ID:              uuidToString(u.ID),
		Email:           u.Email,
		Name:            u.Name,
		DefaultCurrency: u.DefaultCurrency,
		Timezone:        u.Timezone,
	}
}

// POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		utils.BadRequest(w, "email, password, and name are required")
		return
	}
	if len(req.Password) < 6 {
		utils.BadRequest(w, "password must be at least 6 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalError(w)
		return
	}

	defaultCurrency := req.DefaultCurrency
	if defaultCurrency == "" {
		defaultCurrency = "USD"
	}

	user, err :=	h.q.CreateUser(r.Context(),db.CreateUserParams{
		Email:           req.Email,
		PasswordHash:    string(hash),
		Name:            req.Name,
		DefaultCurrency: defaultCurrency,
		Timezone:        "UTC",
	})
	if err != nil {
		// Distinguish unique violation from other errors to avoid email enumeration
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			utils.BadRequest(w, "registration failed")
		} else {
			utils.InternalError(w)
		}
		return
	}

	userID := uuidToString(user.ID)
	token, _, err := h.jwtCfg.GenerateToken(userID, user.Email)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, authResponse{
		Token: token,
		User:  userToResponse(user),
	})
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		utils.BadRequest(w, "email and password are required")
		return
	}

	user, err := h.q.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		utils.BadRequest(w, "invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		utils.BadRequest(w, "invalid email or password")
		return
	}

	userID := uuidToString(user.ID)
	token, _, err := h.jwtCfg.GenerateToken(userID, user.Email)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, authResponse{
		Token: token,
		User:  userToResponse(user),
	})
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	utils.OK(w, map[string]string{"message": "logged out"})
}

// POST /api/v1/auth/refresh
//
// Accepts a still-valid bearer token (via Authorization header) and
// returns a new one. Used by MCP clients and the /mcp-connect host
// page to renew a token before (or right after) it expires without
// asking the user to re-enter their password.
//
// Returns 401 if the token is missing, malformed, or already expired.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		utils.Unauthorized(w)
		return
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		utils.Unauthorized(w)
		return
	}
	tokenStr := strings.TrimSpace(parts[1])

	claims, err := h.jwtCfg.ValidateToken(tokenStr)
	if err != nil {
		utils.Unauthorized(w)
		return
	}

	// Issue a fresh token for the same user. We don't extend the
	// existing one (no revocation list); the new token has a fresh
	// TTL from now.
	newToken, expiry, err := h.jwtCfg.GenerateToken(claims.UserID, claims.Email)
	if err != nil {
		utils.InternalError(w)
		return
	}

	// Look up the user record for the response payload.
	userUUID := stringToUUID(claims.UserID)
	user, err := h.q.GetUserByID(r.Context(), userUUID)
	if err != nil {
		// Token was valid but user no longer exists / is soft-deleted.
		utils.Unauthorized(w)
		return
	}

	utils.OK(w, map[string]any{
		"token":      newToken,
		"expires_at": expiry.UTC().Format("2006-01-02T15:04:05Z"),
		"user":       userToResponse(user),
	})
}

// GET /api/v1/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	user, err := h.q.GetUserByID(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, userToResponse(user))
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// POST /api/v1/auth/change-password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		utils.BadRequest(w, "current_password and new_password are required")
		return
	}
	if len(req.NewPassword) < 8 {
		utils.BadRequest(w, "new password must be at least 8 characters")
		return
	}

	userUUID := stringToUUID(claims.UserID)
	user, err := h.q.GetUserByID(r.Context(), userUUID)
	if err != nil {
		utils.Unauthorized(w)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		utils.BadRequest(w, "current password is incorrect")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalError(w)
		return
	}

	_, err = h.pool.Exec(r.Context(),
		"UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
		string(hash), userUUID,
	)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, map[string]string{"message": "password updated"})
}

type updateProfileRequest struct {
	Name            string `json:"name"`
	DefaultCurrency string `json:"default_currency"`
	Timezone        string `json:"timezone"`
}

// PUT /api/v1/auth/me
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.DefaultCurrency == "" || req.Timezone == "" {
		utils.BadRequest(w, "name, default_currency, and timezone are required")
		return
	}

	q := db.New(h.pool)
	userUUID := stringToUUID(claims.UserID)
	user, err := q.UpdateUser(r.Context(), db.UpdateUserParams{
		ID:              userUUID,
		Name:            req.Name,
		DefaultCurrency: req.DefaultCurrency,
		Timezone:        req.Timezone,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, userToResponse(user))
}
