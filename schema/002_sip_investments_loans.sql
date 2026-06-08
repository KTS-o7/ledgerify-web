BEGIN;

CREATE TYPE compounding_frequency AS ENUM (
    'monthly', 'quarterly', 'semi_annual', 'annual'
);

CREATE TYPE sip_type AS ENUM (
    'equity', 'debt', 'hybrid', 'other'
);

ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS compounding_frequency compounding_frequency,
    ADD COLUMN IF NOT EXISTS computed_value numeric(18,4);

CREATE TABLE IF NOT EXISTS sips (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id),
    name                varchar(255) NOT NULL,
    sip_type            sip_type NOT NULL DEFAULT 'equity',
    currency            varchar(3) NOT NULL DEFAULT 'INR',
    monthly_amount      numeric(18,4) NOT NULL,
    start_date          date NOT NULL,
    expected_return_rate numeric(6,4),
    current_nav         numeric(18,4),
    units_accumulated   numeric(18,8),
    corpus_value        numeric(18,4),
    corpus_updated_at   timestamptz,
    metadata            jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);

ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS computed_emi numeric(18,4);

CREATE INDEX IF NOT EXISTS idx_investments_user_active
    ON investments(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sips_user_active
    ON sips(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_loans_user_active
    ON loans(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan
    ON loan_payments(loan_id);

COMMIT;
