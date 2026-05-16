package templates

import (
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// PageHandlers handles serving HTML pages.
type PageHandlers struct {
	pool   *pgxpool.Pool
	q      *db.Queries
	cq     *db.CustomQueries
	jwtCfg *auth.JWTConfig
}

// NewPageHandlers creates a new PageHandlers.
func NewPageHandlers(pool *pgxpool.Pool, q *db.Queries, cq *db.CustomQueries, jwtCfg *auth.JWTConfig) *PageHandlers {
	return &PageHandlers{pool: pool, q: q, cq: cq, jwtCfg: jwtCfg}
}

// LoginPage renders the login form.
func (ph *PageHandlers) LoginPage(w http.ResponseWriter, r *http.Request) {
	if GetUserInfo(r) != nil {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}
	data := NewPageData(r, "Sign In")
	data.Flashes = GetFlashes(r)
	http.SetCookie(w, &http.Cookie{Name: flashCookieName, Value: "", Path: "/", MaxAge: -1})
	RenderPage(w, "login", data)
}

// RegisterPage renders the registration form.
func (ph *PageHandlers) RegisterPage(w http.ResponseWriter, r *http.Request) {
	if GetUserInfo(r) != nil {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}
	data := NewPageData(r, "Create Account")
	data.Flashes = GetFlashes(r)
	http.SetCookie(w, &http.Cookie{Name: flashCookieName, Value: "", Path: "/", MaxAge: -1})
	RenderPage(w, "register", data)
}

// LoginAction handles the login form submission.
func (ph *PageHandlers) LoginAction(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	email := r.FormValue("email")
	password := r.FormValue("password")

	user, err := ph.q.GetUserByEmail(r.Context(), email)
	if err != nil {
		SetFlash(w, "error", "Invalid email or password")
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		SetFlash(w, "error", "Invalid email or password")
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	token, expiry, err := ph.jwtCfg.GenerateToken(uuid.UUID(user.ID.Bytes).String(), user.Email)
	if err != nil {
		SetFlash(w, "error", "Authentication error")
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	maxAge := int(time.Until(expiry).Seconds())
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

// RegisterAction handles the registration form submission.
func (ph *PageHandlers) RegisterAction(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	email := r.FormValue("email")
	password := r.FormValue("password")
	name := r.FormValue("name")

	if email == "" || password == "" || name == "" {
		SetFlash(w, "error", "All fields are required")
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	if len(password) < 6 {
		SetFlash(w, "error", "Password must be at least 6 characters")
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		SetFlash(w, "error", "Registration error")
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	user, err := ph.q.CreateUser(r.Context(), db.CreateUserParams{
		Email:        email,
		PasswordHash: string(hash),
		Name:         name,
	})
	if err != nil {
		SetFlash(w, "error", "Email already registered")
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	token, expiry, err := ph.jwtCfg.GenerateToken(uuid.UUID(user.ID.Bytes).String(), user.Email)
	if err != nil {
		SetFlash(w, "error", "Registration error")
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	maxAge := int(time.Until(expiry).Seconds())
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

// DashboardPage renders the dashboard.
func (ph *PageHandlers) DashboardPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Dashboard")
	RenderPage(w, "placeholder", data)
}

// Placeholder returns a handler that renders the placeholder page.
func (ph *PageHandlers) Placeholder(title string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data := NewPageData(r, title)
		RenderPage(w, "placeholder", data)
	}
}

// LogoutAction clears the JWT cookie and redirects to login.
func (ph *PageHandlers) LogoutAction(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}
