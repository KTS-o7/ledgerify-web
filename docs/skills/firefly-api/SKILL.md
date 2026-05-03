---
name: firefly-api
description: Use when an AI agent needs to read or write financial data — transactions, accounts, budgets, bills, piggy banks — via the Firefly III REST API at money.shenthar.me.
---

# Firefly III REST API

## Overview

Firefly III exposes a full REST API at `/api/v1/`. Authentication is via a **Personal Access Token** (Bearer token) — no CSRF, no session cookies.

**Base URL:** `https://money.shenthar.me`

---

## Authentication

Generate a token in the UI: Profile → OAuth → Personal Access Tokens → Create.

Use on every request:

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

Verify:
```http
GET /api/v1/about/user
```

---

## Account Types

Firefly uses typed accounts. Know which to use:

| Type | Use for |
|------|---------|
| `asset` | Your bank accounts, savings, wallets |
| `expense` | Where money goes (merchants, payees) — auto-created |
| `revenue` | Where money comes from (employer, clients) — auto-created |
| `liability` | Credit cards, loans you owe |

Credit cards should be `liability` type accounts — Firefly tracks what you owe separately from payments.

---

## Core Endpoints

### Accounts
```
GET    /api/v1/accounts              # list all (filter: ?type=asset|liability)
POST   /api/v1/accounts              # create
GET    /api/v1/accounts/:id          # single account with current balance
PUT    /api/v1/accounts/:id          # update
DELETE /api/v1/accounts/:id          # delete
GET    /api/v1/accounts/:id/transactions  # all txns for account
```

POST body:
```json
{
  "name": "SBI Savings",
  "type": "asset",
  "account_type_id": null,
  "currency_code": "INR",
  "include_net_worth": true,
  "account_number": "39208712062"
}
```

For credit card liability:
```json
{
  "name": "Slice Credit Card",
  "type": "liability",
  "liability_type": "credit card",
  "liability_direction": "debit",
  "currency_code": "INR",
  "opening_balance": "-29755.28",
  "opening_balance_date": "2026-04-20"
}
```

### Transactions
```
GET    /api/v1/transactions          # list (filters below)
POST   /api/v1/transactions          # create
GET    /api/v1/transactions/:id      # single
PUT    /api/v1/transactions/:id      # update
DELETE /api/v1/transactions/:id      # delete
```

GET filters: `?type=withdrawal|deposit|transfer&start=YYYY-MM-DD&end=YYYY-MM-DD&limit=50&page=1`

POST body (withdrawal = expense):
```json
{
  "transactions": [{
    "type": "withdrawal",
    "date": "2026-04-02",
    "amount": "25000",
    "description": "Rent - April",
    "source_id": "1",
    "destination_name": "Mr Suhas K",
    "category_name": "Rent",
    "currency_code": "INR",
    "tags": ["rent"],
    "notes": "Monthly rent payment"
  }]
}
```

POST body (deposit = income):
```json
{
  "transactions": [{
    "type": "deposit",
    "date": "2026-04-12",
    "amount": "85000",
    "description": "April Salary",
    "source_name": "Latspace Technologies",
    "destination_id": "1",
    "category_name": "Salary",
    "currency_code": "INR"
  }]
}
```

POST body (transfer between own accounts):
```json
{
  "transactions": [{
    "type": "transfer",
    "date": "2026-04-08",
    "amount": "20000",
    "description": "ICICI to Fi transfer",
    "source_id": "2",
    "destination_id": "3",
    "currency_code": "INR"
  }]
}
```

Transaction types: `withdrawal` (expense), `deposit` (income), `transfer` (between own accounts).

### Categories
```
GET    /api/v1/categories            # list all
POST   /api/v1/categories            # create: { "name": "Food & Dining" }
GET    /api/v1/categories/:id/transactions
```

### Budgets
```
GET    /api/v1/budgets               # list
POST   /api/v1/budgets               # create: { "name": "Food", "active": true }
POST   /api/v1/budgets/:id/limits    # set monthly limit
GET    /api/v1/budgets/:id/limits    # get limits
```

