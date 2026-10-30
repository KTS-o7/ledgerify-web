package main

import (
	"net/http/httptest"
	"testing"
)

func TestSetStaticHeaders(t *testing.T) {
	cases := []struct {
		path, contentType, cache string
	}{
		{"frontend/dist/sw.js", "application/javascript", "no-cache"},
		{"frontend/dist/manifest.webmanifest", "application/manifest+json", "no-cache"},
		{"frontend/dist/assets/index-abc.js", "application/javascript", "public, max-age=31536000, immutable"},
		{"frontend/dist/icons/icon-192.png", "image/png", "public, max-age=86400"},
		{"frontend/dist/photo.jpg", "image/jpeg", "public, max-age=31536000, immutable"},
		{"frontend/dist/favicon.ico", "image/x-icon", "public, max-age=31536000, immutable"},
		{"frontend/dist/index.html", "text/html", "no-cache, no-transform"},
	}
	for _, c := range cases {
		w := httptest.NewRecorder()
		setStaticHeaders(w, c.path)
		if got := w.Header().Get("Content-Type"); got != c.contentType {
			t.Errorf("%s: Content-Type = %q, want %q", c.path, got, c.contentType)
		}
		if got := w.Header().Get("Cache-Control"); got != c.cache {
			t.Errorf("%s: Cache-Control = %q, want %q", c.path, got, c.cache)
		}
	}
	w := httptest.NewRecorder()
	setStaticHeaders(w, "frontend/dist/sw.js")
	if got := w.Header().Get("Service-Worker-Allowed"); got != "/" {
		t.Errorf("sw.js: Service-Worker-Allowed = %q, want /", got)
	}
}
