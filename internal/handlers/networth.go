package handlers

import (
	"net/http"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
)

type NetWorthHandler struct {
	q  *db.Queries
	cq *db.CustomQueries
}

func NewNetWorthHandler(q *db.Queries, cq *db.CustomQueries) *NetWorthHandler {
	return &NetWorthHandler{q: q, cq: cq}
}

// GET /api/v1/networth
//
// Returns the user's current net worth as {total_assets, total_liabilities,
// networth} in the user's default currency. The frontend NetWorth page
// (frontend/src/pages/NetWorth.tsx) reads these three fields directly.
//
// Computed from:
//   - assets:    sum of account balances (from ListAccountsWithBalance,
//                one query) + investment market values
//   - liabilities: sum of loan outstanding balances
//
// For FX-aware aggregation with a per-currency breakdown, use the MCP
// get_networth tool instead.
func (h *NetWorthHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	ctx := r.Context()

	accounts, err := h.cq.ListAccountsWithBalance(ctx, claims.UserID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "list accounts: "+err.Error())
		return
	}

	investments, err := h.q.ListInvestmentsByUser(ctx, userUUID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "list investments: "+err.Error())
		return
	}

	loans, err := h.q.ListLoansByUser(ctx, userUUID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "list loans: "+err.Error())
		return
	}

	var totalAssets, totalLiabilities float64

	for _, a := range accounts {
		totalAssets += a.Balance
	}

	for _, inv := range investments {
		if inv.CurrentPrice.Valid && inv.Quantity.Valid {
			qty, _ := inv.Quantity.Float64Value()
			price, _ := inv.CurrentPrice.Float64Value()
			if qty.Valid && price.Valid {
				totalAssets += qty.Float64 * price.Float64
			}
		}
	}

	for _, l := range loans {
		if l.OutstandingBalance.Valid {
			bal, _ := l.OutstandingBalance.Float64Value()
			if bal.Valid {
				totalLiabilities += bal.Float64
			}
		}
	}

	utils.OK(w, utils.NetworthResult{
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		Networth:         totalAssets - totalLiabilities,
	})
}
