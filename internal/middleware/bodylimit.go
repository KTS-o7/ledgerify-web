package middleware

import (
	"io"
	"net/http"
)

// BodyLimit returns a middleware that limits request body size.
// Requests with bodies exceeding maxBytes get a 413 response.
func BodyLimit(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// BodyLimitRoute applies a body size limit to a specific route.
func BodyLimitRoute(maxBytes int64) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next(w, r)
		}
	}
}

// DrainAndCloseBody reads any remaining body bytes and closes it.
// Safe to call in a defer even if body is nil.
func DrainAndCloseBody(r *http.Request) {
	if r.Body != nil {
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
	}
}
