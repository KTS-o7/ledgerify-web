package mcp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	_, sse, _ := NewMCPServer(&pgxpool.Pool{}, nil)
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

// TestNewMCPServer_StreamableHTTPInitialize verifies the streamable HTTP
// transport is wired up and serves JSON-RPC `initialize` correctly.
// This is the transport mounted at /api/v1/mcp/stream in cmd/server/main.go
// for modern MCP clients (Anthropic spec 2025-03-26).
//
// Regression target: never remove NewStreamableHTTPServer or
// WithEndpointPath("/api/v1/mcp/stream") from internal/mcp/server.go
// without also updating cmd/server/main.go's route registration.
func TestNewMCPServer_StreamableHTTPInitialize(t *testing.T) {
	_, _, streamable := NewMCPServer(&pgxpool.Pool{}, nil)
	if streamable == nil {
		t.Fatal("NewMCPServer returned a nil StreamableHTTPServer")
	}

	body := []byte(`{
		"jsonrpc": "2.0",
		"id": 1,
		"method": "initialize",
		"params": {
			"protocolVersion": "2025-03-26",
			"clientInfo": {"name": "test", "version": "1.0.0"},
			"capabilities": {}
		}
	}`)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/mcp/stream", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	w := httptest.NewRecorder()
	streamable.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var resp struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Result  struct {
			ProtocolVersion string                 `json:"protocolVersion"`
			ServerInfo      map[string]interface{} `json:"serverInfo"`
		} `json:"result"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, w.Body.String())
	}
	if resp.JSONRPC != "2.0" {
		t.Errorf("jsonrpc = %q, want \"2.0\"", resp.JSONRPC)
	}
	if resp.ID != 1 {
		t.Errorf("id = %d, want 1", resp.ID)
	}
	if name, _ := resp.Result.ServerInfo["name"].(string); name != "ledgerify" {
		t.Errorf("serverInfo.name = %q, want \"ledgerify\"", name)
	}
	if resp.Result.ProtocolVersion == "" {
		t.Errorf("protocolVersion is empty")
	}
}
