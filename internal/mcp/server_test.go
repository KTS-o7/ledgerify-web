package mcp

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestNewMCPServer_SSEBasePathMatchesMountPoints ensures the SSE server
// advertises message and SSE endpoints that align with the HTTP routes
// registered in cmd/server/main.go:
//
//	r.Handle("/api/v1/mcp/sse",     sseServer.SSEHandler())
//	r.Handle("/api/v1/mcp/message", sseServer.MessageHandler())
//
// The endpoint event emitted by the SSE stream must use the SAME base
// path so real MCP clients (Claude Desktop, etc.) POST to a path that
// actually exists. Without WithBasePath, the SSE server emits a relative
// "/message?..." which resolves against the SSE stream URL and ends up
// at /api/v1/mcp/sse/message — a path with no handler — and clients get
// the SPA HTML back instead of a JSON-RPC response.
//
// Regression target: never remove WithBasePath("/api/v1/mcp") from
// internal/mcp/server.go's NewSSEServer call without also updating the
// route registration in cmd/server/main.go.
func TestNewMCPServer_SSEBasePathMatchesMountPoints(t *testing.T) {
	_, sse := NewMCPServer(&pgxpool.Pool{}, nil)
	if sse == nil {
		t.Fatal("NewMCPServer returned a nil SSEServer")
	}

	ssePath, err := sse.CompleteSseEndpoint()
	if err != nil {
		t.Fatalf("CompleteSseEndpoint: %v", err)
	}
	if ssePath != "/api/v1/mcp/sse" {
		t.Errorf("CompleteSseEndpoint = %q, want %q", ssePath, "/api/v1/mcp/sse")
	}

	msgPath, err := sse.CompleteMessageEndpoint()
	if err != nil {
		t.Fatalf("CompleteMessageEndpoint: %v", err)
	}
	if msgPath != "/api/v1/mcp/message" {
		t.Errorf("CompleteMessageEndpoint = %q, want %q", msgPath, "/api/v1/mcp/message")
	}
}
