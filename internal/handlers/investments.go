package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type InvestmentHandler struct {
	q *db.Queries
}

func NewInvestmentHandler(q *db.Queries) *InvestmentHandler {
	return &InvestmentHandler{q: q}
}

type createInvestmentRequest struct {
	Name        string   `json:"name"`
	AssetType   string   `json:"asset_type"`
	Currency    string   `json:"currency"`
	Quantity    *float64 `json:"quantity"`
	BuyPrice    *float64 `json:"buy_price"`
	CurrentPrice *float64 `json:"current_price"`
	MaturityDate *string `json:"maturity_date"`
	InterestRate *float64 `json:"interest_rate"`
	Metadata    *string  `json:"metadata"`
}

type updateInvestmentRequest struct {
	Name         string   `json:"name"`
	AssetType    string   `json:"asset_type"`
	Currency     string   `json:"currency"`
	Quantity     *float64 `json:"quantity"`
	BuyPrice     *float64 `json:"buy_price"`
	CurrentPrice *float64 `json:"current_price"`
	MaturityDate *string  `json:"maturity_date"`
	InterestRate *float64 `json:"interest_rate"`
	Metadata     *string  `json:"metadata"`
}

type createInvestmentTxRequest struct {
	Type     string   `json:"type"`
	Quantity *float64 `json:"quantity"`
	Price    *float64 `json:"price"`
	Amount   *float64 `json:"amount"`
	Date     string   `json:"date"`
	Note     *string  `json:"note"`
}

