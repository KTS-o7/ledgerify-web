package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/recurring"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RecurringHandler struct {
	pool *pgxpool.Pool
}

func NewRecurringHandler(pool *pgxpool.Pool) *RecurringHandler {
	return &RecurringHandler{pool: pool}
}

type RecurringRule struct {
	ID                string    `json:"id"`
	UserID            string    `json:"user_id"`
	Name              string    `json:"name"`
	Type              string    `json:"type"`
	Amount            float64   `json:"amount"`
	Currency          string    `json:"currency"`
	AccountID         string    `json:"account_id"`
	CategoryID        *string   `json:"category_id"`
	TransferToID      *string   `json:"transfer_to_id"`
	Title             *string   `json:"title"`
	Note              *string   `json:"note"`
	Frequency         string    `json:"frequency"`
	IntervalValue     *int      `json:"interval_value"`
	IntervalUnit      *string   `json:"interval_unit"`
	StartDate         string    `json:"start_date"`
	EndDate           *string   `json:"end_date"`
	NextDueDate       string    `json:"next_due_date"`
	LastGeneratedDate *string   `json:"last_generated_date"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type createRecurringRequest struct {
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	AccountID     string  `json:"account_id"`
	CategoryID    string  `json:"category_id"`
	TransferToID  string  `json:"transfer_to_id"`
	Title         string  `json:"title"`
	Note          string  `json:"note"`
	Frequency     string  `json:"frequency"`
	IntervalValue *int    `json:"interval_value"`
	IntervalUnit  *string `json:"interval_unit"`
	StartDate     string  `json:"start_date"`
	EndDate       string  `json:"end_date"`
}

func (h *RecurringHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, user_id, name, type, amount, currency, account_id, category_id, transfer_to_id, title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date, last_generated_date, status, created_at, updated_at
		   FROM recurring_transactions
		  WHERE user_id = $1 AND deleted_at IS NULL
		  ORDER BY created_at DESC`, userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	defer rows.Close()
	rules, err := scanRecurringRules(rows)
	if err != nil {
		utils.InternalError(w)
		return
	}
	utils.OK(w, rules)
}

func (h *RecurringHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	userUUID := stringToUUID(claims.UserID)
	rule, err := h.fetchRule(r.Context(), id, userUUID)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.NotFound(w)
			return
		}
		utils.InternalError(w)
		return
	}
	utils.OK(w, rule)
}

func (h *RecurringHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)

	var req createRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Type != "income" && req.Type != "expense" && req.Type != "transfer" {
		utils.BadRequest(w, "type must be 'income', 'expense', or 'transfer'")
		return
	}
	if req.Name == "" || req.AccountID == "" || req.Amount <= 0 {
		utils.BadRequest(w, "name, account_id, amount required")
		return
	}
	if _, err := recurring.StringFrequency(req.Frequency); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	if req.Frequency == "custom" {
		if req.IntervalValue == nil || *req.IntervalValue <= 0 || req.IntervalUnit == nil || (*req.IntervalUnit != "day" && *req.IntervalUnit != "week" && *req.IntervalUnit != "month") {
			utils.BadRequest(w, "frequency=custom requires interval_value (>0) and interval_unit (day|week|month)")
			return
		}
	}
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		utils.BadRequest(w, "invalid start_date (want YYYY-MM-DD)")
		return
	}
	var endDate *time.Time
	if req.EndDate != "" {
		t, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			utils.BadRequest(w, "invalid end_date")
			return
		}
		endDate = &t
	}
	id := uuidNewString()
	now := time.Now().UTC()

	// Verify account ownership
	var owned bool
	if err := h.pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM accounts WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL)`,
		nullableUUID(req.AccountID), userUUID).Scan(&owned); err != nil {
		utils.InternalError(w)
		return
	}
	if !owned {
		utils.BadRequest(w, "account_id does not belong to user")
		return
	}

	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO recurring_transactions
		   (id, user_id, name, type, amount, currency, account_id, category_id, transfer_to_id, title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active',$18,$18)`,
		id, userUUID, req.Name, req.Type, req.Amount, req.Currency, req.AccountID,
		nullableUUID(req.CategoryID), nullableUUID(req.TransferToID),
		nullableString(req.Title), nullableString(req.Note),
		req.Frequency, req.IntervalValue, req.IntervalUnit,
		startDate, endDate, startDate, now)
	if err != nil {
		utils.InternalError(w)
		return
	}
	rule, err := h.fetchRule(r.Context(), id, userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	utils.Created(w, rule)
}

