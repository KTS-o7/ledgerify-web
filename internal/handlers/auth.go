package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

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
}

func NewAuthHandler(pool *pgxpool.Pool, jwtCfg *auth.JWTConfig) *AuthHandler {
	return &AuthHandler{pool: pool, jwtCfg: jwtCfg}
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

	q := db.New(h.pool)
	defaultCurrency := req.DefaultCurrency
	if defaultCurrency == "" {
		defaultCurrency = "USD"
	}

	user, err := q.CreateUser(r.Context(), db.CreateUserParams{
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

	q := db.New(h.pool)
	user, err := q.GetUserByEmail(r.Context(), req.Email)
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

// GET /api/v1/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	q := db.New(h.pool)
	userUUID := stringToUUID(claims.UserID)
	user, err := q.GetUserByID(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.OK(w, userToResponse(user))
}
