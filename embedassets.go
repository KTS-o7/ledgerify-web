package embedassets

import (
	"embed"
	"io/fs"
	"log"
)

//go:embed web/templates/base.html
//go:embed web/templates/pages/*
//go:embed web/templates/partials/*
var templateFS embed.FS

//go:embed web/static/*
var staticFS embed.FS

func init() {
	// Verify critical templates load
	if _, err := fs.ReadFile(templateFS, "web/templates/base.html"); err != nil {
		log.Printf("embedassets: base.html not found in embedded FS: %v", err)
	}
	if _, err := fs.ReadFile(templateFS, "web/templates/pages/login.html"); err != nil {
		log.Printf("embedassets: login.html not found in embedded FS: %v", err)
	}
}

// TemplateFS returns the embedded template filesystem.
func TemplateFS() fs.FS { return templateFS }

// StaticFS returns the embedded static filesystem.
func StaticFS() fs.FS { return staticFS }
