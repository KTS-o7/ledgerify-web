package templates

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/jackc/pgx/v5/pgtype"
)

// InvestmentRow holds display data.
type InvestmentRow struct {
	ID              string
	Name            string
	AssetType       string
	Quantity        float64
	BuyPrice        float64
	CurrentPrice    float64
	CurrentValue    float64
	Currency        string
	GainLossPct     float64
	MaturityDate    string
	InterestRate    float64
}

// LoanRow holds display data.
type LoanRow struct {
	ID                 string
	Name               string
	LoanType           string
	Principal          float64
	InterestRate       float64
	TenureMonths       int32
	EMI                float64
	OutstandingBalance float64
	StartDate          string
	Currency           string
}

// InsuranceRow holds display data.
type InsuranceRow struct {
	ID               string
	Name             string
	Provider         string
	PolicyType       string
	PremiumAmount    float64
	PremiumFrequency string
	CoverageAmount   float64
	Currency         string
	StartDate        string
	EndDate          string
}

// InvestmentsPage renders the investments list.
func (ph *PageHandlers) InvestmentsPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Investments")
	inv, err := ph.q.ListInvestmentsByUser(r.Context(), parseUUID(claims.UserID))
	if err != nil {
		SetFlash(w, "error", "Failed to load investments")
		RenderPage(w, "investments", data)
		return
	}

	rows := make([]InvestmentRow, 0, len(inv))
	for _, i := range inv {
		qty, _ := i.Quantity.Float64Value()
		bp, _ := i.BuyPrice.Float64Value()
		cp, _ := i.CurrentPrice.Float64Value()
		ir, _ := i.InterestRate.Float64Value()

		qtyVal := 0.0
		bpVal := 0.0
		cpVal := 0.0
		irVal := 0.0
		if qty.Valid { qtyVal = qty.Float64 }
		if bp.Valid { bpVal = bp.Float64 }
		if cp.Valid { cpVal = cp.Float64 }
		if ir.Valid { irVal = ir.Float64 }

		currentVal := qtyVal * cpVal
		gainPct := 0.0
		if bpVal > 0 {
			gainPct = ((cpVal - bpVal) / bpVal) * 100
		}

		matDate := ""
		if i.MaturityDate.Valid {
			matDate = i.MaturityDate.Time.Format("2006-01-02")
		}

		rows = append(rows, InvestmentRow{
			ID:           pgUUIDToString(i.ID),
			Name:         i.Name,
			AssetType:    string(i.AssetType),
			Quantity:     qtyVal,
			BuyPrice:     bpVal,
			CurrentPrice: cpVal,
			CurrentValue: currentVal,
			Currency:     i.Currency,
			GainLossPct:  gainPct,
			MaturityDate: matDate,
			InterestRate: irVal,
		})
	}
	data.Data = rows
	RenderPage(w, "investments", data)
}

// CreateInvestment handles investment creation.
func (ph *PageHandlers) CreateInvestment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/investments", http.StatusSeeOther)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	assetType := strings.TrimSpace(r.FormValue("asset_type"))
	currency := strings.TrimSpace(r.FormValue("currency"))
	qtyStr := r.FormValue("quantity")
	bpStr := r.FormValue("buy_price")
	cpStr := r.FormValue("current_price")
	irStr := r.FormValue("interest_rate")
	matDate := r.FormValue("maturity_date")

	if name == "" || assetType == "" {
		SetFlash(w, "error", "Name and asset type are required")
		http.Redirect(w, r, "/investments", http.StatusSeeOther)
		return
	}
	if currency == "" { currency = "USD" }

	userUUID := parseUUID(claims.UserID)
	qty, _ := strconv.ParseFloat(qtyStr, 64)
	bp, _ := strconv.ParseFloat(bpStr, 64)
	cp, _ := strconv.ParseFloat(cpStr, 64)
	ir, _ := strconv.ParseFloat(irStr, 64)

	var pgQty, pgBp, pgCp, pgIr pgtype.Numeric
	_ = pgQty.Scan(fmt.Sprint(qty))
	_ = pgBp.Scan(fmt.Sprint(bp))
	if cpStr != "" {
		_ = pgCp.Scan(fmt.Sprint(cp))
		pgCp.Valid = true
	}
	if irStr != "" {
		_ = pgIr.Scan(fmt.Sprint(ir))
		pgIr.Valid = true
	}
	pgQty.Valid = qtyStr != ""
	pgBp.Valid = bpStr != ""

	var pgMat pgtype.Date
	if matDate != "" {
		if t, err := time.Parse("2006-01-02", matDate); err == nil {
			pgMat = pgtype.Date{Time: t, Valid: true}
		}
	}

	_, err := ph.q.CreateInvestment(r.Context(), db.CreateInvestmentParams{
		UserID:       userUUID,
		Name:         name,
		AssetType:    db.AssetType(assetType),
		Currency:     currency,
		Quantity:     pgQty,
		BuyPrice:     pgBp,
		CurrentPrice: pgCp,
		InterestRate: pgIr,
		MaturityDate: pgMat,
	})
	if err != nil {
		SetFlash(w, "error", fmt.Sprintf("Failed to create: %v", err))
	} else {
		SetFlash(w, "success", "Investment created")
	}
	http.Redirect(w, r, "/investments", http.StatusSeeOther)
}

