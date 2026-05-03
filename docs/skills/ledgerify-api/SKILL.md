---
name: ledgerify-api
description: Use when an AI agent needs to read or write data in Ledgerify — logging transactions, checking budgets, listing accounts, managing investments, loans, or insurance via the REST API at money.shenthar.me.
---

# Ledgerify REST API

## Overview

Ledgerify exposes a REST API at `/api/v1/` authenticated via session cookie. The agent authenticates with email + password, receives a session token, and uses it on all subsequent requests. All endpoints accept and return JSON.

**Base URL:** `https://money.shenthar.me`

---

## Authentication (do this first, every session)

### Step 1 — Get CSRF token

```http
GET /api/auth/csrf
```

Response:
```json
{ "csrfToken": "<token>" }
```

Also save the `set-cookie` header — you need `authjs.csrf-token=<value>` for the next step.

### Step 2 — Sign in

```http
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded
Cookie: authjs.csrf-token=<value-from-step-1>

email=<email>&password=<password>&csrfToken=<token-from-step-1>&callbackUrl=https%3A%2F%2Fmoney.shenthar.me%2Fdashboard&redirect=false&json=true
```

Save the `authjs.session-token` cookie from the response. Use it on every `/api/v1/*` request:

```http
Cookie: authjs.session-token=<session-token>
```

### Verify session (optional)

```http
GET /api/auth/session
Cookie: authjs.session-token=<token>
```

Returns `{ "user": { "id": "...", "email": "..." } }`. If `user` is null, re-authenticate.

---

## API Quick Reference

All routes require `Cookie: authjs.session-token=<token>`.  
All POST/PATCH bodies: `Content-Type: application/json`.  
Errors: `{ "error": "message" }` with appropriate status code.

### Accounts

| Method | Path | Body / Query | Returns |
|--------|------|-------------|---------|
| GET | `/api/v1/accounts` | — | Array of accounts |
| GET | `/api/v1/accounts/:id` | — | Single account or 404 |
| POST | `/api/v1/accounts` | `{ name, type, currency }` | Created account (201) |
| DELETE | `/api/v1/accounts/:id` | — | `{ success: true }` |

`type` enum: `bank` `wallet` `cash` `savings`

### Categories

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/v1/categories` | — | User + system categories |
| GET | `/api/v1/categories/:id` | — | Single category or 404 |
| POST | `/api/v1/categories` | `{ name, type, color? }` | Created category (201) |
| DELETE | `/api/v1/categories/:id` | — | `{ success: true }` |

`type` enum: `income` `expense`

### Transactions

| Method | Path | Body / Query | Returns |
|--------|------|-------------|---------|
| GET | `/api/v1/transactions` | `?type=&accountId=&from=&to=&limit=` | Array (max 500, default 100) |
| GET | `/api/v1/transactions/:id` | — | Single transaction or 404 |
| POST | `/api/v1/transactions` | see below | Created transaction (201) |
| DELETE | `/api/v1/transactions/:id` | — | `{ success: true }` |

POST body:
```json
{
  "accountId": "<uuid>",
  "type": "income" | "expense",
  "amount": 150.50,
  "currency": "INR",
  "date": "YYYY-MM-DD",
  "categoryId": "<uuid>",
  "note": "optional",
  "isRecurring": false
}
```

Response includes `convertedAmount` and `baseCurrency` computed automatically.

Query filters: `type=income|expense`, `accountId=<uuid>`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `limit=N` (max 500)

### Budgets

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/v1/budgets` | — | Array of budgets |
| GET | `/api/v1/budgets/:id` | — | Single budget or 404 |
| POST | `/api/v1/budgets` | `{ name, amount, currency, periodType, startDate, categoryId?, endDate? }` | Created budget (201) |
| DELETE | `/api/v1/budgets/:id` | — | `{ success: true }` |

`periodType` enum: `monthly` `weekly`

### Goals (Savings Goals)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/v1/goals` | — | Array of goals |
| GET | `/api/v1/goals/:id` | — | Single goal or 404 |
| POST | `/api/v1/goals` | `{ name, targetAmount, currency, description?, linkedAccountId?, deadline? }` | Created goal (201) |
| POST | `/api/v1/goals/:id/contribute` | `{ amount }` | Updated goal |
| DELETE | `/api/v1/goals/:id` | — | `{ success: true }` |

