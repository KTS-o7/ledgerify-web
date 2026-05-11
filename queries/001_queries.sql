-- Users
-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, name, default_currency, timezone)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: UpdateUser :one
UPDATE users SET name = $2, default_currency = $3, timezone = $4, updated_at = now()
WHERE id = $1 AND deleted_at IS NULL RETURNING *;

-- name: DeleteUser :exec
UPDATE users SET deleted_at = now() WHERE id = $1;

-- Accounts
-- name: ListAccountsByUser :many
SELECT * FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC;

-- name: GetAccountByID :one
SELECT * FROM accounts WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateAccount :one
INSERT INTO accounts (user_id, name, type, currency, opening_balance, credit_limit, statement_day, payment_due_day)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;

-- name: UpdateAccount :one
UPDATE accounts SET name = $2, type = $3, currency = $4, opening_balance = $5, credit_limit = $6, statement_day = $7, payment_due_day = $8, updated_at = now()
WHERE id = $1 AND user_id = $9 AND deleted_at IS NULL RETURNING *;

-- name: DeleteAccount :exec
UPDATE accounts SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Categories
-- name: ListCategoriesByUser :many
SELECT * FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL ORDER BY name;

-- name: GetCategoryByID :one
SELECT * FROM categories WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateCategory :one
INSERT INTO categories (user_id, name, type, icon, color)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: UpdateCategory :one
UPDATE categories SET name = $2, type = $3, icon = $4, color = $5
WHERE id = $1 AND user_id = $6 AND deleted_at IS NULL RETURNING *;

-- name: DeleteCategory :exec
UPDATE categories SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Category Keywords (for auto-categorisation)
-- name: ListCategoryKeywordsByUser :many
SELECT ck.*, c.name as category_name FROM category_keywords ck
JOIN categories c ON c.id = ck.category_id
WHERE ck.user_id = $1 ORDER BY ck.keyword;

-- name: CreateCategoryKeyword :one
INSERT INTO category_keywords (user_id, category_id, keyword)
VALUES ($1, $2, $3) RETURNING *;

-- name: DeleteCategoryKeyword :exec
DELETE FROM category_keywords WHERE id = $1 AND user_id = $2;

-- Transactions
-- name: ListTransactionsByUser :many
SELECT t.*, a.name as account_name, c.name as category_name,
  COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color))
    FILTER (WHERE tg.id IS NOT NULL), '[]') as tags