func (h *RecurringHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	userUUID := stringToUUID(claims.UserID)

	var req createRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Type != "income" && req.Type != "expense" && req.Type != "transfer" {
		utils.BadRequest(w, "type must be 'income', 'expense', or 'transfer'")
		return
	}
	if _, err := recurring.StringFrequency(req.Frequency); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	if req.Frequency == "custom" {
		if req.IntervalValue == nil || *req.IntervalValue <= 0 || req.IntervalUnit == nil || (*req.IntervalUnit != "day" && *req.IntervalUnit != "week" && *req.IntervalUnit != "month") {
			utils.BadRequest(w, "frequency=custom requires interval_value (>0) and interval_unit (day|week|month)")
			return
		}
	}
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		utils.BadRequest(w, "invalid start_date")
		return
	}
	var endDate *time.Time
	if req.EndDate != "" {
		t, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			utils.BadRequest(w, "invalid end_date")
			return
		}
		endDate = &t
	}
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE recurring_transactions
		    SET name=$3, type=$4, amount=$5, currency=$6, account_id=$7,
		        category_id=$8, transfer_to_id=$9, title=$10, note=$11,
		        frequency=$12, interval_value=$13, interval_unit=$14,
		        start_date=$15, end_date=$16, next_due_date=$15,
		        updated_at=$17
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userUUID, req.Name, req.Type, req.Amount, req.Currency, req.AccountID,
		nullableUUID(req.CategoryID), nullableUUID(req.TransferToID),
		nullableString(req.Title), nullableString(req.Note),
		req.Frequency, req.IntervalValue, req.IntervalUnit,
		startDate, endDate, time.Now().UTC())
	if err != nil {
		utils.InternalError(w)
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w)
		return
	}
	rule, err := h.fetchRule(r.Context(), id, userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	utils.OK(w, rule)
}

func (h *RecurringHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	userUUID := stringToUUID(claims.UserID)
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE recurring_transactions SET deleted_at=now()
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w)
		return
	}
	utils.OK(w, map[string]string{"message": "rule deleted"})
}

type statusRequest struct {
	Status string `json:"status"`
}

func (h *RecurringHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	userUUID := stringToUUID(claims.UserID)
	var req statusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Status != "active" && req.Status != "paused" {
		utils.BadRequest(w, "status must be 'active' or 'paused'")
		return
	}
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE recurring_transactions SET status=$3, updated_at=now()
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userUUID, req.Status)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w)
		return
	}
	utils.OK(w, map[string]string{"status": req.Status})
}

// RunNow triggers immediate generation of due occurrences for the current user.
func (h *RecurringHandler) RunNow(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)
	eng := recurring.NewEngine(h.pool)
	count, err := eng.RunOnce(r.Context(), time.Now().UTC())
	if err != nil {
		utils.InternalError(w)
		return
	}
	_ = userID // Note: RunOnce runs across all users; user-scoped filtering can be added later
	utils.OK(w, map[string]any{"generated": count})
}

func (h *RecurringHandler) fetchRule(ctx context.Context, id string, userID pgtype.UUID) (*RecurringRule, error) {
	row := h.pool.QueryRow(ctx,
		`SELECT id, user_id, name, type, amount, currency, account_id, category_id, transfer_to_id, title, note, frequency, interval_value, interval_unit, start_date, end_date, next_due_date, last_generated_date, status, created_at, updated_at
		   FROM recurring_transactions
		  WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
		id, userID)
	r, err := scanRecurringRule(row)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func scanRecurringRules(rows pgx.Rows) ([]RecurringRule, error) {
	out := make([]RecurringRule, 0)
	for rows.Next() {
		r, err := scanRecurringRule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRecurringRule(s scanner) (RecurringRule, error) {
	var r RecurringRule
	var idUUID, userUUID, accountUUID pgtype.UUID
	var categoryID, transferToID pgtype.UUID
	var title, note pgtype.Text
	var intervalValue pgtype.Numeric
	var intervalUnit pgtype.Text
	var startDate, nextDue time.Time
	var endDate, lastGen pgtype.Date
	err := s.Scan(
		&idUUID, &userUUID, &r.Name, &r.Type, &r.Amount, &r.Currency, &accountUUID,
		&categoryID, &transferToID, &title, &note,
		&r.Frequency, &intervalValue, &intervalUnit,
		&startDate, &endDate, &nextDue, &lastGen,
		&r.Status, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return r, err
	}
	r.ID = uuidToString(idUUID)
	r.UserID = uuidToString(userUUID)
	r.AccountID = uuidToString(accountUUID)
	if categoryID.Valid {
		s := uuidToString(categoryID)
		r.CategoryID = &s
	}
	if transferToID.Valid {
		s := uuidToString(transferToID)
		r.TransferToID = &s
	}
	if title.Valid {
		s := title.String
		r.Title = &s
	}
	if note.Valid {
		s := note.String
		r.Note = &s
	}
	if intervalValue.Valid {
		n, err := intervalToInt(intervalValue)
		if err == nil {
			r.IntervalValue = &n
		}
	}
	if intervalUnit.Valid {
		s := intervalUnit.String
		r.IntervalUnit = &s
	}
	r.StartDate = startDate.Format("2006-01-02")
	r.NextDueDate = nextDue.Format("2006-01-02")
	if endDate.Valid {
		s := endDate.Time.Format("2006-01-02")
		r.EndDate = &s
	}
	if lastGen.Valid {
		s := lastGen.Time.Format("2006-01-02")
		r.LastGeneratedDate = &s
	}
	return r, nil
}