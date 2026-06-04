package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/llm"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ImportExportHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
	llm  *llm.Client
}

func NewImportExportHandler(pool *pgxpool.Pool, q *db.Queries, llmClient *llm.Client) *ImportExportHandler {
	return &ImportExportHandler{pool: pool, q: q, llm: llmClient}
}

type ImportStats struct {
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

func (h *ImportExportHandler) Import(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		utils.BadRequest(w, "failed to parse form: "+err.Error())
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "missing file field")
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		utils.BadRequest(w, "failed to parse CSV: "+err.Error())
		return
	}
	if len(records) < 2 {
		utils.BadRequest(w, "CSV must have at least a header and one row")
		return
	}

	headers := records[0]
	stats := ImportStats{}

	accounts, _ := h.q.ListAccountsByUser(r.Context(), userID)
	if accounts == nil {
		accounts = []db.Account{}
	}
	categories, _ := h.q.ListCategoriesByUser(r.Context(), userID)
	if categories == nil {
		categories = []db.Category{}
	}

	accountMap := make(map[string]pgtype.UUID)
	for _, a := range accounts {
		accountMap[a.Name] = a.ID
	}
	categoryMap := make(map[string]pgtype.UUID)
	for _, c := range categories {
		categoryMap[c.Name] = c.ID
	}

	for i, row := range records[1:] {
		record := make(map[string]string, len(headers))
		for j, hdr := range headers {
			if j < len(row) {
				record[hdr] = row[j]
			}
		}

		title := record["title"]
		amtStr := record["amount"]
		txType := record["type"]
		currency := record["currency"]
		dateStr := record["date"]
		categoryName := record["category"]
		accountName := record["account"]

		if title == "" || amtStr == "" || txType == "" || dateStr == "" || accountName == "" {
			stats.Skipped++
			continue
		}

		accountID, ok := accountMap[accountName]
		if !ok {
			txCurrency := currency
			if txCurrency == "" {
				txCurrency = "INR"
			}
			newAcc, err := h.q.CreateAccount(r.Context(), db.CreateAccountParams{
				UserID:         userID,
				Name:           accountName,
				Type:           db.AccountTypeBank,
				Currency:       txCurrency,
				OpeningBalance: pgtype.Numeric{},
			})
			if err != nil {
				stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: failed to create account: %v", i+2, err))
				continue
			}
			accountID = newAcc.ID
			accountMap[accountName] = accountID
		}

		var categoryID pgtype.UUID
		if cid, ok := categoryMap[categoryName]; ok {
			categoryID = cid
		}

		var amount pgtype.Numeric
		if err := amount.Scan(amtStr); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: invalid amount: %s", i+2, amtStr))
			continue
		}

		var txDate pgtype.Date
		parsedDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			parsedDate, err = time.Parse("02/01/2006", dateStr)
			if err != nil {
				parsedDate, err = time.Parse("01/02/2006", dateStr)
				if err != nil {
					stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: invalid date: %s", i+2, dateStr))
					continue
				}
			}
		}
		txDate.Scan(parsedDate)
		txDate.Valid = true

		var txTypeEnum db.TransactionType
		switch txType {
		case "income":
			txTypeEnum = db.TransactionTypeIncome
		case "expense":
			txTypeEnum = db.TransactionTypeExpense
		case "transfer":
			txTypeEnum = db.TransactionTypeTransfer
		case "credit_payment":
			txTypeEnum = db.TransactionTypeCreditPayment
		default:
			stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: invalid type: %s", i+2, txType))
			continue
		}

		txCurrency := currency
		if txCurrency == "" {
			txCurrency = "INR"
		}

		_, err = h.q.CreateTransaction(r.Context(), db.CreateTransactionParams{
			UserID:          userID,
			AccountID:       accountID,
			Type:            txTypeEnum,
			Amount:          amount,
			Currency:        txCurrency,
			CategoryID:      categoryID,
			Title:           pgtype.Text{String: title, Valid: true},
			Note:            pgtype.Text{String: record["note"], Valid: record["note"] != ""},
			Date:            txDate,
			IsRecurring:     false,
			ConvertedAmount: pgtype.Numeric{},
			BaseCurrency:    pgtype.Text{},
		})
		if err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("row %d: failed to create transaction: %v", i+2, err))
			continue
		}
		stats.Imported++
	}

	utils.Created(w, stats)
}

