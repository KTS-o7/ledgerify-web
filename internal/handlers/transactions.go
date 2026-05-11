package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TransactionHandler struct {
	q    *db.Queries
	pool *pgxpool.Pool
}

func NewTransactionHandler(q *db.Queries, pool *pgxpool.Pool) *TransactionHandler {
	return &TransactionHandler{q: q, pool: pool}
}

type createTransactionRequest struct {
	AccountID       string   `json:"account_id"`
	Type            string   `json:"type"`
	Amount          float64  `json:"amount"`
	Currency        string   `json:"currency"`
	ConvertedAmount *float64 `json:"converted_amount"`
	BaseCurrency    string   `json:"base_currency"`
	CategoryID      string   `json:"category_id"`
	Title           string   `json:"title"`
	Note            string   `json:"note"`
	Date            string   `json:"date"`
	Tags            []string `json:"tags"`
}

type updateTransactionRequest struct {
	AccountID       string   `json:"account_id"`
	Type            string   `json:"type"`
	Amount          float64  `json:"amount"`
	Currency        string   `json:"currency"`
	ConvertedAmount *float64 `json:"converted_amount"`
	BaseCurrency    string   `json:"base_currency"`
	CategoryID      string   `json:"category_id"`
	Title           string   `json:"title"`
	Note            string   `json:"note"`
	Date            string   `json:"date"`
	IsRecurring     *bool    `json:"is_recurring"`
	Tags            []string `json:"tags"`
}

