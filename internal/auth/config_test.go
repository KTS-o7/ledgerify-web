package auth

import (
	"os"
	"testing"
)

func clearEnv(keys ...string) {
	for _, k := range keys {
		os.Unsetenv(k)
	}
}

func TestLoadConfig_Success(t *testing.T) {
	clearEnv("JWT_SECRET", "PORT", "DATABASE_URL", "JWT_ISSUER", "FRONTEND_URL",
		"LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_USER_AGENT", "LLM_WORKERS", "LLM_QUEUE_SIZE")
	t.Cleanup(func() {
		clearEnv("JWT_SECRET", "PORT", "DATABASE_URL", "JWT_ISSUER", "FRONTEND_URL",
			"LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_USER_AGENT", "LLM_WORKERS", "LLM_QUEUE_SIZE")
	})

	os.Setenv("JWT_SECRET", "test-secret")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.JWTSecret != "test-secret" {
		t.Errorf("JWTSecret = %q, want %q", cfg.JWTSecret, "test-secret")
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want %q", cfg.Port, "8080")
	}
	if cfg.JWTIssuer != "ledgerify" {
		t.Errorf("JWTIssuer = %q, want %q", cfg.JWTIssuer, "ledgerify")
	}
	if cfg.FrontendURL != "http://localhost:3000" {
		t.Errorf("FrontendURL = %q, want %q", cfg.FrontendURL, "http://localhost:3000")
	}
	if cfg.LLMAPIURL != "https://ai.shenthar.me" {
		t.Errorf("LLMAPIURL = %q, want %q", cfg.LLMAPIURL, "https://ai.shenthar.me")
	}
	if cfg.LLMModel != "taalas-llama3.1-8b" {
		t.Errorf("LLMModel = %q, want %q", cfg.LLMModel, "taalas-llama3.1-8b")
	}
	if cfg.LLMUserAgent != "curl/8.4.0" {
		t.Errorf("LLMUserAgent = %q, want %q", cfg.LLMUserAgent, "curl/8.4.0")
	}
}

func TestLoadConfig_MissingJWTSecret(t *testing.T) {
	clearEnv("JWT_SECRET")
	t.Cleanup(func() { os.Unsetenv("JWT_SECRET") })

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("expected error for missing JWT_SECRET, got nil")
	}
}

func TestLoadConfig_CustomValues(t *testing.T) {
	clearEnv("JWT_SECRET", "PORT", "DATABASE_URL", "JWT_ISSUER", "FRONTEND_URL",
		"LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_USER_AGENT", "LLM_WORKERS", "LLM_QUEUE_SIZE")
	t.Cleanup(func() {
		clearEnv("JWT_SECRET", "PORT", "DATABASE_URL", "JWT_ISSUER", "FRONTEND_URL",
			"LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_USER_AGENT", "LLM_WORKERS", "LLM_QUEUE_SIZE")
	})

	os.Setenv("JWT_SECRET", "my-secret")
	os.Setenv("PORT", "9090")
	os.Setenv("DATABASE_URL", "postgres://localhost/mydb")
	os.Setenv("JWT_ISSUER", "my-issuer")
	os.Setenv("FRONTEND_URL", "https://example.com")
	os.Setenv("LLM_API_URL", "https://llm.example.com")
	os.Setenv("LLM_API_KEY", "sk-test")
	os.Setenv("LLM_MODEL", "custom-model")
	os.Setenv("LLM_USER_AGENT", "test-agent")
	os.Setenv("LLM_WORKERS", "7")
	os.Setenv("LLM_QUEUE_SIZE", "200")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "9090" {
		t.Errorf("Port = %q, want %q", cfg.Port, "9090")
	}
	if cfg.DatabaseURL != "postgres://localhost/mydb" {
		t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, "postgres://localhost/mydb")
	}
	if cfg.JWTSecret != "my-secret" {
		t.Errorf("JWTSecret = %q, want %q", cfg.JWTSecret, "my-secret")
	}
	if cfg.JWTIssuer != "my-issuer" {
		t.Errorf("JWTIssuer = %q, want %q", cfg.JWTIssuer, "my-issuer")
	}
	if cfg.FrontendURL != "https://example.com" {
		t.Errorf("FrontendURL = %q, want %q", cfg.FrontendURL, "https://example.com")
	}
	if cfg.LLMAPIURL != "https://llm.example.com" {
		t.Errorf("LLMAPIURL = %q, want %q", cfg.LLMAPIURL, "https://llm.example.com")
	}
	if cfg.LLMAPIKey != "sk-test" {
		t.Errorf("LLMAPIKey = %q, want %q", cfg.LLMAPIKey, "sk-test")
	}
	if cfg.LLMModel != "custom-model" {
		t.Errorf("LLMModel = %q, want %q", cfg.LLMModel, "custom-model")
	}
	if cfg.LLMUserAgent != "test-agent" {
		t.Errorf("LLMUserAgent = %q, want %q", cfg.LLMUserAgent, "test-agent")
	}
	if cfg.LLMWorkers != 7 {
		t.Errorf("LLMWorkers = %d, want %d", cfg.LLMWorkers, 7)
	}
	if cfg.LLMQueueSize != 200 {
		t.Errorf("LLMQueueSize = %d, want %d", cfg.LLMQueueSize, 200)
	}
}

func TestLoadConfig_LLMDefaults(t *testing.T) {
	clearEnv("JWT_SECRET", "LLM_WORKERS", "LLM_QUEUE_SIZE", "LLM_API_URL", "LLM_MODEL", "LLM_USER_AGENT")
	t.Cleanup(func() {
		clearEnv("JWT_SECRET", "LLM_WORKERS", "LLM_QUEUE_SIZE", "LLM_API_URL", "LLM_MODEL", "LLM_USER_AGENT")
	})

	os.Setenv("JWT_SECRET", "test")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.LLMWorkers != 3 {
		t.Errorf("LLMWorkers = %d, want %d", cfg.LLMWorkers, 3)
	}
	if cfg.LLMQueueSize != 100 {
		t.Errorf("LLMQueueSize = %d, want %d", cfg.LLMQueueSize, 100)
	}
	if cfg.LLMAPIURL != "https://ai.shenthar.me" {
		t.Errorf("LLMAPIURL = %q, want %q", cfg.LLMAPIURL, "https://ai.shenthar.me")
	}
	if cfg.LLMModel != "taalas-llama3.1-8b" {
		t.Errorf("LLMModel = %q, want %q", cfg.LLMModel, "taalas-llama3.1-8b")
	}
	if cfg.LLMUserAgent != "curl/8.4.0" {
		t.Errorf("LLMUserAgent = %q, want %q", cfg.LLMUserAgent, "curl/8.4.0")
	}
}
