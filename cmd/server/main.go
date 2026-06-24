package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"

	embedassets "github.com/KTS-o7/ledgerify-web"
	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/handlers"
	"github.com/KTS-o7/ledgerify-web/internal/llm"
	"github.com/KTS-o7/ledgerify-web/internal/mcp"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/recalc"
	"github.com/KTS-o7/ledgerify-web/internal/recurring"
)

// ipRateLimiters holds per-IP rate limiters. Each entry is created on first
// access and never deleted (acceptable for low-traffic auth endpoints).
var (
	ipLimiters   sync.Map // map[string]*rate.Limiter
	loginLimiter = struct {
		r rate.Limit
		b int
	}{r: rate.Every(6 * time.Second), b: 10} // 10 req/min
	refreshLimiter = struct {
		r rate.Limit
		b int
	}{r: rate.Every(3 * time.Second), b: 20} // 20 req/min
)

func getIPLimiter(ip string, r rate.Limit, b int) *rate.Limiter {
	key := fmt.Sprintf("%s:%.6f:%d", ip, float64(r), b)
	if v, ok := ipLimiters.Load(key); ok {
		return v.(*rate.Limiter)
	}
	lim := rate.NewLimiter(r, b)
	actual, _ := ipLimiters.LoadOrStore(key, lim)
	return actual.(*rate.Limiter)
}

func rateLimitMiddleware(r rate.Limit, b int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ip := req.RemoteAddr
			// chimw.RealIP has already normalised RemoteAddr to just the IP.
			lim := getIPLimiter(ip, r, b)
			if !lim.Allow() {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{"error": "too many requests"})
				return
			}
			next.ServeHTTP(w, req)
		})
	}
}

func spaHandler(fsys embed.FS, root string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			path = "index.html"
		} else {
			path = strings.TrimPrefix(path, "/")
		}

		fullPath := root + "/" + path
		stat, err := fs.Stat(fsys, fullPath)
		if os.IsNotExist(err) || (stat != nil && stat.IsDir()) {
			fullPath = root + "/index.html"
		}

		data, err := fsys.ReadFile(fullPath)
		if err != nil {
			http.NotFound(w, r)
			return
		}

		ext := fullPath
		switch {
		case strings.HasSuffix(ext, ".js"):
			w.Header().Set("Content-Type", "application/javascript")
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasSuffix(ext, ".css"):
			w.Header().Set("Content-Type", "text/css")
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasSuffix(ext, ".json"):
			w.Header().Set("Content-Type", "application/json")
		case strings.HasSuffix(ext, ".svg"):
			w.Header().Set("Content-Type", "image/svg+xml")
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasSuffix(ext, ".png"), strings.HasSuffix(ext, ".jpg"), strings.HasSuffix(ext, ".ico"):
			w.Header().Set("Content-Type", "image/"+strings.TrimPrefix(ext, "."))
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		default:
			// HTML: no-transform disables Cloudflare Rocket Loader and other
			// proxy transformations that break SolidJS ES module execution.
			w.Header().Set("Content-Type", "text/html")
			w.Header().Set("Cache-Control", "no-cache, no-transform")
		}
		w.Write(data)
	})
}

