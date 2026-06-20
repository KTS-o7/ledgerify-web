package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NetWorthSnapshotHandler handles REST endpoints for networth snapshots.
// It uses direct SQL via pgxpool, consistent with summary.go and other
// pool-based handlers.
type NetWorthSnapshotHandler struct {
	pool *pgxpool.Pool
}

func NewNetWorthSnapshotHandler(pool *pgxpool.Pool) *NetWorthSnapshotHandler {
	return &NetWorthSnapshotHandler{pool: pool}
}

// SnapshotResponse is the shape returned by POST and listed by GET.
type SnapshotResponse struct {
	ID               string  `json:"id"`
	AsOf             string  `json:"as_of"`
	Currency         string  `json:"currency"`
	TotalAssets      float64 `json:"total_assets"`
	TotalLiabilities float64 `json:"total_liabilities"`
	NetWorth         float64 `json:"networth"`
	Note             *string `json:"note"`
}

// POST /api/v1/networth/snapshot
//
// Computes the current net worth (same logic as the REST GET /api/v1/networth)
// and stores it in networth_snapshots.  Returns the created row.
//
// Optional body: {"note": "end of Q3 2025"}
func (h *NetWorthSnapshotHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	ctx := r.Context()

	// Parse optional note from body (ignore body-read errors — note is optional).
	var body struct {
		Note string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	// ── Compute net worth (mirrors NetWorthHandler.Get) ─────────────────────

	// Account balances via the same aggregate used by REST GET /networth
	var totalAssets, totalLiabilities float64

	rowsAcc, err := h.pool.Query(ctx, `
		SELECT COALESCE(a.opening_balance, 0) + COALESCE(SUM(
			CASE WHEN t.type = 'income'  THEN t.amount
			     WHEN t.type = 'expense' THEN -t.amount
			     ELSE 0 END
		), 0)::numeric(18,4) AS balance
		FROM accounts a
		LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
		WHERE a.user_id = $1 AND a.deleted_at IS NULL
		GROUP BY a.id`, userUUID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "query accounts: "+err.Error())
		return
	}
	for rowsAcc.Next() {
		var bal float64
		if err := rowsAcc.Scan(&bal); err == nil {
			totalAssets += bal
		}
	}
	rowsAcc.Close()

	// Investment market values
	rowsInv, err := h.pool.Query(ctx, `
		SELECT COALESCE(quantity::numeric(18,8), 0) * COALESCE(current_price::numeric(18,8), 0)
		FROM investments
		WHERE user_id = $1 AND deleted_at IS NULL
		  AND quantity IS NOT NULL AND current_price IS NOT NULL`, userUUID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "query investments: "+err.Error())
		return
	}
	for rowsInv.Next() {
		var val float64
		if err := rowsInv.Scan(&val); err == nil {
			totalAssets += val
		}
	}
	rowsInv.Close()

	// Loan outstanding balances
	rowsLoan, err := h.pool.Query(ctx, `
		SELECT COALESCE(outstanding_balance::numeric(18,4), 0)
		FROM loans
		WHERE user_id = $1 AND deleted_at IS NULL
		  AND outstanding_balance IS NOT NULL`, userUUID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "query loans: "+err.Error())
		return
	}
	for rowsLoan.Next() {
		var bal float64
		if err := rowsLoan.Scan(&bal); err == nil {
			totalLiabilities += bal
		}
	}
	rowsLoan.Close()

	netWorth := totalAssets - totalLiabilities
	asOf := time.Now().UTC()

	// ── Determine base currency from user profile ────────────────────────────
	var currency string
	_ = h.pool.QueryRow(ctx,
		`SELECT COALESCE(default_currency, 'INR') FROM users WHERE id = $1 AND deleted_at IS NULL`,
		userUUID,
	).Scan(&currency)
	if currency == "" {
		currency = "INR"
	}

	// ── Insert snapshot ──────────────────────────────────────────────────────
	var (
		id   string
		asOf2 time.Time
	)
	var noteArg interface{}
	if body.Note != "" {
		noteArg = body.Note
	}
	err = h.pool.QueryRow(ctx, `
		INSERT INTO networth_snapshots
			(user_id, as_of, currency, total_assets, total_liabilities, net_worth, breakdown, note)
		VALUES ($1, $2::timestamptz, $3, $4, $5, $6, '{}'::jsonb, $7)
		RETURNING id, as_of`,
		userUUID, asOf, currency, totalAssets, totalLiabilities, netWorth, noteArg,
	).Scan(&id, &asOf2)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "insert snapshot: "+err.Error())
		return
	}

	var noteOut *string
	if body.Note != "" {
		n := body.Note
		noteOut = &n
	}

	utils.Created(w, SnapshotResponse{
		ID:               id,
		AsOf:             asOf2.UTC().Format(time.RFC3339),
		Currency:         currency,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		NetWorth:         netWorth,
		Note:             noteOut,
	})
}

// GET /api/v1/networth/snapshots
//
// Returns all snapshots for the authenticated user, newest first.
func (h *NetWorthSnapshotHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	ctx := r.Context()

	rows, err := h.pool.Query(ctx, `
		SELECT id, as_of, currency,
		       total_assets::numeric(18,4),
		       total_liabilities::numeric(18,4),
		       net_worth::numeric(18,4),
		       note
		FROM networth_snapshots
		WHERE user_id = $1
		ORDER BY as_of DESC`, userUUID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "query snapshots: "+err.Error())
		return
	}
	defer rows.Close()

	result := make([]SnapshotResponse, 0)
	for rows.Next() {
		var s SnapshotResponse
		var asOf time.Time
		if err := rows.Scan(&s.ID, &asOf, &s.Currency, &s.TotalAssets, &s.TotalLiabilities, &s.NetWorth, &s.Note); err != nil {
			utils.Error(w, http.StatusInternalServerError, "scan: "+err.Error())
			return
		}
		s.AsOf = asOf.UTC().Format(time.RFC3339)
		result = append(result, s)
	}
	if err := rows.Err(); err != nil {
		utils.Error(w, http.StatusInternalServerError, "rows err: "+err.Error())
		return
	}

	utils.OK(w, result)
}

// DELETE /api/v1/networth/snapshots/{id}
//
// Hard-deletes a snapshot (snapshots are not financial records).
func (h *NetWorthSnapshotHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	snapshotID, ok := parseUUIDParam(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	tag, err := h.pool.Exec(r.Context(),
		`DELETE FROM networth_snapshots WHERE id = $1 AND user_id = $2`,
		snapshotID, userUUID,
	)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "delete: "+err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		utils.NotFound(w)
		return
	}
	utils.OK(w, map[string]string{"status": "deleted"})
}