FROM transactions t
JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN transaction_tags tt ON tt.transaction_id = t.id
LEFT JOIN tags tg ON tg.id = tt.tag_id
WHERE t.user_id = $1 AND t.deleted_at IS NULL
  AND (sqlc.narg('type')::text IS NULL OR t.type::text = sqlc.narg('type'))
  AND (sqlc.narg('account_id')::uuid IS NULL OR t.account_id = sqlc.narg('account_id'))
  AND (sqlc.narg('from_date')::date IS NULL OR t.date >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date')::date IS NULL OR t.date <= sqlc.narg('to_date'))
GROUP BY t.id, a.name, c.name
ORDER BY t.date DESC
LIMIT sqlc.narg('limit_rows')::int;

-- name: GetTransactionByID :one
SELECT t.*, a.name as account_name, c.name as category_name
FROM transactions t
JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.id = $1 AND t.deleted_at IS NULL;

-- name: CreateTransaction :one
INSERT INTO transactions (user_id, account_id, type, amount, currency, converted_amount, base_currency, category_id, title, note, date, is_recurring, recurrence_rule, recurrence_interval, recurrence_unit, parent_recurring_id, transfer_to_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *;

-- name: UpdateTransaction :one
UPDATE transactions SET account_id = $2, type = $3, amount = $4, currency = $5,
  converted_amount = $6, base_currency = $7, category_id = $8, title = $9, note = $10,
  date = $11, is_recurring = $12, updated_at = now()
WHERE id = $1 AND user_id = $13 AND deleted_at IS NULL RETURNING *;

-- name: DeleteTransaction :exec
UPDATE transactions SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- name: GetTransactionTags :many
SELECT tg.* FROM tags tg
JOIN transaction_tags tt ON tt.tag_id = tg.id
WHERE tt.transaction_id = $1;

-- name: SetTransactionTags :exec
DELETE FROM transaction_tags WHERE transaction_id = $1;
INSERT INTO transaction_tags (transaction_id, tag_id)
SELECT $1, unnest($2::uuid[]);

-- Tags
-- name: ListTagsByUser :many
SELECT * FROM tags WHERE user_id = $1 ORDER BY name;

-- name: CreateTag :one
INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) RETURNING *;

-- name: GetTagByID :one
SELECT * FROM tags WHERE id = $1 AND user_id = $2;

-- name: UpdateTag :one
UPDATE tags SET name = $3, color = $4 WHERE id = $1 AND user_id = $2 RETURNING *;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = $1 AND user_id = $2;

-- Investments
-- name: ListInvestmentsByUser :many
SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name;

-- name: GetInvestmentByID :one
SELECT * FROM investments WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateInvestment :one
INSERT INTO investments (user_id, name, asset_type, currency, quantity, buy_price, current_price, current_price_updated_at, maturity_date, interest_rate, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;

-- name: UpdateInvestment :one
UPDATE investments SET name = $2, asset_type = $3, currency = $4, quantity = $5,
  buy_price = $6, current_price = $7, current_price_updated_at = $8, maturity_date = $9,
  interest_rate = $10, metadata = $11, updated_at = now()
WHERE id = $1 AND user_id = $12 AND deleted_at IS NULL RETURNING *;

-- name: DeleteInvestment :exec
UPDATE investments SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Investment Transactions
-- name: ListInvestmentTxByInvestment :many
SELECT * FROM investment_transactions WHERE investment_id = $1 AND deleted_at IS NULL ORDER BY date DESC;

-- name: CreateInvestmentTx :one
INSERT INTO investment_transactions (investment_id, type, quantity, price, amount, date, note)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- Loans
-- name: ListLoansByUser :many
SELECT * FROM loans WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name;

-- name: GetLoanByID :one
SELECT * FROM loans WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateLoan :one
INSERT INTO loans (user_id, name, loan_type, principal, interest_rate, tenure_months, start_date, emi_amount, currency, outstanding_balance)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: UpdateLoan :one
UPDATE loans SET name = $2, loan_type = $3, principal = $4, interest_rate = $5,
  tenure_months = $6, start_date = $7, emi_amount = $8, currency = $9,
  outstanding_balance = $10, updated_at = now()
WHERE id = $1 AND user_id = $11 AND deleted_at IS NULL RETURNING *;

-- name: DeleteLoan :exec
UPDATE loans SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Loan Payments
-- name: ListLoanPayments :many
SELECT * FROM loan_payments WHERE loan_id = $1 AND deleted_at IS NULL ORDER BY date DESC;

-- name: CreateLoanPayment :one
INSERT INTO loan_payments (loan_id, date, amount, principal_component, interest_component, status)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- Insurance Policies
-- name: ListInsurancePoliciesByUser :many
SELECT * FROM insurance_policies WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name;

-- name: GetInsurancePolicyByID :one
SELECT * FROM insurance_policies WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateInsurancePolicy :one
INSERT INTO insurance_policies (user_id, name, provider, policy_type, premium_amount, premium_frequency, coverage_amount, currency, start_date, end_date, renewal_date, nominee, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *;

-- name: UpdateInsurancePolicy :one
UPDATE insurance_policies SET name = $2, provider = $3, policy_type = $4, premium_amount = $5,
  premium_frequency = $6, coverage_amount = $7, currency = $8, start_date = $9,
  end_date = $10, renewal_date = $11, nominee = $12, notes = $13, updated_at = now()
WHERE id = $1 AND user_id = $14 AND deleted_at IS NULL RETURNING *;

-- name: DeleteInsurancePolicy :exec
UPDATE insurance_policies SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Insurance Payments
-- name: ListInsurancePayments :many
SELECT * FROM insurance_payments WHERE policy_id = $1 AND deleted_at IS NULL ORDER BY date DESC;

-- name: CreateInsurancePayment :one
INSERT INTO insurance_payments (policy_id, date, amount, status)
VALUES ($1, $2, $3, $4) RETURNING *;

-- Budgets
-- name: ListBudgetsByUser :many
SELECT b.*, c.name as category_name, c.color as category_color
FROM budgets b
LEFT JOIN categories c ON c.id = b.category_id
WHERE b.user_id = $1 AND b.deleted_at IS NULL ORDER BY b.name;

-- name: GetBudgetByID :one
SELECT * FROM budgets WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateBudget :one
INSERT INTO budgets (user_id, category_id, name, amount, currency, period_type, start_date, end_date, period_anchor_date, rollover)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: UpdateBudget :one
UPDATE budgets SET category_id = $2, name = $3, amount = $4, currency = $5,
  period_type = $6, start_date = $7, end_date = $8, period_anchor_date = $9,
  rollover = $10, updated_at = now()
WHERE id = $1 AND user_id = $11 AND deleted_at IS NULL RETURNING *;

-- name: DeleteBudget :exec
UPDATE budgets SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Savings Goals
-- name: ListSavingsGoalsByUser :many
SELECT * FROM savings_goals WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC;

-- name: CreateSavingsGoal :one
INSERT INTO savings_goals (user_id, name, description, target_amount, currency, current_amount, linked_account_id, deadline, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: UpdateSavingsGoal :one
UPDATE savings_goals SET name = $2, description = $3, target_amount = $4, currency = $5,
  current_amount = $6, linked_account_id = $7, deadline = $8, status = $9, updated_at = now()
WHERE id = $1 AND user_id = $10 AND deleted_at IS NULL RETURNING *;

-- name: GetSavingsGoalByID :one
SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: DeleteSavingsGoal :exec
UPDATE savings_goals SET deleted_at = now() WHERE id = $1 AND user_id = $2;

-- Exchange Rates
-- name: UpsertExchangeRate :exec
INSERT INTO exchange_rates (base, target, rate, fetched_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (base, target) DO UPDATE SET rate = $3, fetched_at = $4;

-- name: GetExchangeRate :one
SELECT * FROM exchange_rates WHERE base = $1 AND target = $2;

-- name: ListExchangeRates :many
SELECT * FROM exchange_rates ORDER BY base, target;

-- Summary / aggregation queries
-- name: GetTransactionsByDateRange :many
SELECT t.*, a.name as account_name, c.name as category_name
FROM transactions t
JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1 AND t.deleted_at IS NULL
  AND t.date >= $2 AND t.date <= $3
ORDER BY t.date DESC;

-- name: GetExpensesByPeriod :many
SELECT t.*, c.name as category_name
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.type = 'expense'
  AND t.date >= $2 AND t.date <= $3
ORDER BY t.date;

-- name: GetIncomeByPeriod :many
SELECT t.*, c.name as category_name
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.type = 'income'
  AND t.date >= $2 AND t.date <= $3
ORDER BY t.date;


