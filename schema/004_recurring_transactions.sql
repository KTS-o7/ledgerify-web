-- Recurrence status enum
CREATE TYPE "public"."recurrence_status" AS ENUM('active', 'paused');

-- Recurring transactions rules table
CREATE TABLE "recurring_transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "currency" varchar(3) NOT NULL,
    "account_id" uuid NOT NULL,
    "category_id" uuid,
    "transfer_to_id" uuid,
    "title" varchar(255),
    "note" text,
    "frequency" varchar(16) NOT NULL,
    "interval_value" numeric(5, 0),
    "interval_unit" varchar(16),
    "start_date" date NOT NULL,
    "end_date" date,
    "next_due_date" date NOT NULL,
    "last_generated_date" date,
    "status" "recurrence_status" DEFAULT 'active' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "deleted_at" timestamptz
);

CREATE INDEX "recurring_user_status_idx" ON "recurring_transactions" ("user_id", "status");
CREATE INDEX "recurring_next_due_idx" ON "recurring_transactions" ("next_due_date");