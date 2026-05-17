# Ledgerify

Personal finance tracker — Go + HTMX, PostgreSQL-backed, Docker-deployed.

## Stack

- **Backend:** Go, chi router, pgx/PostgreSQL, sqlc
- **Frontend:** HTMX, Pico.css, Alpine.js, Chart.js
- **Deploy:** Docker multi-stage (golang:alpine → scratch)

## Quick Start

### Local Dev

```bash
# Set up PostgreSQL
createdb ledgerify
psql ledgerify < schema/001_schema.sql

# Run
cp .env.example .env   # edit DB credentials
go run ./cmd/server
# → http://localhost:8080
```

### Database

The canonical schema is `schema/001_schema.sql`. Use sqlc to generate Go query code from `queries/001_queries.sql`.

> **Note:** Drizzle ORM was removed in the Go-only migration. The Go stack uses raw SQL via `pgx` + `sqlc`. Do not add Drizzle back.

### Docker

```bash
docker build -t ledgerify .
docker run -p 8080:8080 --env-file .env ledgerify
```

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `DATABASE_URL` | `postgres://localhost/ledgerify` | PostgreSQL connection |
| `JWT_SECRET` | (required) | Signing key for auth tokens |
| `PORT` | `8080` | HTTP listen port |

## Features

- Multi-account transaction tracking
- Budgets with period-aware spending windows
- Investments, loans, insurance tracking
- Dashboard with summary cards and budget status
- Reports with Chart.js visualizations
- CSV import/export
- Dark/light theme
- Mobile-responsive via Pico.css