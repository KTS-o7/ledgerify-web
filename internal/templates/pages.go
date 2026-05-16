package templates

import (
	"net/http"
	"strings"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
)

// PageAuthMiddleware checks for JWT in cookie or Authorization header.
// If valid, injects claims into context and passes through.
// If invalid/absent and the path is not an auth page, redirects to /login.
func PageAuthMiddleware(jwtCfg *auth.JWTConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for static assets and auth pages
			path := r.URL.Path
			if strings.HasPrefix(path, "/static/") || path == "/login" || path == "/register" {
				next.ServeHTTP(w, r)
				return
			}

			var tokenStr string

			// Check cookie first
			cookie, err := r.Cookie("token")
			if err == nil && cookie.Value != "" {
				tokenStr = cookie.Value
			}

			// Fallback to Authorization header
			if tokenStr == "" {
				header := r.Header.Get("Authorization")
				if strings.HasPrefix(header, "Bearer ") {
					tokenStr = header[7:]
				}
			}

			if tokenStr == "" {
				// API paths return JSON error, page paths redirect
				if strings.HasPrefix(path, "/api/") {
					http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
					return
				}
				http.Redirect(w, r, "/login", http.StatusSeeOther)
				return
			}

			claims, err := jwtCfg.ValidateToken(tokenStr)
			if err != nil {
				if strings.HasPrefix(path, "/api/") {
					http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
					return
				}
				// Clear invalid cookie and redirect
				http.SetCookie(w, &http.Cookie{
					Name:     "token",
					Value:    "",
					Path:     "/",
					MaxAge:   -1,
					HttpOnly: true,
				})
				http.Redirect(w, r, "/login", http.StatusSeeOther)
				return
			}

			// Inject claims into context (same pattern as existing middleware)
			r = r.WithContext(middleware.WithUserClaims(r.Context(), claims))
			next.ServeHTTP(w, r)
		})
	}
}

// GetTheme returns the current theme from cookie or defaults to "dark".
func GetTheme(r *http.Request) string {
	cookie, err := r.Cookie("theme")
	if err == nil && cookie.Value == "light" {
		return "light"
	}
	return "dark"
}

// GetUserInfo extracts user info from the request context.
// Returns nil if not authenticated.
func GetUserInfo(r *http.Request) *UserInfo {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		return nil
	}
	return &UserInfo{
		ID:    claims.UserID,
		Email: claims.Email,
	}
}

// NewPageData creates a PageData struct from the request.
func NewPageData(r *http.Request, title string) PageData {
	theme := GetTheme(r)
	user := GetUserInfo(r)
	return PageData{
		Title:       title,
		User:        user,
		CurrentPath: r.URL.Path,
		Theme:       theme,
	}
}

// Flash helpers
const flashCookieName = "ledgerify_flash"

func SetFlash(w http.ResponseWriter, flashType, message string) {
	http.SetCookie(w, &http.Cookie{
		Name:     flashCookieName,
		Value:    flashType + ":" + message,
		Path:     "/",
		MaxAge:   60, // 1 minute
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func GetFlashes(r *http.Request) []Flash {
	cookie, err := r.Cookie(flashCookieName)
	if err != nil {
		return nil
	}
	parts := strings.SplitN(cookie.Value, ":", 2)
	if len(parts) != 2 {
		return nil
	}
	return []Flash{{Type: parts[0], Message: parts[1]}}
}
