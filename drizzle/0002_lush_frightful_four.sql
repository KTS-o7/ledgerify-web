ALTER TYPE "public"."account_type" ADD VALUE 'credit_card';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'credit_payment';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "credit_limit" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "statement_day" numeric(2, 0);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "payment_due_day" numeric(2, 0);