Budget limit body:
```json
{
  "start": "2026-04-01",
  "end": "2026-04-30",
  "amount": "15000",
  "currency_code": "INR",
  "period": "monthly"
}
```

### Bills (recurring expenses / credit card dues)
```
GET    /api/v1/bills                 # list all bills
POST   /api/v1/bills                 # create
GET    /api/v1/bills/:id/transactions
```

POST body:
```json
{
  "name": "Slice Credit Card",
  "amount_min": "5000",
  "amount_max": "50000",
  "date": "2026-05-05",
  "currency_code": "INR",
  "repeat_freq": "monthly",
  "active": true
}
```

### Piggy Banks (savings goals)
```
GET    /api/v1/piggy-banks           # list
POST   /api/v1/piggy-banks           # create
PUT    /api/v1/piggy-banks/:id       # update (change current_amount to add money)
```

POST body:
```json
{
  "name": "Emergency Fund",
  "account_id": "1",
  "target_amount": "300000",
  "current_amount": "50000",
  "currency_code": "INR",
  "target_date": "2027-01-01"
}
```

### Tags
```
GET    /api/v1/tags
POST   /api/v1/tags                  # { "tag": "india-trip-2026" }
```

---

## Insight / Analytics Endpoints

These return aggregated sums — ideal for dashboards and summaries:

```
GET /api/v1/insight/expense/total?start=YYYY-MM-DD&end=YYYY-MM-DD
GET /api/v1/insight/income/total?start=...&end=...
GET /api/v1/insight/expense/category?start=...&end=...   # spend per category
GET /api/v1/insight/expense/asset?start=...&end=...      # spend per account
GET /api/v1/insight/income/revenue?start=...&end=...     # income per source
GET /api/v1/summary/basic?start=...&end=...              # dashboard totals
```

### Search
```
GET /api/v1/search/transactions?query=swiggy&limit=25
GET /api/v1/search/accounts?query=SBI
```

Query supports: `description:X`, `amount_more:1000`, `date_after:2026-01-01`, `category:Food`, `account_id:1`

---

## Common Agent Workflows

### Log an expense
```
POST /api/v1/transactions
{ type: "withdrawal", source_id: <account_id>, destination_name: <merchant>, amount, date, category_name, description }
```
`destination_name` auto-creates an expense account for the merchant if it doesn't exist.

### Log salary / income
```
POST /api/v1/transactions
{ type: "deposit", source_name: <employer>, destination_id: <account_id>, amount, date, category_name }
```

### Check this month's spending
```
GET /api/v1/insight/expense/category?start=2026-05-01&end=2026-05-31
```

### Check account balances
```
GET /api/v1/accounts?type=asset
```
Each account object has `current_balance` field.

### Check credit card balance owed
```
GET /api/v1/accounts?type=liability
```
`current_balance` shows current debt amount.

### Transfer between accounts
```
POST /api/v1/transactions
{ type: "transfer", source_id, destination_id, amount, date }
```

### Set a monthly budget
```
POST /api/v1/budgets  →  get budget id
POST /api/v1/budgets/:id/limits  { start, end, amount }
```

---

## Error Reference

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 204 | Deleted |
| 422 | Validation error — check `errors` field in response |
| 401 | Token missing or expired — regenerate in UI |
| 404 | Not found |

Error response shape:
```json
{ "message": "...", "errors": { "field": ["reason"] } }
```

---

## Notes

- All amounts are **strings** in responses — `"25000.00"` — use `parseFloat()` before arithmetic.
- Dates are **YYYY-MM-DD**.
- `source` / `destination` can be specified by `_id` (for asset accounts you own) or `_name` (auto-creates expense/revenue accounts).
- Pagination: responses have `meta.pagination` with `total`, `per_page`, `current_page`. Pass `?page=N&limit=50`.
- Full OpenAPI spec: `https://api-docs.firefly-iii.org/`
