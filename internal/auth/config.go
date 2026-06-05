package auth

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	JWTIssuer    string
	JWTTTL       time.Duration
	FrontendURL  string
	LLMAPIURL    string
	LLMAPIKey    string
	LLMModel     string
	LLMUserAgent string
	LLMWorkers   int
	LLMQueueSize int
}

func LoadConfig() (*Config, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET environment variable is required")
	}

	jwtTTL, err := time.ParseDuration(getEnv("JWT_TTL", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_TTL (use Go duration syntax, e.g. 168h, 30m, 24h): %w", err)
	}
	if jwtTTL <= 0 {
		return nil, errors.New("JWT_TTL must be positive")
	}

	llmWorkers, err := strconv.Atoi(getEnv("LLM_WORKERS", "3"))
	if err != nil {
		llmWorkers = 3
	}
	llmQueueSize, err := strconv.Atoi(getEnv("LLM_QUEUE_SIZE", "100"))
	if err != nil {
		llmQueueSize = 100
	}

	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    jwtSecret,
		JWTIssuer:    getEnv("JWT_ISSUER", "ledgerify"),
		JWTTTL:       jwtTTL,
		FrontendURL:  getEnv("FRONTEND_URL", "http://localhost:3000"),
		LLMAPIURL:    getEnv("LLM_API_URL", "https://ai.shenthar.me"),
		LLMAPIKey:    os.Getenv("LLM_API_KEY"),
		LLMModel:     getEnv("LLM_MODEL", "taalas-llama3.1-8b"),
		LLMUserAgent: getEnv("LLM_USER_AGENT", "curl/8.4.0"),
		LLMWorkers:   llmWorkers,
		LLMQueueSize: llmQueueSize,
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