// LoansPage renders the loans list.
func (ph *PageHandlers) LoansPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Loans")
	loans, err := ph.q.ListLoansByUser(r.Context(), parseUUID(claims.UserID))
	if err != nil {
		SetFlash(w, "error", "Failed to load loans")
		RenderPage(w, "loans", data)
		return
	}

	rows := make([]LoanRow, 0, len(loans))
	for _, l := range loans {
		pr, _ := l.Principal.Float64Value()
		ir, _ := l.InterestRate.Float64Value()
		emi, _ := l.EmiAmount.Float64Value()
		ob, _ := l.OutstandingBalance.Float64Value()

		prVal := 0.0
		irVal := 0.0
		emiVal := 0.0
		obVal := 0.0
		if pr.Valid { prVal = pr.Float64 }
		if ir.Valid { irVal = ir.Float64 }
		if emi.Valid { emiVal = emi.Float64 }
		if ob.Valid { obVal = ob.Float64 }

		sd := ""
		if l.StartDate.Valid {
			sd = l.StartDate.Time.Format("2006-01-02")
		}

		rows = append(rows, LoanRow{
			ID:                 pgUUIDToString(l.ID),
			Name:               l.Name,
			LoanType:           string(l.LoanType),
			Principal:          prVal,
			InterestRate:       irVal,
			TenureMonths:       l.TenureMonths,
			EMI:                emiVal,
			OutstandingBalance: obVal,
			StartDate:          sd,
			Currency:           l.Currency,
		})
	}
	data.Data = rows
	RenderPage(w, "loans", data)
}

// CreateLoan handles loan creation.
func (ph *PageHandlers) CreateLoan(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/loans", http.StatusSeeOther)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	loanType := strings.TrimSpace(r.FormValue("loan_type"))
	currency := strings.TrimSpace(r.FormValue("currency"))
	principalStr := r.FormValue("principal")
	irStr := r.FormValue("interest_rate")
	tenureStr := r.FormValue("tenure_months")
	emiStr := r.FormValue("emi_amount")
	outBalStr := r.FormValue("outstanding_balance")
	startDate := r.FormValue("start_date")

	if name == "" || loanType == "" {
		SetFlash(w, "error", "Name and type are required")
		http.Redirect(w, r, "/loans", http.StatusSeeOther)
		return
	}
	if currency == "" { currency = "USD" }

	userUUID := parseUUID(claims.UserID)
	pr, _ := strconv.ParseFloat(principalStr, 64)
	ir, _ := strconv.ParseFloat(irStr, 64)
	tenure, _ := strconv.Atoi(tenureStr)
	emi, _ := strconv.ParseFloat(emiStr, 64)
	ob, _ := strconv.ParseFloat(outBalStr, 64)

	var pgPr, pgIr, pgEmi, pgOb pgtype.Numeric
	_ = pgPr.Scan(fmt.Sprint(pr))
	_ = pgIr.Scan(fmt.Sprint(ir))
	_ = pgEmi.Scan(fmt.Sprint(emi))
	_ = pgOb.Scan(fmt.Sprint(ob))
	pgPr.Valid = principalStr != ""
	pgIr.Valid = irStr != ""
	pgEmi.Valid = emiStr != ""
	pgOb.Valid = outBalStr != ""

	var pgSd pgtype.Date
	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			pgSd = pgtype.Date{Time: t, Valid: true}
		}
	}

	_, err := ph.q.CreateLoan(r.Context(), db.CreateLoanParams{
		UserID:             userUUID,
		Name:               name,
		LoanType:           db.LoanType(loanType),
		Principal:          pgPr,
		InterestRate:       pgIr,
		TenureMonths:       int32(tenure),
		EmiAmount:          pgEmi,
		Currency:           currency,
		OutstandingBalance: pgOb,
		StartDate:          pgSd,
	})
	if err != nil {
		SetFlash(w, "error", fmt.Sprintf("Failed to create: %v", err))
	} else {
		SetFlash(w, "success", "Loan created")
	}
	http.Redirect(w, r, "/loans", http.StatusSeeOther)
}

