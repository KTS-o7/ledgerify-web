# Ledgerify — Design Document

**Date:** 2026-04-28  
**Domain:** money.shenthar.me  
**Repo:** https://github.com/KTS-o7/ledgerify-web

---

## 1. Overview

A personal finance tracker web app for tracking income, expenses, investments, loans, insurance, budgets, savings goals and networth. Designed for single-user now, multi-user (family) ready via `user_id` on all tables.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, React Server Components) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Charts | Recharts |
| Auth | Auth.js v5 (credentials, HTTP-only cookie sessions) |
| ORM | Drizzle ORM |
| Database | PostgreSQL 17 (Docker, Alpine) |
| Validation | Zod (shared frontend/backend) |
| Exchange Rates | frankfurter.app (free, no API key, cached daily in DB) |
| Containerization | Docker Compose (multi-stage Alpine build) |
| Reverse Proxy | nginx (existing on VPS, TLS via Let's Encrypt) |
| CI/CD | GitHub Actions (free, public repo) → ghcr.io → SSH deploy |

---

## 3. Modules

| Module | Description |
|---|---|
| Dashboard | Networth snapshot, cash flow summary, recent transactions, budget rings, upcoming EMIs/renewals/goals |
| Transactions | Income, expense, transfer entries with categories, tags, recurring rules |
| Investments | Stocks, MF, crypto, FD, PPF, NPS, gold, silver, real estate, savings — P&L and returns |
| Loans | Home, personal, vehicle, education loans — EMI schedule, interest vs principal, payoff projection |
| Insurance | Life, health, vehicle, property, term policies — premium tracking, renewal alerts |
| Budgets | Recurring monthly/weekly spending limits per category — actual vs budget |
| Savings Goals | One-time savings targets with optional linked account, deadline, progress tracking |
| Networth | Assets minus liabilities over time chart, breakdown by asset class |
| Reports | Cash flow, category breakdown, investment returns, debt payoff, budget vs actual |
| Import/Export | Custom CSV template import, full data CSV export |
| Settings | Profile, currencies, categories, tags, accounts, data management |

---

## 4. Data Model

### `users`
```sql
id                UUID PRIMARY KEY
email             VARCHAR UNIQUE NOT NULL
password_hash     VARCHAR NOT NULL
name              VARCHAR NOT NULL
default_currency  VARCHAR(3) NOT NULL DEFAULT 'INR'
timezone          VARCHAR NOT NULL DEFAULT 'Asia/Kolkata'
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at        TIMESTAMPTZ
```

### `accounts`
```sql
id            UUID PRIMARY KEY
user_id       UUID REFERENCES users
name          VARCHAR NOT NULL
type          ENUM(bank, wallet, cash, savings)
currency      VARCHAR(3) NOT NULL
-- balance is computed from transactions, never stored directly
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
deleted_at    TIMESTAMPTZ
```

### `categories`
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users  -- null = system default
name        VARCHAR NOT NULL
type        ENUM(income, expense)
icon        VARCHAR
color       VARCHAR
deleted_at  TIMESTAMPTZ
```

### `tags`
```sql
id       UUID PRIMARY KEY
user_id  UUID REFERENCES users
name     VARCHAR NOT NULL
color    VARCHAR
```

### `transactions`
```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES users
account_id         UUID REFERENCES accounts
type               ENUM(income, expense, transfer)
amount             NUMERIC(18,4) NOT NULL
currency           VARCHAR(3) NOT NULL
converted_amount   NUMERIC(18,4)        -- in user's default_currency
base_currency      VARCHAR(3)
category_id        UUID REFERENCES categories
note               TEXT
date               DATE NOT NULL
is_recurring       BOOLEAN DEFAULT false
recurrence_rule    VARCHAR                -- RRULE string (RFC 5545)
transfer_to_id     UUID REFERENCES accounts  -- for transfer type
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ
deleted_at         TIMESTAMPTZ
```

### `transaction_tags`
```sql
transaction_id  UUID REFERENCES transactions
tag_id          UUID REFERENCES tags
PRIMARY KEY (transaction_id, tag_id)
```

### `investments`
```sql
id                        UUID PRIMARY KEY
user_id                   UUID REFERENCES users
name                      VARCHAR NOT NULL
asset_type                ENUM(stock, mf, crypto, fd, ppf, nps, gold, silver, real_estate, savings, other)
currency                  VARCHAR(3) NOT NULL
quantity                  NUMERIC(18,8)
buy_price                 NUMERIC(18,4)
current_price             NUMERIC(18,4)
current_price_updated_at  TIMESTAMPTZ
maturity_date             DATE           -- FD, PPF, NPS, bonds
interest_rate             NUMERIC(6,4)   -- FD, PPF, NPS
metadata                  JSONB          -- asset-type specific extra fields
created_at                TIMESTAMPTZ
updated_at                TIMESTAMPTZ
deleted_at                TIMESTAMPTZ
```

### `investment_transactions`
```sql
id             UUID PRIMARY KEY
investment_id  UUID REFERENCES investments
type           ENUM(buy, sell, dividend, interest, bonus)
quantity       NUMERIC(18,8)
price          NUMERIC(18,4)
amount         NUMERIC(18,4) NOT NULL
date           DATE NOT NULL
note           TEXT
created_at     TIMESTAMPTZ
deleted_at     TIMESTAMPTZ
```

### `loans`
```sql
id                  UUID PRIMARY KEY
user_id             UUID REFERENCES users
name                VARCHAR NOT NULL
loan_type           ENUM(home, personal, vehicle, education, other)
principal           NUMERIC(18,4) NOT NULL
interest_rate       NUMERIC(6,4) NOT NULL
tenure_months       INTEGER NOT NULL
start_date          DATE NOT NULL
emi_amount          NUMERIC(18,4) NOT NULL
currency            VARCHAR(3) NOT NULL
outstanding_balance NUMERIC(18,4)   -- computed/cached, source of truth is loan_payments
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ
```

### `loan_payments`
```sql
id                   UUID PRIMARY KEY
loan_id              UUID REFERENCES loans
date                 DATE NOT NULL
amount               NUMERIC(18,4) NOT NULL
principal_component  NUMERIC(18,4)
interest_component   NUMERIC(18,4)
status               ENUM(scheduled, paid, missed, partial)
created_at           TIMESTAMPTZ
deleted_at           TIMESTAMPTZ
```

### `insurance_policies`
```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES users
name               VARCHAR NOT NULL
provider           VARCHAR
policy_type        ENUM(life, health, vehicle, property, term, other)
premium_amount     NUMERIC(18,4) NOT NULL
premium_frequency  ENUM(monthly, quarterly, annual)
coverage_amount    NUMERIC(18,4)
currency           VARCHAR(3) NOT NULL
start_date         DATE NOT NULL
end_date           DATE
renewal_date       DATE
nominee            VARCHAR
notes              TEXT
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ
deleted_at         TIMESTAMPTZ
```

### `insurance_payments`
```sql
id         UUID PRIMARY KEY
policy_id  UUID REFERENCES insurance_policies
date       DATE NOT NULL
amount     NUMERIC(18,4) NOT NULL
status     ENUM(paid, due, missed)
created_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ
```

### `budgets`
```sql
id           UUID PRIMARY KEY
user_id      UUID REFERENCES users
category_id  UUID REFERENCES categories
name         VARCHAR NOT NULL
amount       NUMERIC(18,4) NOT NULL
currency     VARCHAR(3) NOT NULL
period_type  ENUM(monthly, weekly)
start_date   DATE NOT NULL
end_date     DATE          -- null = ongoing
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
deleted_at   TIMESTAMPTZ
```

### `savings_goals`
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users
name              VARCHAR NOT NULL
description       TEXT
target_amount     NUMERIC(18,4) NOT NULL
currency          VARCHAR(3) NOT NULL
current_amount    NUMERIC(18,4) DEFAULT 0   -- manual or computed from linked account
linked_account_id UUID REFERENCES accounts  -- optional
deadline          DATE
status            ENUM(active, achieved, abandoned)
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
deleted_at        TIMESTAMPTZ
```

### `exchange_rates`
```sql
base        VARCHAR(3) NOT NULL
target      VARCHAR(3) NOT NULL
rate        NUMERIC(18,8) NOT NULL
fetched_at  TIMESTAMPTZ NOT NULL
PRIMARY KEY (base, target)
```

### `audit_logs`
```sql
id           UUID PRIMARY KEY
user_id      UUID REFERENCES users
entity_type  VARCHAR NOT NULL   -- 'transaction', 'investment', etc.
entity_id    UUID NOT NULL
action       ENUM(create, update, delete)
old_value    JSONB
new_value    JSONB
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## 5. Pages & Routes

```
/                         → redirect to /dashboard
/auth/login               → credentials login
/auth/register            → first-user signup

/dashboard
/transactions
/transactions/new
/transactions/[id]

/investments
/investments/new
/investments/[id]

/loans
/loans/new
/loans/[id]

/insurance
/insurance/new
/insurance/[id]

/budgets
/budgets/goals

/networth

/reports
/reports/cash-flow
/reports/category-breakdown
/reports/investment-returns
/reports/debt-payoff
/reports/budget-vs-actual

/import
/settings/profile
/settings/currencies
/settings/categories
/settings/tags
/settings/accounts
/settings/data
```

**Mobile navigation:** Bottom tab bar — Dashboard | Transactions | + (quick add) | Investments | More

---

## 6. Architecture

```
Browser / Mobile
      │
      ▼
nginx (VPS, existing)
  money.shenthar.me → proxy → localhost:3000
  TLS: Let's Encrypt / Certbot
  gzip + static asset caching
      │
      ▼
Next.js 16 App (Docker, port 3000)
  ├── RSC pages (minimal client JS)
  ├── Server Actions (mutations)
  ├── Route Handlers (CSV import, exchange rate cron, JSON APIs)
  ├── Auth.js v5 (HTTP-only cookie sessions)
  └── Drizzle ORM
      │
      ▼
PostgreSQL 17 (Docker, internal network only, not publicly exposed)
      │
      ▼
frankfurter.app (server-side only, daily cron, cached in exchange_rates table)
```

### Docker Compose

```yaml
services:
  app:
    build: . (multi-stage, node:22-alpine → standalone output)
    ports: ["3000:3000"] (localhost only)
    restart: unless-stopped
    depends_on: [postgres]

  postgres:
    image: postgres:17-alpine
    volumes: [pg_data:/var/lib/postgresql/data]
    expose: [5432]
    restart: unless-stopped
```

Target app image size: ~150 MB (standalone Next.js output on Alpine)

### Estimated RAM

| Service | RAM |
|---|---|
| Next.js app | ~220 MB |
| PostgreSQL | ~90 MB |
| Existing services | ~1.0 GB |
| **Total** | **~1.3 GB / 2.9 GB** |

---

## 7. CI/CD

**GitHub Actions (free, public repo)**

1. On push to `main`: typecheck + lint + build
2. Build Docker image → push to `ghcr.io/kts-o7/ledgerify-web`
3. SSH into VPS → `docker compose pull && docker compose up -d`

---

## 8. Exchange Rates

- Provider: frankfurter.app (no API key, free)
- Fetch strategy: server-side cron via `/api/cron/exchange-rates` Route Handler
- Scheduled: daily via VPS crontab
- Stored in `exchange_rates` table with `UNIQUE(base, target)`
- Fallback: on fetch failure, last cached rate is used
- User option in Settings: auto (daily fetch) or manual (user enters rate)

---

## 9. Future Scope

- Multi-user / family accounts (schema already supports via `user_id`)
- OAuth providers (Google, GitHub) via Auth.js
- Mobile app (React Native, shared Zod schemas)
- Bank statement PDF parsing
- Stock/MF price auto-fetch (NSE/BSE API or Yahoo Finance)
- Tax summary report (capital gains, income slabs)
- Notifications (renewal reminders, EMI due alerts) via email or push
