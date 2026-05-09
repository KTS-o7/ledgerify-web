package handlers

import (
	"encoding/json"
	"math"
	"net/http"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AccountHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
	cq   *db.CustomQueries
}

func NewAccountHandler(pool *pgxpool.Pool, q *db.Queries, cq *db.CustomQueries) *AccountHandler {
	return &AccountHandler{pool: pool, q: q, cq: cq}
}

type createAccountRequest struct {
	Name           string   `json:"name"`
	Type           string   `json:"type"`
	Currency       string   `json:"currency"`
	OpeningBalance *float64 `json:"opening_balance"`
	CreditLimit    *float64 `json:"credit_limit"`
	StatementDay   *float64 `json:"statement_day"`
	PaymentDueDay  *float64 `json:"payment_due_day"`
}

type updateAccountRequest struct {
	Name           string   `json:"name"`
	Type           string   `json:"type"`
	Currency       string   `json:"currency"`
	OpeningBalance *float64 `json:"opening_balance"`
	CreditLimit    *float64 `json:"credit_limit"`
	StatementDay   *float64 `json:"statement_day"`
	PaymentDueDay  *float64 `json:"payment_due_day"`
}

func floatToNumeric(v *float64) pgtype.Numeric {
	var n pgtype.Numeric
	if v != nil {
		_ = n.Scan(*v)
		n.Valid = true
	}
	return n
}

// GET /api/v1/accounts
func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	accounts, err := h.cq.ListAccountsWithBalance(r.Context(), claims.UserID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if accounts == nil {
		accounts = []db.UserAccountBalance{}
	}

	utils.OK(w, accounts)
}

// POST /api/v1/accounts
func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	var req createAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Type == "" || req.Currency == "" {
		utils.BadRequest(w, "name, type, and currency are required")
		return
	}

	// Validate account type
	validTypes := map[string]db.AccountType{
		"bank":         db.AccountTypeBank,
		"wallet":       db.AccountTypeWallet,
		"cash":         db.AccountTypeCash,
		"savings":      db.AccountTypeSavings,
		"credit_card":  db.AccountTypeCreditCard,
		"investment":   db.AccountTypeInvestment,
	}
	acctType, ok := validTypes[req.Type]
	if !ok {
		utils.BadRequest(w, "invalid account type. Must be one of: bank, wallet, cash, savings, credit_card, investment")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	account, err := h.q.CreateAccount(r.Context(), db.CreateAccountParams{
		UserID:         userUUID,
		Name:           req.Name,
		Type:           acctType,
		Currency:       req.Currency,
		OpeningBalance: floatToNumeric(req.OpeningBalance),
		CreditLimit:    floatToNumeric(req.CreditLimit),
		StatementDay:   floatToNumeric(req.StatementDay),
		PaymentDueDay:  floatToNumeric(req.PaymentDueDay),
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, account)
}

// GET /api/v1/accounts/{id}
func (h *AccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	accountID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	account, err := h.q.GetAccountByID(r.Context(), accountID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	if account.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	// Compute balance
	balance, err := h.cq.GetAccountBalanceForUser(r.Context(), accountID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	response := map[string]interface{}{
		"id":              uuidToString(account.ID),
		"user_id":         uuidToString(account.UserID),
		"name":            account.Name,
		"type":            account.Type,
		"currency":        account.Currency,
		"opening_balance": numericToFloat(account.OpeningBalance),
		"balance":         math.Round(balance*100) / 100,
		"credit_limit":    numericToFloat(account.CreditLimit),
		"statement_day":   numericToFloat(account.StatementDay),
		"payment_due_day": numericToFloat(account.PaymentDueDay),
		"created_at":      account.CreatedAt,
		"updated_at":      account.UpdatedAt,
	}

	utils.OK(w, response)
}

// PUT /api/v1/accounts/{id}
func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	accountID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	var req updateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Type == "" || req.Currency == "" {
		utils.BadRequest(w, "name, type, and currency are required")
		return
	}

	// Validate account type
	validTypes := map[string]db.AccountType{
		"bank":        db.AccountTypeBank,
		"wallet":      db.AccountTypeWallet,
		"cash":        db.AccountTypeCash,
		"savings":     db.AccountTypeSavings,
		"credit_card": db.AccountTypeCreditCard,
		"investment":  db.AccountTypeInvestment,
	}
	acctType, ok := validTypes[req.Type]
	if !ok {
		utils.BadRequest(w, "invalid account type")
		return
	}

	account, err := h.q.UpdateAccount(r.Context(), db.UpdateAccountParams{
		ID:             accountID,
		Name:           req.Name,
		Type:           acctType,
		Currency:       req.Currency,
		OpeningBalance: floatToNumeric(req.OpeningBalance),
		CreditLimit:    floatToNumeric(req.CreditLimit),
		StatementDay:   floatToNumeric(req.StatementDay),
		PaymentDueDay:  floatToNumeric(req.PaymentDueDay),
		UserID:         userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, account)
}

// DELETE /api/v1/accounts/{id}
func (h *AccountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.BadRequest(w, "unauthorized")
		return
	}

	accountID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteAccount(r.Context(), db.DeleteAccountParams{
		ID:     accountID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "account deleted"})
}

// numericToFloat extracts a float64 from pgtype.Numeric.
func numericToFloat(n pgtype.Numeric) *float64 {
	if !n.Valid {
		return nil
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	return &f.Float64
}