// InsurancePage renders the insurance policies list.
func (ph *PageHandlers) InsurancePage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	data := NewPageData(r, "Insurance")
	policies, err := ph.q.ListInsurancePoliciesByUser(r.Context(), parseUUID(claims.UserID))
	if err != nil {
		SetFlash(w, "error", "Failed to load insurance")
		RenderPage(w, "insurance", data)
		return
	}

	rows := make([]InsuranceRow, 0, len(policies))
	for _, p := range policies {
		prem, _ := p.PremiumAmount.Float64Value()
		cov, _ := p.CoverageAmount.Float64Value()

		premVal := 0.0
		covVal := 0.0
		if prem.Valid { premVal = prem.Float64 }
		if cov.Valid { covVal = cov.Float64 }

		provider := ""
		if p.Provider.Valid { provider = p.Provider.String }

		sd := ""
		if p.StartDate.Valid { sd = p.StartDate.Time.Format("2006-01-02") }
		ed := ""
		if p.EndDate.Valid { ed = p.EndDate.Time.Format("2006-01-02") }

		rows = append(rows, InsuranceRow{
			ID:               pgUUIDToString(p.ID),
			Name:             p.Name,
			Provider:         provider,
			PolicyType:       string(p.PolicyType),
			PremiumAmount:    premVal,
			PremiumFrequency: string(p.PremiumFrequency),
			CoverageAmount:   covVal,
			Currency:         p.Currency,
			StartDate:        sd,
			EndDate:          ed,
		})
	}
	data.Data = rows
	RenderPage(w, "insurance", data)
}

// CreateInsurance handles insurance policy creation.
func (ph *PageHandlers) CreateInsurance(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		SetFlash(w, "error", "Invalid form data")
		http.Redirect(w, r, "/insurance", http.StatusSeeOther)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	provider := strings.TrimSpace(r.FormValue("provider"))
	policyType := strings.TrimSpace(r.FormValue("policy_type"))
	currency := strings.TrimSpace(r.FormValue("currency"))
	frequency := strings.TrimSpace(r.FormValue("premium_frequency"))
	premiumStr := r.FormValue("premium_amount")
	coverageStr := r.FormValue("coverage_amount")
	startDate := r.FormValue("start_date")

	if name == "" || policyType == "" {
		SetFlash(w, "error", "Name and policy type are required")
		http.Redirect(w, r, "/insurance", http.StatusSeeOther)
		return
	}
	if currency == "" { currency = "USD" }
	if frequency == "" { frequency = "yearly" }

	userUUID := parseUUID(claims.UserID)
	prem, _ := strconv.ParseFloat(premiumStr, 64)
	cov, _ := strconv.ParseFloat(coverageStr, 64)

	var pgPrem, pgCov pgtype.Numeric
	_ = pgPrem.Scan(fmt.Sprint(prem))
	_ = pgCov.Scan(fmt.Sprint(cov))
	pgPrem.Valid = premiumStr != ""
	pgCov.Valid = coverageStr != ""

	var pgProv pgtype.Text
	if provider != "" {
		pgProv = pgtype.Text{String: provider, Valid: true}
	}

	var pgSd, pgEd pgtype.Date
	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			pgSd = pgtype.Date{Time: t, Valid: true}
		}
	}

	_, err := ph.q.CreateInsurancePolicy(r.Context(), db.CreateInsurancePolicyParams{
		UserID:           userUUID,
		Name:             name,
		Provider:         pgProv,
		PolicyType:       db.PolicyType(policyType),
		PremiumAmount:    pgPrem,
		PremiumFrequency: db.PremiumFrequency(frequency),
		CoverageAmount:   pgCov,
		Currency:         currency,
		StartDate:        pgSd,
		EndDate:          pgEd,
	})
	if err != nil {
		SetFlash(w, "error", fmt.Sprintf("Failed to create: %v", err))
	} else {
		SetFlash(w, "success", "Insurance policy created")
	}
	http.Redirect(w, r, "/insurance", http.StatusSeeOther)
}
