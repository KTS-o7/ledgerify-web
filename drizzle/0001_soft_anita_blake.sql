CREATE TABLE "category_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"keyword" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_balance" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurrence_interval" numeric(5, 0);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurrence_unit" varchar(10);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "parent_recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "period_anchor_date" date;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "rollover" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "category_keywords" ADD CONSTRAINT "category_keywords_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_keywords" ADD CONSTRAINT "category_keywords_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;