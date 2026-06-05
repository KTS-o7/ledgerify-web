package mcp

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KTS-o7/ledgerify-web/internal/auth"
)

func NewMCPServer(pool *pgxpool.Pool, jwtCfg *auth.JWTConfig) (*server.MCPServer, *server.SSEServer, *server.StreamableHTTPServer) {
	s := server.NewMCPServer("ledgerify", "1.0.0",
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
	)

	deps := &ToolDeps{Pool: pool, JWT: jwtCfg}

	RegisterTools(s, deps)
	RegisterResources(s, deps)

	sse := server.NewSSEServer(s,
		server.WithBasePath("/api/v1/mcp"),
		server.WithSSEEndpoint("/sse"),
		server.WithMessageEndpoint("/message"),
		server.WithSSEContextFunc(AuthMiddleware(jwtCfg)),
	)

	streamable := server.NewStreamableHTTPServer(s,
		server.WithEndpointPath("/api/v1/mcp/stream"),
		server.WithHTTPContextFunc(AuthMiddleware(jwtCfg)),
	)

	return s, sse, streamable
}