// GET /api/v1/transactions
func (h *TransactionHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)

	// Parse query params
	q := r.URL.Query()

	// Type filter
	var typeFilter pgtype.Text
	if t := q.Get("type"); t != "" {
		typeFilter = pgtype.Text{String: t, Valid: true}
	}

	// Account filter
	var accountFilter pgtype.UUID
	if a := q.Get("account_id"); a != "" {
		accountFilter = stringToUUID(a)
	}

	// Date range filters
	var fromDate pgtype.Date
	if fd := q.Get("from_date"); fd != "" {
		t, err := time.Parse("2006-01-02", fd)
		if err == nil {
			fromDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	var toDate pgtype.Date
	if td := q.Get("to_date"); td != "" {
		t, err := time.Parse("2006-01-02", td)
		if err == nil {
			toDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	// Limit
	limit := int32(50)
	if l := q.Get("limit"); l != "" {
		if parsed, err := strconv.ParseInt(l, 10, 32); err == nil && parsed > 0 {
			limit = int32(parsed)
		}
	}
	limitRows := pgtype.Int4{Int32: limit, Valid: true}

	transactions, err := h.q.ListTransactionsByUser(r.Context(), db.ListTransactionsByUserParams{
		UserID:    userUUID,
		Type:      typeFilter,
		AccountID: accountFilter,
		FromDate:  fromDate,
		ToDate:    toDate,
		LimitRows: limitRows,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}
	if transactions == nil {
		transactions = []db.ListTransactionsByUserRow{}
	}

	utils.OK(w, transactions)
}

// POST /api/v1/transactions
func (h *TransactionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	// POST Create
	if req.AccountID == "" || req.Type == "" || req.Currency == "" || req.Date == "" {
		utils.BadRequest(w, "account_id, type, currency, and date are required")
		return
	}
	if req.Amount <= 0 {
		utils.BadRequest(w, "amount must be greater than zero")
		return
	}

	userUUID := stringToUUID(claims.UserID)
	accountUUID := stringToUUID(req.AccountID)

	// Parse transaction type
	var txType db.TransactionType
	txType, err := ParseTransactionType(req.Type)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	// Parse date
	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		utils.BadRequest(w, "invalid date format, use YYYY-MM-DD")
		return
	}

	// Parse amount
	var amount pgtype.Numeric
	if err := amount.Scan(strconv.FormatFloat(req.Amount, 'f', -1, 64)); err != nil {
		utils.BadRequest(w, "invalid amount")
		return
	}
	amount.Valid = true

	// Parse optional converted amount
	var convertedAmount pgtype.Numeric
	if req.ConvertedAmount != nil {
		if err := convertedAmount.Scan(fmt.Sprint(*req.ConvertedAmount)); err != nil {
			utils.BadRequest(w, "invalid converted_amount")
			return
		}
		convertedAmount.Valid = true
	}

	// Parse optional base currency
	var baseCurrency pgtype.Text
	if req.BaseCurrency != "" {
		baseCurrency = pgtype.Text{String: req.BaseCurrency, Valid: true}
	}

	// Parse optional category
	var categoryID pgtype.UUID
	if req.CategoryID != "" {
		categoryID = stringToUUID(req.CategoryID)
	}

	transaction, err := h.q.CreateTransaction(r.Context(), db.CreateTransactionParams{
		UserID:          userUUID,
		AccountID:       accountUUID,
		Type:            txType,
		Amount:          amount,
		Currency:        req.Currency,
		ConvertedAmount: convertedAmount,
		BaseCurrency:    baseCurrency,
		CategoryID:      categoryID,
		Title:           pgtype.Text{String: req.Title, Valid: req.Title != ""},
		Note:            pgtype.Text{String: req.Note, Valid: req.Note != ""},
		Date:            pgtype.Date{Time: parsedDate, Valid: true},
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	// Insert tags if provided
	if len(req.Tags) > 0 {
		if err := h.setTransactionTags(r.Context(), transaction.ID, req.Tags); err != nil {
			utils.InternalError(w)
			return
		}
	}

	utils.Created(w, transaction)
}

// GET /api/v1/transactions/{id}
func (h *TransactionHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	transactionID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	tx, err := h.q.GetTransactionByID(r.Context(), transactionID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	if tx.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	// Fetch tags
	tags, err := h.q.GetTransactionTags(r.Context(), transactionID)
	if err != nil {
		tags = []db.Tag{}
	}

	response := map[string]interface{}{
		"id":               uuidToString(tx.ID),
		"user_id":          uuidToString(tx.UserID),
		"account_id":       uuidToString(tx.AccountID),
		"account_name":     tx.AccountName,
		"type":             tx.Type,
		"amount":           tx.Amount,
		"currency":         tx.Currency,
		"converted_amount": tx.ConvertedAmount,
		"base_currency":    tx.BaseCurrency,
		"category_id":      uuidOrNil(tx.CategoryID),
		"category_name":    tx.CategoryName,
		"title":            tx.Title,
		"note":             tx.Note,
		"date":             tx.Date,
		"is_recurring":     tx.IsRecurring,
		"created_at":       tx.CreatedAt,
		"updated_at":       tx.UpdatedAt,
		"tags":             tags,
	}

	utils.OK(w, response)
}

// PUT /api/v1/transactions/{id}
func (h *TransactionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	transactionID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	// Verify ownership
	existing, err := h.q.GetTransactionByID(r.Context(), transactionID)
	if err != nil || existing.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req updateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	// PUT Update
	if req.AccountID == "" || req.Type == "" || req.Currency == "" || req.Date == "" {
		utils.BadRequest(w, "account_id, type, currency, and date are required")
		return
	}
	if req.Amount <= 0 {
		utils.BadRequest(w, "amount must be greater than zero")
		return
	}

	accountUUID := stringToUUID(req.AccountID)

	var txType db.TransactionType
	txType, err = ParseTransactionType(req.Type)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		utils.BadRequest(w, "invalid date format, use YYYY-MM-DD")
		return
	}

	var amount pgtype.Numeric
	if err := amount.Scan(strconv.FormatFloat(req.Amount, 'f', -1, 64)); err != nil {
		utils.BadRequest(w, "invalid amount")
		return
	}
	amount.Valid = true

	var convertedAmount pgtype.Numeric
	if req.ConvertedAmount != nil {
		if err := convertedAmount.Scan(fmt.Sprint(*req.ConvertedAmount)); err != nil {
			utils.BadRequest(w, "invalid converted_amount")
			return
		}
		convertedAmount.Valid = true
	}

	var baseCurrency pgtype.Text
	if req.BaseCurrency != "" {
		baseCurrency = pgtype.Text{String: req.BaseCurrency, Valid: true}
	}

	var categoryID pgtype.UUID
	if req.CategoryID != "" {
		categoryID = stringToUUID(req.CategoryID)
	}

	isRecurring := false
	if req.IsRecurring != nil {
		isRecurring = *req.IsRecurring
	}

	transaction, err := h.q.UpdateTransaction(r.Context(), db.UpdateTransactionParams{
		ID:              transactionID,
		AccountID:       accountUUID,
		Type:            txType,
		Amount:          amount,
		Currency:        req.Currency,
		ConvertedAmount: convertedAmount,
		BaseCurrency:    baseCurrency,
		CategoryID:      categoryID,
		Title:           pgtype.Text{String: req.Title, Valid: req.Title != ""},
		Note:            pgtype.Text{String: req.Note, Valid: req.Note != ""},
		Date:            pgtype.Date{Time: parsedDate, Valid: true},
		IsRecurring:     isRecurring,
		UserID:          userUUID,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	// Update tags if provided
	if req.Tags != nil {
		if err := h.setTransactionTags(r.Context(), transaction.ID, req.Tags); err != nil {
			utils.InternalError(w)
			return
		}
	}

	utils.OK(w, transaction)
}

// DELETE /api/v1/transactions/{id}
func (h *TransactionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	transactionID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteTransaction(r.Context(), db.DeleteTransactionParams{
		ID:     transactionID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "transaction deleted"})
}

// setTransactionTags clears existing tags and inserts the given tag IDs within a transaction.
func (h *TransactionHandler) setTransactionTags(ctx context.Context, transactionID pgtype.UUID, tagIDs []string) error {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := h.q.WithTx(tx)

	// Delete existing tags
	if err := qtx.SetTransactionTags(ctx, transactionID); err != nil {
		return err
	}

	// Insert new tags
	for _, tagID := range tagIDs {
		tagUUID := stringToUUID(tagID)
		_, err := tx.Exec(ctx,
			"INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ($1, $2)",
			transactionID, tagUUID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// uuidOrNil returns a string pointer for an optional pgtype.UUID.
func uuidOrNil(id pgtype.UUID) interface{} {
	if !id.Valid {
		return nil
	}
	return uuidToString(id)
}