// GET /api/v1/investments
func (h *InvestmentHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	investments, err := h.q.ListInvestmentsByUser(r.Context(), userUUID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if investments == nil {
		investments = []db.Investment{}
	}

	utils.OK(w, investments)
}

// POST /api/v1/investments
func (h *InvestmentHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	var req createInvestmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.AssetType == "" || req.Currency == "" {
		utils.BadRequest(w, "name, asset_type, and currency are required")
		return
	}

	var assetType db.AssetType
	switch req.AssetType {
	case "stock":
		assetType = db.AssetTypeStock
	case "mf":
		assetType = db.AssetTypeMf
	case "crypto":
		assetType = db.AssetTypeCrypto
	case "fd":
		assetType = db.AssetTypeFd
	case "ppf":
		assetType = db.AssetTypePpf
	case "nps":
		assetType = db.AssetTypeNps
	case "gold":
		assetType = db.AssetTypeGold
	case "silver":
		assetType = db.AssetTypeSilver
	case "real_estate":
		assetType = db.AssetTypeRealEstate
	case "savings":
		assetType = db.AssetTypeSavings
	case "other":
		assetType = db.AssetTypeOther
	default:
		utils.BadRequest(w, "invalid asset_type")
		return
	}

	userUUID := stringToUUID(claims.UserID)

	var qty, buyPrice, currentPrice pgtype.Numeric
	if req.Quantity != nil {
		qty.Scan(*req.Quantity)
	}
	if req.BuyPrice != nil {
		buyPrice.Scan(*req.BuyPrice)
	}
	if req.CurrentPrice != nil {
		currentPrice.Scan(*req.CurrentPrice)
	}

	var maturityDate pgtype.Date
	if req.MaturityDate != nil && *req.MaturityDate != "" {
		maturityDate.Scan(*req.MaturityDate)
		maturityDate.Valid = true
	}

	var interestRate pgtype.Numeric
	if req.InterestRate != nil {
		interestRate.Scan(*req.InterestRate)
	}

	var metadata []byte
	if req.Metadata != nil {
		metadata = []byte(*req.Metadata)
	}

	investment, err := h.q.CreateInvestment(r.Context(), db.CreateInvestmentParams{
		UserID:                userUUID,
		Name:                  req.Name,
		AssetType:             assetType,
		Currency:              req.Currency,
		Quantity:              qty,
		BuyPrice:              buyPrice,
		CurrentPrice:          currentPrice,
		CurrentPriceUpdatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		MaturityDate:          maturityDate,
		InterestRate:          interestRate,
		Metadata:              metadata,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, investment)
}

// GET /api/v1/investments/{id}
func (h *InvestmentHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	investmentID := stringToUUID(chi.URLParam(r, "id"))
	investment, err := h.q.GetInvestmentByID(r.Context(), investmentID)
	if err != nil {
		utils.NotFound(w)
		return
	}

	userUUID := stringToUUID(claims.UserID)
	if investment.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	utils.OK(w, investment)
}

// PUT /api/v1/investments/{id}
func (h *InvestmentHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	investmentID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	// Verify ownership
	existing, err := h.q.GetInvestmentByID(r.Context(), investmentID)
	if err != nil || existing.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req updateInvestmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.AssetType == "" || req.Currency == "" {
		utils.BadRequest(w, "name, asset_type, and currency are required")
		return
	}

	var assetType db.AssetType
	switch req.AssetType {
	case "stock":
		assetType = db.AssetTypeStock
	case "mf":
		assetType = db.AssetTypeMf
	case "crypto":
		assetType = db.AssetTypeCrypto
	case "fd":
		assetType = db.AssetTypeFd
	case "ppf":
		assetType = db.AssetTypePpf
	case "nps":
		assetType = db.AssetTypeNps
	case "gold":
		assetType = db.AssetTypeGold
	case "silver":
		assetType = db.AssetTypeSilver
	case "real_estate":
		assetType = db.AssetTypeRealEstate
	case "savings":
		assetType = db.AssetTypeSavings
	case "other":
		assetType = db.AssetTypeOther
	default:
		utils.BadRequest(w, "invalid asset_type")
		return
	}

	var qty, buyPrice, currentPrice pgtype.Numeric
	if req.Quantity != nil {
		qty.Scan(*req.Quantity)
	}
	if req.BuyPrice != nil {
		buyPrice.Scan(*req.BuyPrice)
	}
	if req.CurrentPrice != nil {
		currentPrice.Scan(*req.CurrentPrice)
	}

	var maturityDate pgtype.Date
	if req.MaturityDate != nil && *req.MaturityDate != "" {
		maturityDate.Scan(*req.MaturityDate)
		maturityDate.Valid = true
	}

	var interestRate pgtype.Numeric
	if req.InterestRate != nil {
		interestRate.Scan(*req.InterestRate)
	}

	var metadata []byte
	if req.Metadata != nil {
		metadata = []byte(*req.Metadata)
	}

	investment, err := h.q.UpdateInvestment(r.Context(), db.UpdateInvestmentParams{
		ID:                    investmentID,
		Name:                  req.Name,
		AssetType:             assetType,
		Currency:              req.Currency,
		Quantity:              qty,
		BuyPrice:              buyPrice,
		CurrentPrice:          currentPrice,
		CurrentPriceUpdatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		MaturityDate:          maturityDate,
		InterestRate:          interestRate,
		Metadata:              metadata,
		UserID:                userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, investment)
}

// DELETE /api/v1/investments/{id}
func (h *InvestmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	investmentID := stringToUUID(chi.URLParam(r, "id"))
	userUUID := stringToUUID(claims.UserID)

	err := h.q.DeleteInvestment(r.Context(), db.DeleteInvestmentParams{
		ID:     investmentID,
		UserID: userUUID,
	})
	if err != nil {
		utils.NotFound(w)
		return
	}

	utils.OK(w, map[string]string{"message": "investment deleted"})
}

// GET /api/v1/investments/{id}/transactions
func (h *InvestmentHandler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	investmentID := stringToUUID(chi.URLParam(r, "id"))

	// Verify ownership
	investment, err := h.q.GetInvestmentByID(r.Context(), investmentID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if investment.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	txs, err := h.q.ListInvestmentTxByInvestment(r.Context(), investmentID)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if txs == nil {
		txs = []db.InvestmentTransaction{}
	}

	utils.OK(w, txs)
}

// POST /api/v1/investments/{id}/transactions
func (h *InvestmentHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}

	investmentID := stringToUUID(chi.URLParam(r, "id"))

	// Verify ownership
	investment, err := h.q.GetInvestmentByID(r.Context(), investmentID)
	if err != nil {
		utils.NotFound(w)
		return
	}
	userUUID := stringToUUID(claims.UserID)
	if investment.UserID.Bytes != userUUID.Bytes {
		utils.NotFound(w)
		return
	}

	var req createInvestmentTxRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}
	if req.Type == "" || req.Date == "" {
		utils.BadRequest(w, "type and date are required")
		return
	}

	var txType db.InvestmentTxType
	txType, err = ParseInvestmentTxType(req.Type)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}

	var qty, price, amount pgtype.Numeric
	if req.Quantity != nil {
		if err := qty.Scan(*req.Quantity); err != nil {
			utils.BadRequest(w, "invalid quantity")
			return
		}
	}
	if req.Price != nil {
		if err := price.Scan(*req.Price); err != nil {
			utils.BadRequest(w, "invalid price")
			return
		}
	}
	if req.Amount != nil {
		amount.Scan(*req.Amount)
	}

	var txDate pgtype.Date
	txDate.Scan(req.Date)
	txDate.Valid = true

	var note pgtype.Text
	if req.Note != nil && *req.Note != "" {
		note = pgtype.Text{String: *req.Note, Valid: true}
	}

	tx, err := h.q.CreateInvestmentTx(r.Context(), db.CreateInvestmentTxParams{
		InvestmentID: investmentID,
		Type:         txType,
		Quantity:     qty,
		Price:        price,
		Amount:       amount,
		Date:         txDate,
		Note:         note,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.Created(w, tx)
}
