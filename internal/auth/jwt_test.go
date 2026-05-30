package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateToken_Success(t *testing.T) {
	jc := &JWTConfig{Secret: "test-secret", Issuer: "test-issuer"}

	token, expiry, err := jc.GenerateToken("user-1", "user@example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if expiry.Before(time.Now()) {
		t.Errorf("expiry %v is in the past", expiry)
	}
}

func TestValidateToken_Success(t *testing.T) {
	jc := &JWTConfig{Secret: "test-secret", Issuer: "test-issuer"}

	token, _, err := jc.GenerateToken("user-1", "user@example.com")
	if err != nil {
		t.Fatalf("GenerateToken error: %v", err)
	}

	claims, err := jc.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken error: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Errorf("UserID = %q, want %q", claims.UserID, "user-1")
	}
	if claims.Email != "user@example.com" {
		t.Errorf("Email = %q, want %q", claims.Email, "user@example.com")
	}
	if claims.Issuer != "test-issuer" {
		t.Errorf("Issuer = %q, want %q", claims.Issuer, "test-issuer")
	}
}

func TestValidateToken_InvalidSecret(t *testing.T) {
	jc1 := &JWTConfig{Secret: "secret-one", Issuer: "issuer"}
	jc2 := &JWTConfig{Secret: "secret-two", Issuer: "issuer"}

	token, _, err := jc1.GenerateToken("user-1", "user@example.com")
	if err != nil {
		t.Fatalf("GenerateToken error: %v", err)
	}

	_, err = jc2.ValidateToken(token)
	if err == nil {
		t.Fatal("expected error for invalid secret, got nil")
	}
}

func TestValidateToken_MalformedToken(t *testing.T) {
	jc := &JWTConfig{Secret: "test-secret", Issuer: "issuer"}

	_, err := jc.ValidateToken("not-a-valid-jwt")
	if err == nil {
		t.Fatal("expected error for malformed token, got nil")
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	jc := &JWTConfig{Secret: "test-secret", Issuer: "test-issuer"}

	claims := &Claims{
		UserID: "user-1",
		Email:  "user@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "test-issuer",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("signing error: %v", err)
	}

	_, err = jc.ValidateToken(signed)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestNewJWTConfig(t *testing.T) {
	cfg := &Config{
		JWTSecret: "my-secret",
		JWTIssuer: "my-issuer",
	}

	jc := NewJWTConfig(cfg)
	if jc.Secret != "my-secret" {
		t.Errorf("Secret = %q, want %q", jc.Secret, "my-secret")
	}
	if jc.Issuer != "my-issuer" {
		t.Errorf("Issuer = %q, want %q", jc.Issuer, "my-issuer")
	}
}