func main() {
	cfg, err := auth.LoadConfig()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}
	log.Println("connected to database")

	q := db.New(pool)
	cq := db.NewCustomQueries(pool)

	jwtCfg := auth.NewJWTConfig(cfg)

	llmClient := llm.NewClient(cfg.LLMAPIURL, cfg.LLMAPIKey, cfg.LLMModel, cfg.LLMUserAgent)
	llmQueue := llm.NewQueue(llmClient, pool, cfg.LLMQueueSize, cfg.LLMWorkers)

	corsHandler := cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendURL, "http://localhost:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	})

	authHandler := handlers.NewAuthHandler(pool, jwtCfg)
	accountHandler := handlers.NewAccountHandler(pool, q, cq)
	categoryHandler := handlers.NewCategoryHandler(q)
	tagHandler := handlers.NewTagHandler(q)
	transactionHandler := handlers.NewTransactionHandler(q, pool, llmQueue)
	budgetHandler := handlers.NewBudgetHandler(pool, q)
	summaryHandler := handlers.NewSummaryHandler(pool, q, cq)
	netWorthHandler := handlers.NewNetWorthHandler(q, cq)
	netWorthSnapshotHandler := handlers.NewNetWorthSnapshotHandler(pool)
	recalcSvc := recalc.New(pool)
	investmentHandler := handlers.NewInvestmentHandler(q, recalcSvc)
	loanHandler := handlers.NewLoanHandler(q, recalcSvc)
	sipHandler := handlers.NewSipHandler(q, recalcSvc)
	insuranceHandler := handlers.NewInsuranceHandler(q)
	savingsHandler := handlers.NewSavingsGoalHandler(q)
	importExportHandler := handlers.NewImportExportHandler(pool, q, llmClient)
	keywordHandler := handlers.NewKeywordHandler(pool, q)
	_, sseServer, streamableServer := mcp.NewMCPServer(pool, jwtCfg)
	rateHandler := handlers.NewExchangeRateHandlerWithPool(q, pool)
	recurringHandler := handlers.NewRecurringHandler(pool)

	r := chi.NewRouter()
	r.Use(corsHandler)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(chimw.RequestID)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(middleware.BodyLimit(1 << 20)) // 1MB

	// Health
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// === API ROUTES ===
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.With(rateLimitMiddleware(loginLimiter.r, loginLimiter.b)).Post("/register", authHandler.Register)
		r.With(rateLimitMiddleware(loginLimiter.r, loginLimiter.b)).Post("/login", authHandler.Login)
		// /refresh sits outside the auth-middleware group: it
		// reads the bearer token from the Authorization header
		// itself, validates it, and issues a new one. Putting
		// it inside the middleware group would create a chicken-
		// and-egg: the only way to get a token is to already
		// have one.
		r.With(rateLimitMiddleware(refreshLimiter.r, refreshLimiter.b)).Post("/refresh", authHandler.Refresh)

		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(jwtCfg))
			r.Post("/logout", authHandler.Logout)
			r.Get("/me", authHandler.Me)
			r.Put("/me", authHandler.UpdateProfile)
			r.Post("/change-password", authHandler.ChangePassword)
		})
	})

	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(jwtCfg))

		r.Delete("/api/v1/users/me", authHandler.DeleteAccount)

		r.Route("/api/v1/accounts", func(r chi.Router) {
			r.Get("/", accountHandler.List)
			r.Post("/", accountHandler.Create)
			r.Get("/{id}", accountHandler.Get)
			r.Put("/{id}", accountHandler.Update)
			r.Delete("/{id}", accountHandler.Delete)
		})

		r.Route("/api/v1/categories", func(r chi.Router) {
			r.Get("/", categoryHandler.List)
			r.Post("/", categoryHandler.Create)
			r.Get("/{id}", categoryHandler.Get)
			r.Put("/{id}", categoryHandler.Update)
			r.Delete("/{id}", categoryHandler.Delete)
		})

		r.Route("/api/v1/tags", func(r chi.Router) {
			r.Get("/", tagHandler.List)
			r.Post("/", tagHandler.Create)
			r.Get("/{id}", tagHandler.Get)
			r.Put("/{id}", tagHandler.Update)
			r.Delete("/{id}", tagHandler.Delete)
		})

		r.Route("/api/v1/transactions", func(r chi.Router) {
			r.Get("/", transactionHandler.List)
			r.Post("/", transactionHandler.Create)
			r.Get("/{id}", transactionHandler.Get)
			r.Put("/{id}", transactionHandler.Update)
			r.Delete("/{id}", transactionHandler.Delete)
		})

		r.Get("/api/v1/summary", summaryHandler.GetSummary)
		r.Get("/api/v1/networth", netWorthHandler.Get)
		r.Post("/api/v1/networth/snapshot", netWorthSnapshotHandler.Create)
		r.Get("/api/v1/networth/snapshots", netWorthSnapshotHandler.List)
		r.Delete("/api/v1/networth/snapshots/{id}", netWorthSnapshotHandler.Delete)

		r.Route("/api/v1/budgets", func(r chi.Router) {
			r.Get("/", budgetHandler.List)
			r.Post("/", budgetHandler.Create)
			r.Get("/{id}", budgetHandler.Get)
			r.Put("/{id}", budgetHandler.Update)
			r.Delete("/{id}", budgetHandler.Delete)
		})

		r.Route("/api/v1/investments", func(r chi.Router) {
			r.Get("/", investmentHandler.List)
			r.Post("/", investmentHandler.Create)
			r.Get("/{id}", investmentHandler.Get)
			r.Put("/{id}", investmentHandler.Update)
			r.Delete("/{id}", investmentHandler.Delete)
			r.Get("/{id}/transactions", investmentHandler.ListTransactions)
			r.Post("/{id}/transactions", investmentHandler.CreateTransaction)
		})

		r.Route("/api/v1/loans", func(r chi.Router) {
			r.Get("/", loanHandler.List)
			r.Post("/", loanHandler.Create)
			r.Get("/{id}", loanHandler.Get)
			r.Put("/{id}", loanHandler.Update)
			r.Delete("/{id}", loanHandler.Delete)
			r.Get("/{id}/payments", loanHandler.ListPayments)
			r.Post("/{id}/payments", loanHandler.CreatePayment)
			r.Get("/{id}/amortization", loanHandler.GetAmortization)
		})

		r.Route("/api/v1/sips", func(r chi.Router) {
			r.Get("/", sipHandler.List)
			r.Post("/", sipHandler.Create)
			r.Get("/{id}", sipHandler.Get)
			r.Put("/{id}", sipHandler.Update)
			r.Delete("/{id}", sipHandler.Delete)
		})

		r.Route("/api/v1/insurance", func(r chi.Router) {
			r.Get("/", insuranceHandler.List)
			r.Post("/", insuranceHandler.Create)
			r.Get("/{id}", insuranceHandler.Get)
			r.Put("/{id}", insuranceHandler.Update)
			r.Delete("/{id}", insuranceHandler.Delete)
			r.Get("/{id}/payments", insuranceHandler.ListPayments)
			r.Post("/{id}/payments", insuranceHandler.CreatePayment)
		})

		r.Route("/api/v1/savings", func(r chi.Router) {
			r.Get("/", savingsHandler.List)
			r.Post("/", savingsHandler.Create)
			r.Get("/{id}", savingsHandler.Get)
			r.Put("/{id}", savingsHandler.Update)
			r.Delete("/{id}", savingsHandler.Delete)
		})

		r.Get("/api/v1/exchange-rates", rateHandler.List)
		r.Post("/api/v1/exchange-rates", rateHandler.Upsert)

		r.Route("/api/v1/keywords", func(r chi.Router) {
			r.Get("/", keywordHandler.List)
			r.Post("/", keywordHandler.Create)
			r.Delete("/{id}", keywordHandler.Delete)
		})

		r.Route("/api/v1/recurring", func(r chi.Router) {
			r.Get("/", recurringHandler.List)
			r.Post("/", recurringHandler.Create)
			r.Post("/run-now", recurringHandler.RunNow)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", recurringHandler.Get)
				r.Put("/", recurringHandler.Update)
				r.Delete("/", recurringHandler.Delete)
				r.Post("/status", recurringHandler.SetStatus)
			})
		})

		r.Post("/api/v1/transactions/categorise", importExportHandler.Categorise)
		r.Post("/api/v1/import", importExportHandler.Import)
		r.Get("/api/v1/export", importExportHandler.Export)

		r.Handle("/api/v1/mcp/sse", sseServer.SSEHandler())
		r.Handle("/api/v1/mcp/message", sseServer.MessageHandler())
		r.Handle("/api/v1/mcp/stream", streamableServer)
	})

		// Legacy URL: redirect to the new SolidJS MCP page
		r.Get("/mcp-connect", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/mcp", http.StatusMovedPermanently)
		})

		// Backwards-compatibility redirects for old import/export paths.
		r.Handle("/api/import", http.RedirectHandler("/api/v1/import", http.StatusMovedPermanently))
		r.Handle("/api/export", http.RedirectHandler("/api/v1/export", http.StatusMovedPermanently))

		// SPA catch-all: serve SolidJS frontend
		r.Handle("/*", spaHandler(embedassets.StaticFS(), "frontend/dist"))

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	recalcCtx, recalcCancel := context.WithCancel(context.Background())
	defer recalcCancel()
	go startRecalcCron(recalcCtx, recalcSvc)

	recurringEngine := recurring.NewEngine(pool)
	recurringEngine.Start(recalcCtx)

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("shutting down...")
		llmQueue.Shutdown()
		recalcCancel()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("server starting on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	log.Println("server stopped")
}

// startRecalcCron runs the per-user recalculation once on boot, then every 24h
// after that. It bails out cleanly when ctx is cancelled.
func startRecalcCron(ctx context.Context, svc *recalc.Service) {
	time.Sleep(30 * time.Second)
	if err := svc.RecalculateAll(ctx); err != nil {
		log.Printf("initial recalc failed: %v", err)
	}
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := svc.RecalculateAll(ctx); err != nil {
				log.Printf("scheduled recalc failed: %v", err)
			}
		}
	}
}
