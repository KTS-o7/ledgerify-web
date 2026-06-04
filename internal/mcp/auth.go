package mcp

import (
	"context"
	"net/http"
	"strings"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func AuthMiddleware(jwtCfg *auth.JWTConfig) func(ctx context.Context, r *http.Request) context.Context {
	return func(ctx context.Context, r *http.Request) context.Context {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			return ctx
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			return ctx
		}

		claims, err := jwtCfg.ValidateToken(token)
		if err != nil {
			return ctx
		}

		return context.WithValue(ctx, UserIDKey, claims.UserID)
	}
}

func GetUserID(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDKey).(string)
	return userID, ok
}