func (h *ImportExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	var from, to time.Time
	var err error

	if fromDate != "" {
		from, err = time.Parse("2006-01-02", fromDate)
		if err != nil {
			utils.BadRequest(w, "invalid from_date format, use YYYY-MM-DD")
			return
		}
	} else {
		from = time.Now().AddDate(0, -1, 0)
	}

	if toDate != "" {
		to, err = time.Parse("2006-01-02", toDate)
		if err != nil {
			utils.BadRequest(w, "invalid to_date format, use YYYY-MM-DD")
			return
		}
	} else {
		to = time.Now()
	}

	var fromPg, toPg pgtype.Date
	fromPg.Scan(from)
	fromPg.Valid = true
	toPg.Scan(to)
	toPg.Valid = true

	txns, err := h.q.GetTransactionsByDateRange(r.Context(), db.GetTransactionsByDateRangeParams{
		UserID: userID,
		Date:   fromPg,
		Date_2: toPg,
	})
	if err != nil {
		utils.InternalError(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=ledgerify_export_%s.csv", time.Now().Format("2006-01-02")))

	writer := csv.NewWriter(w)
	writer.Write([]string{"title", "type", "amount", "currency", "account", "category", "date", "note", "tags"})

	for _, tx := range txns {
		writer.Write([]string{
			tx.Title.String,
			string(tx.Type),
			numericToString(tx.Amount),
			tx.Currency,
			tx.AccountName,
			tx.CategoryName.String,
			tx.Date.Time.Format("2006-01-02"),
			tx.Note.String,
			"",
		})
	}
	writer.Flush()
}

type CategoriseResponse struct {
	Categorised int               `json:"categorised"`
	Categories  map[string]string `json:"categories,omitempty"`
}

func (h *ImportExportHandler) Categorise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		utils.Unauthorized(w)
		return
	}
	userID := stringToUUID(claims.UserID)

	var req struct {
		TransactionIDs []string `json:"transaction_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "invalid request body")
		return
	}

	mode := r.URL.Query().Get("mode")

	keywords, err := h.q.ListCategoryKeywordsByUser(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	categories, err := h.q.ListCategoriesByUser(r.Context(), userID)
	if err != nil {
		utils.InternalError(w)
		return
	}

	categorised := 0
	categoryMap := make(map[string]string)
	var unmatched []string

	for _, txID := range req.TransactionIDs {
		txUUID := stringToUUID(txID)
		tx, err := h.q.GetTransactionByID(r.Context(), txUUID)
		if err != nil {
			continue
		}
		if tx.UserID.Bytes != userID.Bytes {
			continue
		}
		if tx.CategoryID.Valid {
			categorised++
			continue
		}

		matched := false
		for _, kw := range keywords {
			if strings.Contains(strings.ToLower(tx.Title.String), strings.ToLower(kw.Keyword)) {
				_, err := h.pool.Exec(r.Context(), "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3", kw.CategoryID, tx.ID, userID)
				if err == nil {
					categoryMap[txID] = kw.CategoryName
					categorised++
				}
				matched = true
				break
			}
		}

		if !matched && mode != "keyword" {
			unmatched = append(unmatched, txID)
		}
	}

	if mode != "keyword" && h.llm != nil && len(unmatched) > 0 {
		llmCategories := make([]llm.Category, len(categories))
		for i, cat := range categories {
			llmCategories[i] = llm.Category{
				ID:   uuidToString(cat.ID),
				Name: cat.Name,
			}
		}

		for _, txID := range unmatched {
			txUUID := stringToUUID(txID)
			tx, err := h.q.GetTransactionByID(r.Context(), txUUID)
			if err != nil {
				continue
			}
			if tx.Title.String == "" {
				continue
			}

			categoryName, err := h.llm.Categorize(r.Context(), tx.Title.String, llmCategories)
			if err != nil || categoryName == "" {
				continue
			}

			for _, cat := range categories {
				if cat.Name == categoryName {
					_, err := h.pool.Exec(r.Context(), "UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3 AND category_id IS NULL", cat.ID, tx.ID, userID)
					if err == nil {
						categoryMap[txID] = categoryName
						categorised++
					}
					break
				}
			}
		}
	}

	utils.OK(w, CategoriseResponse{
		Categorised: categorised,
		Categories:  categoryMap,
	})
}

func numericToString(n pgtype.Numeric) string {
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return "0"
	}
	return fmt.Sprintf("%.2f", f.Float64)
}
