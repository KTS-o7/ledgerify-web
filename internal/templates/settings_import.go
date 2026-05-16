package templates

import (
	"encoding/csv"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/KTS-o7/ledgerify-web/internal/db"
	"github.com/KTS-o7/ledgerify-web/internal/middleware"
	"github.com/jackc/pgx/v5/pgtype"
)

// SettingsPage renders the settings page.
func (ph *PageHandlers) SettingsPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Settings")
	RenderPage(w, "settings", data)
}

// CategoriesPage lists all categories with create/delete.
func (ph *PageHandlers) CategoriesPage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	data := NewPageData(r, "Categories")

	if claims != nil {
		cats, err := ph.q.ListCategoriesByUser(r.Context(), parseUUID(claims.UserID))
		if err == nil {
			data.Data = cats
		}
	}
	RenderPage(w, "settings-categories", data)
}

// CreateCategory creates a new category via POST.
func (ph *PageHandlers) CreateCategory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	color := strings.TrimSpace(r.FormValue("color"))
	if name == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}
	typ := r.FormValue("type")
	if typ == "" {
		typ = "expense"
	}
	_, err := ph.q.CreateCategory(r.Context(), db.CreateCategoryParams{
		UserID: parseUUID(claims.UserID),
		Name:   name,
		Color:  pgtype.Text{String: color, Valid: color != ""},
		Type:   db.CategoryType(typ),
	})
	if err != nil {
		log.Printf("CreateCategory error: %v", err)
	}
	http.Redirect(w, r, "/settings/categories", http.StatusSeeOther)
}

// DeleteCategory deletes a category.
func (ph *PageHandlers) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	idStr := r.PathValue("id")
	userID := parseUUID(claims.UserID)
	catID := parseUUID(idStr)

	_ = ph.q.DeleteCategory(r.Context(), db.DeleteCategoryParams{
		ID:     catID,
		UserID: userID,
	})
	http.Redirect(w, r, "/settings/categories", http.StatusSeeOther)
}

// ImportPage renders the data import page.
func (ph *PageHandlers) ImportPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Import Data")
	RenderPage(w, "import", data)
}

// ImportCSV handles CSV transaction import.
func (ph *PageHandlers) ImportCSV(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	file, header, err := r.FormFile("csv_file")
	if err != nil {
		log.Printf("ImportCSV file read error: %v", err)
		SetFlash(w, "error", "Failed to read uploaded file")
		http.Redirect(w, r, "/import", http.StatusSeeOther)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		SetFlash(w, "error", "Invalid CSV format")
		http.Redirect(w, r, "/import", http.StatusSeeOther)
		return
	}

	if len(records) < 2 {
		SetFlash(w, "error", "CSV file has no data rows")
		http.Redirect(w, r, "/import", http.StatusSeeOther)
		return
	}

	userID := parseUUID(claims.UserID)
	imported := 0

	for i, row := range records {
		if i == 0 {
			continue // skip header
		}
		if len(row) < 4 {
			continue
		}
		amount, err := strconv.ParseFloat(strings.TrimSpace(row[0]), 64)
		if err != nil {
			continue
		}
		title := strings.TrimSpace(row[1])
		dateStr := strings.TrimSpace(row[2])
		tType := db.TransactionType(strings.ToLower(strings.TrimSpace(row[3])))

		catID := pgtype.UUID{}
		if len(row) > 4 && row[4] != "" {
			catID = parseUUID(strings.TrimSpace(row[4]))
		}
		accID := pgtype.UUID{}
		if len(row) > 5 && row[5] != "" {
			accID = parseUUID(strings.TrimSpace(row[5]))
		}

		var pgAmt pgtype.Numeric
		_ = pgAmt.Scan(fmt.Sprint(amount))
		pgAmt.Valid = true

		var pgDate pgtype.Date
		if dateStr != "" {
			t, err := time.Parse("2006-01-02", dateStr)
			if err == nil {
				pgDate.Time = t
				pgDate.Valid = true
			}
		}

		_, err = ph.q.CreateTransaction(r.Context(), db.CreateTransactionParams{
			UserID:     userID,
			Type:       tType,
			Amount:     pgAmt,
			Currency:   "INR",
			CategoryID: catID,
			AccountID:  accID,
			Title:      pgtype.Text{String: title, Valid: title != ""},
			Date:       pgDate,
		})
		if err == nil {
			imported++
		}
	}

	SetFlash(w, "success", fmt.Sprintf("Imported %d transactions from %s", imported, header.Filename))
	http.Redirect(w, r, "/import", http.StatusSeeOther)
}

// ExportPage renders the export page.
func (ph *PageHandlers) ExportPage(w http.ResponseWriter, r *http.Request) {
	data := NewPageData(r, "Export Data")
	RenderPage(w, "export", data)
}

// ExportCSV exports transactions as CSV.
func (ph *PageHandlers) ExportCSV(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	txs, err := ph.q.ListTransactionsByUser(r.Context(), db.ListTransactionsByUserParams{
		UserID: parseUUID(claims.UserID),
	})
	if err != nil {
		http.Error(w, "failed to fetch transactions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=ledgerify-export.csv")
	writer := csv.NewWriter(w)
	defer writer.Flush()

	_ = writer.Write([]string{"Amount", "Title", "Date", "Type", "CategoryID", "AccountID"})
	for _, t := range txs {
		amt := ""
		if t.Amount.Valid {
			a, _ := t.Amount.Float64Value()
			amt = fmt.Sprintf("%.2f", a.Float64)
		}
		title := ""
		if t.Title.Valid {
			title = t.Title.String
		}
		date := ""
		if t.Date.Valid {
			date = t.Date.Time.Format("2006-01-02")
		}
		catID := ""
		if t.CategoryID.Valid {
			catID = pgUUIDToString(t.CategoryID)
		}
		accID := ""
		if t.AccountID.Valid {
			accID = pgUUIDToString(t.AccountID)
		}
		_ = writer.Write([]string{amt, title, date, string(t.Type), catID, accID})
	}
}