Contribute returns the goal with updated `currentAmount` and `status` (`active` or `achieved`).

### Investments

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/v1/investments` | — | Array of investments |
| GET | `/api/v1/investments/:id` | — | Single investment or 404 |
| POST | `/api/v1/investments` | see below | Created investment (201) |
| PATCH | `/api/v1/investments/:id/price` | `{ currentPrice }` | Updated investment |
| DELETE | `/api/v1/investments/:id` | — | `{ success: true }` |

POST body:
```json
{
  "name": "Reliance Industries",
  "assetType": "stock",
  "currency": "INR",
  "quantity": 10,
  "buyPrice": 2500,
  "currentPrice": 2600,
  "interestRate": null,
  "maturityDate": null
}
```

`assetType` enum: `stock` `mf` `crypto` `fd` `ppf` `nps` `gold` `silver` `real_estate` `savings` `other`

### Loans

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/v1/loans` | — | Array of loans |
| GET | `/api/v1/loans/:id` | — | Single loan or 404 |
| POST | `/api/v1/loans` | see below | Created loan (201) |
| POST | `/api/v1/loans/:id/payment` | see below | Created payment (201) |
| DELETE | `/api/v1/loans/:id` | — | `{ success: true }` |

Loan POST body:
```json
{
  "name": "Home Loan - SBI",
  "loanType": "home",
  "principal": 5000000,
  "interestRate": 8.5,
  "tenureMonths": 240,
  "startDate": "2026-01-01",
  "emiAmount": 43391,
  "currency": "INR"
}
```

Payment POST body:
```json
{
  "date": "YYYY-MM-DD",
  "amount": 43391,
  "principalComponent": 10000,
  "interestComponent": 33391,
  "status": "paid"
}
```

`loanType` enum: `home` `personal` `vehicle` `education` `other`  
Payment `status` enum: `scheduled` `paid` `missed` `partial`

### Insurance

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/v1/insurance` | — | Array of policies |
| GET | `/api/v1/insurance/:id` | — | Single policy or 404 |
| POST | `/api/v1/insurance` | see below | Created policy (201) |
| POST | `/api/v1/insurance/:id/payment` | `{ date, amount, status }` | Created payment (201) |
| DELETE | `/api/v1/insurance/:id` | — | `{ success: true }` |

Policy POST body:
```json
{
  "name": "HDFC Life Term Plan",
  "policyType": "term",
  "premiumAmount": 15000,
  "premiumFrequency": "annual",
  "currency": "INR",
  "startDate": "2026-01-01",
  "provider": "HDFC Life",
  "coverageAmount": 10000000,
  "renewalDate": "2027-01-01",
  "nominee": "Spouse"
}
```

`policyType` enum: `life` `health` `vehicle` `property` `term` `other`  
`premiumFrequency` enum: `monthly` `quarterly` `annual`  
Payment `status` enum: `paid` `due` `missed`

---

## Common Agent Workflows

### Log an expense

```
1. GET /api/v1/accounts  →  pick accountId
2. GET /api/v1/categories?  →  pick categoryId (or omit)
3. POST /api/v1/transactions  { accountId, type:"expense", amount, currency, date, note }
```

### Check budget status

```
1. GET /api/v1/budgets  →  see amount vs spent (spent is computed server-side and shown in the app UI, not returned by the API directly — use the list to see budget definitions)
```

### Record a loan payment

```
1. GET /api/v1/loans  →  find loan by name, get id
2. POST /api/v1/loans/:id/payment  { date, amount, principalComponent, interestComponent, status:"paid" }
   →  outstandingBalance is automatically updated
```

---

## Error Reference

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Validation error — check `error` field |
| 401 | Unauthorized — session missing or expired, re-authenticate |
| 404 | Not found or not yours |
| 405 | Method not allowed — wrong HTTP verb |

---

## Notes

- All `amount`, `price`, `balance` fields in responses are **strings** (numeric strings like `"150.5000"`) — parse with `parseFloat()` before arithmetic.
- `currency` fields are always **uppercase** (e.g. `"INR"`, `"USD"`).
- Dates are **YYYY-MM-DD** strings.
- Soft-deleted resources return 404 on GET `/:id`.
- Session tokens are JWT-based and last ~30 days. Re-run the auth flow if you get 401.
- The CSRF token step is required — skipping it causes a 403 on sign-in.
