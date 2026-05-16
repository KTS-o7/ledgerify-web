# Stage 1: Build Go binary
FROM golang:1.24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /ledgerify ./cmd/server

# Stage 2: Minimal production image
FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /ledgerify /app/ledgerify
COPY --from=builder /app/web/templates /app/web/templates
EXPOSE 8080
ENV PORT=8080
ENV GIN_MODE=release
USER nobody
CMD ["/app/ledgerify"]
