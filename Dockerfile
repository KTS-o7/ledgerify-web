# Stage 1: Build SolidJS frontend with bun
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# Stage 2: Build Go binary with embedded frontend
FROM golang:1.26-alpine AS go-builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /ledgerify ./cmd/server

# Stage 3: Minimal runtime
FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=go-builder /ledgerify /app/ledgerify
EXPOSE 8080
ENV PORT=8080
USER nobody
CMD ["/app/ledgerify"]
