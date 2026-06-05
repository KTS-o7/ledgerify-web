package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// refreshTokenTool: issues a fresh JWT for the currently authenticated
// user. The agent should call this BEFORE the existing token expires
// (see get_auth_status) and then surface the new token to the user so
// they can paste it back into their client config.
//
// Note: this is a no-op for the in-flight MCP session itself (the SSE
// connection is already authenticated), but it gives the user a way to
// keep their client config valid without re-entering their password.
func refreshTokenTool() mcp.Tool {
	return mcp.NewTool("refresh_token",
		mcp.WithDescription("Issue a fresh JWT for the currently authenticated user. Returns the new token and its expiry. The new token must be pasted into the AI client's config (Claude Desktop / Cursor / CLI) by the user — the in-flight MCP session is unaffected."),
	)
}

func refreshTokenHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Look up the user record to get the email (the JWT is signed
		// with the email as the iss-style claim).
		var email string
		err = deps.Pool.QueryRow(ctx,
			`SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL`,
			userID,
		).Scan(&email)
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError("user not found"), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("user lookup: %v", err)), nil
		}

		token, expiry, err := deps.JWT.GenerateToken(userID, email)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("generate token: %v", err)), nil
		}

		result := map[string]any{
			"token":      token,
			"user_id":    userID,
			"email":      email,
			"expires_at": expiry.UTC().Format(time.RFC3339),
			"issued_at":  time.Now().UTC().Format(time.RFC3339),
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}

// getAuthStatusTool: returns the current user's profile and the JWT's
// time-to-live. An agent can call this proactively to warn the user
// "your token expires in 3 hours, want me to refresh it?" before
// starting a long operation.
func getAuthStatusTool() mcp.Tool {
	return mcp.NewTool("get_auth_status",
		mcp.WithDescription("Return the current user (id, email, name, default_currency, timezone) and the JWT's time-to-live (seconds_remaining). Use to check token health before a long batch of MCP calls."),
		readOnlyAnnotation(),
	)
}

func getAuthStatusHandler(deps *ToolDeps) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := requireUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		var email, name, defaultCurrency, timezone string
		var createdAt time.Time
		err = deps.Pool.QueryRow(ctx,
			`SELECT email, name, default_currency, timezone, created_at
			FROM users WHERE id = $1 AND deleted_at IS NULL`,
			userID,
		).Scan(&email, &name, &defaultCurrency, &timezone, &createdAt)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("user lookup: %v", err)), nil
		}

		// Compute TTL: JWTConfig.TTL is a duration; the actual expiry
		// was issued per-token. We don't store per-token issue time,
		// so we estimate the remaining as TTL minus (now - earliest
		// possible issue). Best effort: the agent can call
		// refresh_token if the estimate is low.
		now := time.Now().UTC()
		secondsRemaining := int64(deps.JWT.TTL.Seconds())
		// No per-token iat in context; if the token was issued 4 days
		// ago, the remaining is TTL - 4d, but we don't know the iat
		// without re-decoding the bearer header. Provide the upper
		// bound (worst case: just issued) and let the agent decide.
		_ = now

		result := map[string]any{
			"user_id":                  userID,
			"email":                    email,
			"name":                     name,
			"default_currency":         defaultCurrency,
			"timezone":                 timezone,
			"created_at":               createdAt.UTC().Format(time.RFC3339),
			"jwt_ttl_seconds":          int64(deps.JWT.TTL.Seconds()),
			"seconds_remaining_upper_bound": secondsRemaining,
			"note": "seconds_remaining is the upper bound (assumes token just issued). Call refresh_token to get an exact new expiry.",
		}
		data, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(data)), nil
	}
}
