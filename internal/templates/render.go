package templates

import (
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"os"
	"sync"
	"time"
)

var (
	// Set by Init from main
	templateFS fs.FS
	staticFS   fs.FS

	cache     map[string]*template.Template
	cacheMu   sync.RWMutex
	useEmbed  bool
)

// Init initializes the template cache with the given filesystems.
func Init(tFS, sFS fs.FS, devMode bool) {
	templateFS = tFS
	staticFS = sFS
	cache = make(map[string]*template.Template)
	useEmbed = !devMode
}

// PageData is the common data passed to every page template.
type PageData struct {
	Title       string
	User        *UserInfo
	CurrentPath string
	Theme       string // "dark" or "light"
	Data        any    // page-specific data
	Flashes     []Flash
}

type UserInfo struct {
	ID              string
	Email           string
	Name            string
	DefaultCurrency string
	Timezone        string
}

type Flash struct {
	Type    string // "success", "error", "info"
	Message string
}

// RenderPage renders a full page (base.html + page template).
func RenderPage(w http.ResponseWriter, page string, data PageData) {
	tmpl, err := getTemplate(page)
	if err != nil {
		http.Error(w, "template error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.ExecuteTemplate(w, "base.html", data); err != nil {
		http.Error(w, "render error: "+err.Error(), http.StatusInternalServerError)
	}
}

// RenderPartial renders a partial template (for htmx responses).
func RenderPartial(w http.ResponseWriter, partial string, data any) {
	tmpl, err := getPartial(partial)
	if err != nil {
		http.Error(w, "template error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, "render error: "+err.Error(), http.StatusInternalServerError)
	}
}

// getTemplate returns the cached template for a page, or compiles it.
func getTemplate(page string) (*template.Template, error) {
	cacheMu.RLock()
	tmpl, ok := cache[page]
	cacheMu.RUnlock()
	if ok {
		return tmpl, nil
	}

	cacheMu.Lock()
	defer cacheMu.Unlock()

	// Double-check after acquiring write lock
	if tmpl, ok = cache[page]; ok {
		return tmpl, nil
	}

	baseContent, err := fs.ReadFile(templateFS, "web/templates/base.html")
	if err != nil {
		return nil, fmt.Errorf("reading base.html: %w", err)
	}
	partialsContent := readAllPartials()
	pageContent, err := fs.ReadFile(templateFS, "web/templates/pages/"+page+".html")
	if err != nil {
		return nil, fmt.Errorf("reading page %s: %w", page, err)
	}

	tmpl = template.New("base.html").Funcs(funcMap)
	_, err = tmpl.Parse(string(baseContent))
	if err != nil {
		return nil, fmt.Errorf("parsing base.html: %w", err)
	}
	_, err = tmpl.Parse(string(partialsContent))
	if err != nil {
		return nil, fmt.Errorf("parsing partials: %w", err)
	}
	_, err = tmpl.Parse(string(pageContent))
	if err != nil {
		return nil, fmt.Errorf("parsing page %s: %w", page, err)
	}

	cache[page] = tmpl
	return tmpl, nil
}

func readAllPartials() []byte {
	var all []byte
	entries, err := fs.ReadDir(templateFS, "web/templates/partials")
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if !e.IsDir() && filepathExt(e.Name()) == ".html" {
			data, err := fs.ReadFile(templateFS, "web/templates/partials/"+e.Name())
			if err != nil {
				continue
			}
			all = append(all, data...)
		}
	}
	return all
}

func filepathExt(name string) string {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			return name[i:]
		}
	}
	return ""
}

// getPartial returns a cached partial template.
func getPartial(name string) (*template.Template, error) {
	cacheKey := "partial:" + name
	cacheMu.RLock()
	tmpl, ok := cache[cacheKey]
	cacheMu.RUnlock()
	if ok {
		return tmpl, nil
	}

	cacheMu.Lock()
	defer cacheMu.Unlock()
	if tmpl, ok = cache[cacheKey]; ok {
		return tmpl, nil
	}

	content, err := fs.ReadFile(templateFS, "web/templates/partials/"+name+".html")
	if err != nil {
		return nil, fmt.Errorf("reading partial %s: %w", name, err)
	}

	tmpl = template.New(name).Funcs(funcMap)
	_, err = tmpl.Parse(string(content))
	if err != nil {
		return nil, fmt.Errorf("parsing partial %s: %w", name, err)
	}

	cache[cacheKey] = tmpl
	return tmpl, nil
}

// StaticHandler serves embedded static files (CSS, JS).
func StaticHandler() http.Handler {
	if staticFS != nil {
		// Use embedded
		sub, err := fs.Sub(staticFS, "web/static")
		if err != nil {
			panic("static files not found: " + err.Error())
		}
		return http.FileServer(http.FS(sub))
	}
	// Dev mode: use local filesystem
	return http.FileServer(http.Dir("web/static"))
}

// ServeStatic is a convenience handler for /static/ prefix.
func ServeStatic(w http.ResponseWriter, r *http.Request) {
	// Strip /static/ prefix
	r.URL.Path = r.URL.Path[len("/static"):]
	StaticHandler().ServeHTTP(w, r)
}

// Now returns the current time. Used in templates for copyright year.
func Now() time.Time { return time.Now() }

func init() {
	cache = make(map[string]*template.Template)
	// Check if we're in development (web/ directory exists)
	if _, err := os.Stat("web/templates"); err == nil {
		useEmbed = false
	}
}
