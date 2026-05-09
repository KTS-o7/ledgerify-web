package handlers

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// uuidToString converts a pgtype.UUID to a string.
func uuidToString(id pgtype.UUID) string {
	return uuid.UUID(id.Bytes).String()
}

// stringToUUID converts a string to a pgtype.UUID.
func stringToUUID(id string) pgtype.UUID {
	return pgtype.UUID{Bytes: uuid.MustParse(id), Valid: true}
}
