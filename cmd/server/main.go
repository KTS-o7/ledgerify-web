package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	embedassets "github.com/KTS-o7/ledgerify-web"
	"github.com/KTS-o7/ledgerify-web/internal/auth"
	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/handlers"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/templates"
)

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
	transactionHandler := handlers.NewTransactionHandler(q, pool)
	budgetHandler := handlers.NewBudgetHandler(pool, q)
	summaryHandler := handlers.NewSummaryHandler(pool, q, cq)
	investmentHandler := handlers.NewInvestmentHandler(q)
	loanHandler := handlers.NewLoanHandler(q)
	insuranceHandler := handlers.NewInsuranceHandler(q)
	savingsHandler := handlers.NewSavingsGoalHandler(q)
	importExportHandler := handlers.NewImportExportHandler(pool, q)
	rateHandler := handlers.NewExchangeRateHandler(q)

	// Initialize templates with embedded assets
	templates.Init(embedassets.TemplateFS(), embedassets.StaticFS(), false)

	// Page handlers
	ph := templates.NewPageHandlers(pool, q, cq, jwtCfg)

	r := chi.NewRouter()
	r.Use(corsHandler)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(chimw.RequestID)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(middleware.BodyLimit(1 << 20)) // 1MB

	// Static files (embedded)
	r.Get("/static/*", templates.ServeStatic)

	// Health
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// === PAGE ROUTES ===
	// Auth pages (no auth required)
	r.Group(func(r chi.Router) {
		r.Get("/login", ph.LoginPage)
		r.Post("/login", ph.LoginAction)
		r.Get("/register", ph.RegisterPage)
		r.Post("/register", ph.RegisterAction)
	})

	// Protected page routes
	r.Group(func(r chi.Router) {
		r.Use(templates.PageAuthMiddleware(jwtCfg))

		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		})
		r.Get("/dashboard", ph.DashboardPage)
		r.Get("/transactions", ph.TransactionsPage)
		r.Post("/transactions", ph.CreateTransaction)
		r.Post("/transactions/delete", ph.DeleteTransaction)
		r.Get("/accounts", ph.AccountsPage)
		r.Post("/accounts", ph.CreateAccount)
		r.Get("/accounts/{id}", ph.Placeholder("Account Detail"))
		r.Get("/budgets", ph.BudgetsPage)
		r.Post("/budgets", ph.CreateBudget)
		r.Get("/budgets/{id}", ph.Placeholder("Budget Detail"))
		r.Get("/budgets/goals", ph.Placeholder("Savings Goals"))
		r.Get("/investments", ph.InvestmentsPage)
		r.Post("/investments", ph.CreateInvestment)
		r.Get("/loans", ph.LoansPage)
		r.Post("/loans", ph.CreateLoan)
		r.Get("/insurance", ph.InsurancePage)
		r.Post("/insurance", ph.CreateInsurance)
		r.Get("/networth", ph.Placeholder("Net Worth"))
		r.Get("/reports", ph.Placeholder("Reports"))
		r.Get("/reports/cash-flow", ph.Placeholder("Cash Flow"))
		r.Get("/reports/category-breakdown", ph.Placeholder("Category Breakdown"))
		r.Get("/reports/budget-vs-actual", ph.Placeholder("Budget vs Actual"))
		r.Get("/reports/investment-returns", ph.Placeholder("Investment Returns"))
		r.Get("/reports/debt-payoff", ph.Placeholder("Debt Payoff"))
		r.Get("/import", ph.Placeholder("Import"))
		r.Get("/settings", ph.Placeholder("Settings"))
		r.Get("/settings/categories", ph.Placeholder("Categories"))
		r.Get("/settings/data", ph.Placeholder("Data"))
		r.Get("/logout", ph.LogoutAction)
	})

	// === API ROUTES ===
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)

		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(jwtCfg))
			r.Post("/logout", authHandler.Logout)
			r.Get("/me", authHandler.Me)
			r.Put("/me", authHandler.UpdateProfile)
		})
	})

	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(jwtCfg))

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

		r.Post("/api/v1/transactions/categorise", importExportHandler.Categorise)
		r.Post("/api/import", importExportHandler.Import)
		r.Get("/api/export", importExportHandler.Export)
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("shutting down...")
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
