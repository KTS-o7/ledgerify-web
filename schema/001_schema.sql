-- Combined schema from all Drizzle migrations

-- Enums
CREATE TYPE "public"."account_type" AS ENUM('bank', 'wallet', 'cash', 'savings', 'credit_card', 'investment');
CREATE TYPE "public"."category_type" AS ENUM('income', 'expense');
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense', 'transfer', 'credit_payment');
CREATE TYPE "public"."asset_type" AS ENUM('stock', 'mf', 'crypto', 'fd', 'ppf', 'nps', 'gold', 'silver', 'real_estate', 'savings', 'other');
CREATE TYPE "public"."investment_tx_type" AS ENUM('buy', 'sell', 'dividend', 'interest', 'bonus');
CREATE TYPE "public"."loan_type" AS ENUM('home', 'personal', 'vehicle', 'education', 'other');
CREATE TYPE "public"."payment_status" AS ENUM('scheduled', 'paid', 'missed', 'partial');
CREATE TYPE "public"."insurance_payment_status" AS ENUM('paid', 'due', 'missed');
CREATE TYPE "public"."policy_type" AS ENUM('life', 'health', 'vehicle', 'property', 'term', 'other');
CREATE TYPE "public"."premium_frequency" AS ENUM('monthly', 'quarterly', 'annual');
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'abandoned');
CREATE TYPE "public"."period_type" AS ENUM('monthly', 'weekly');
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete');

-- Users
CREATE TABLE "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" varchar(255) NOT NULL,
    "password_hash" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "default_currency" varchar(3) DEFAULT 'INR' NOT NULL,
    "timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz,
    CONSTRAINT "users_email_unique" UNIQUE("email")
);

-- Accounts
CREATE TABLE "accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "type" "account_type" NOT NULL,
    "currency" varchar(3) NOT NULL,
    "opening_balance" numeric(18, 4) DEFAULT '0' NOT NULL,
    "credit_limit" numeric(18, 4),
    "statement_day" numeric(2, 0),
    "payment_due_day" numeric(2, 0),
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Categories
CREATE TABLE "categories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid,
    "name" varchar(255) NOT NULL,
    "type" "category_type" NOT NULL,
    "icon" varchar(64),
    "color" varchar(7),
    "deleted_at" timestamptz
);

-- Tags
CREATE TABLE "tags" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(64) NOT NULL,
    "color" varchar(7)
);

-- Transaction Tags (join table)
CREATE TABLE "transaction_tags" (
    "transaction_id" uuid NOT NULL,
    "tag_id" uuid NOT NULL,
    CONSTRAINT "transaction_tags_transaction_id_tag_id_pk" PRIMARY KEY("transaction_id", "tag_id")
);

-- Transactions
CREATE TABLE "transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "account_id" uuid NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "currency" varchar(3) NOT NULL,
    "converted_amount" numeric(18, 4),
    "base_currency" varchar(3),
    "category_id" uuid,
    "title" varchar(255),
    "note" text,
    "date" date NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurrence_rule" varchar(255),
    "recurrence_interval" numeric(5, 0),
    "recurrence_unit" varchar(10),
    "parent_recurring_id" uuid,
    "transfer_to_id" uuid,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Investments
CREATE TABLE "investments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "asset_type" "asset_type" NOT NULL,
    "currency" varchar(3) NOT NULL,
    "quantity" numeric(18, 8),
    "buy_price" numeric(18, 4),
    "current_price" numeric(18, 4),
    "current_price_updated_at" timestamptz,
    "maturity_date" date,
    "interest_rate" numeric(6, 4),
    "metadata" jsonb,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Investment Transactions
CREATE TABLE "investment_transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "investment_id" uuid NOT NULL,
    "type" "investment_tx_type" NOT NULL,
    "quantity" numeric(18, 8),
    "price" numeric(18, 4),
    "amount" numeric(18, 4) NOT NULL,
    "date" date NOT NULL,
    "note" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Loans
CREATE TABLE "loans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "loan_type" "loan_type" NOT NULL,
    "principal" numeric(18, 4) NOT NULL,
    "interest_rate" numeric(6, 4) NOT NULL,
    "tenure_months" integer NOT NULL,
    "start_date" date NOT NULL,
    "emi_amount" numeric(18, 4) NOT NULL,
    "currency" varchar(3) NOT NULL,
    "outstanding_balance" numeric(18, 4),
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Loan Payments
CREATE TABLE "loan_payments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "loan_id" uuid NOT NULL,
    "date" date NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "principal_component" numeric(18, 4),
    "interest_component" numeric(18, 4),
    "status" "payment_status" DEFAULT 'scheduled' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Insurance Policies
CREATE TABLE "insurance_policies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "provider" varchar(255),
    "policy_type" "policy_type" NOT NULL,
    "premium_amount" numeric(18, 4) NOT NULL,
    "premium_frequency" "premium_frequency" NOT NULL,
    "coverage_amount" numeric(18, 4),
    "currency" varchar(3) NOT NULL,
    "start_date" date NOT NULL,
    "end_date" date,
    "renewal_date" date,
    "nominee" varchar(255),
    "notes" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Insurance Payments
CREATE TABLE "insurance_payments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "policy_id" uuid NOT NULL,
    "date" date NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "status" "insurance_payment_status" NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Budgets
CREATE TABLE "budgets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "category_id" uuid,
    "name" varchar(255) NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "currency" varchar(3) NOT NULL,
    "period_type" "period_type" NOT NULL,
    "start_date" date NOT NULL,
    "end_date" date,
    "period_anchor_date" date,
    "rollover" boolean DEFAULT false NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Savings Goals
CREATE TABLE "savings_goals" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "target_amount" numeric(18, 4) NOT NULL,
    "currency" varchar(3) NOT NULL,
    "current_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
    "linked_account_id" uuid,
    "deadline" date,
    "status" "goal_status" DEFAULT 'active' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

-- Exchange Rates
CREATE TABLE "exchange_rates" (
    "base" varchar(3) NOT NULL,
    "target" varchar(3) NOT NULL,
    "rate" numeric(18, 8) NOT NULL,
    "fetched_at" timestamptz NOT NULL,
    CONSTRAINT "exchange_rates_base_target_pk" PRIMARY KEY("base", "target")
);

-- Audit Logs
CREATE TABLE "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid,
    "entity_type" varchar(64) NOT NULL,
    "entity_id" uuid NOT NULL,
    "action" "audit_action" NOT NULL,
    "old_value" jsonb,
    "new_value" jsonb,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Category Keywords (for auto-categorisation)
CREATE TABLE "category_keywords" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "category_id" uuid NOT NULL,
    "keyword" varchar(100) NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Foreign keys
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_to_id_accounts_id_fk" FOREIGN KEY ("transfer_to_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "insurance_payments" ADD CONSTRAINT "insurance_payments_policy_id_insurance_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "category_keywords" ADD CONSTRAINT "category_keywords_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "category_keywords" ADD CONSTRAINT "category_keywords_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
