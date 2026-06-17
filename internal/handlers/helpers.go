package handlers

import (
	"net/http"

	"github.com/KTS-o7/ledgerify-web/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// uuidToString converts a pgtype.UUID to a string.
func uuidToString(id pgtype.UUID) string {
	return uuid.UUID(id.Bytes).String()
}

// stringToUUID converts a string to a pgtype.UUID.
// Returns (pgtype.UUID{}, false) when the string is not a valid UUID.
func stringToUUID(id string) pgtype.UUID {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}
}

// parseUUIDParam parses a URL parameter as a UUID, writing HTTP 400 and
// returning false on failure. Callers must return immediately when ok==false.
func parseUUIDParam(w http.ResponseWriter, id string) (pgtype.UUID, bool) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		utils.BadRequest(w, "invalid id")
		return pgtype.UUID{}, false
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}, true
}
