# Ledgerify Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack personal finance tracker (income, expenses, investments, loans, insurance, budgets, networth) hosted on a VPS at money.shenthar.me

**Architecture:** Next.js 16 App Router monolith with Server Actions for mutations and Route Handlers for APIs. PostgreSQL via Drizzle ORM in Docker. Auth.js v5 for session auth. nginx reverse proxy with TLS on VPS.

**Tech Stack:** Next.js 16.2, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts, Auth.js v5, Drizzle ORM, PostgreSQL 17, Zod, Docker Compose, GitHub Actions

---

## Phase 1: Project Scaffold

### Task 1.1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`

**Step 1: Scaffold the project**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --turbopack
```

**Step 2: Verify it runs**

```bash
npm run dev
```
Expected: Server starts on localhost:3000, default Next.js page loads.

**Step 3: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 16 project with App Router and TypeScript"
```

---

### Task 1.2: Install core dependencies

**Step 1: Install dependencies**

```bash
# ORM + DB
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Auth
npm install next-auth@beta

# Validation
npm install zod

# UI
npm install @radix-ui/react-icons lucide-react clsx tailwind-merge class-variance-authority

# Charts
npm install recharts

# CSV parsing
npm install papaparse
npm install -D @types/papaparse

# Date handling
npm install date-fns

# Misc
npm install nanoid
```

**Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init
```
Choose: Default style, Zinc base color, CSS variables yes.

**Step 3: Add essential shadcn components**

```bash
npx shadcn@latest add button input label card table dialog drawer sheet tabs select badge skeleton toast sonner form
```

**Step 4: Verify build**

```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: install core dependencies and shadcn/ui"
```

---

### Task 1.3: Project folder structure

**Files to create:**

```
src/
  app/                        # Next.js App Router pages
  components/
    ui/                       # shadcn auto-generated
    shared/                   # shared layout components
    dashboard/
    transactions/
    investments/
    loans/
    insurance/
    budgets/
    reports/
    settings/
  lib/
    db/
      index.ts                # Drizzle client
      schema/                 # one file per domain
    auth/
      config.ts               # Auth.js config
    validations/              # Zod schemas
    utils/
      currency.ts             # formatting + conversion helpers
      date.ts                 # date helpers
      csv.ts                  # CSV template helpers
  hooks/                      # custom React hooks
  types/                      # shared TypeScript types
```

**Step 1: Create the folder structure**

```bash
mkdir -p src/components/{shared,dashboard,transactions,investments,loans,insurance,budgets,reports,settings}
mkdir -p src/lib/{db/schema,auth,validations,utils}
mkdir -p src/hooks src/types
```

**Step 2: Create placeholder index files**

```bash
touch src/lib/db/index.ts
touch src/lib/auth/config.ts
touch src/lib/utils/currency.ts
touch src/lib/utils/date.ts
touch src/lib/utils/csv.ts
```

**Step 3: Commit**

```bash
git add .
git commit -m "chore: establish project folder structure"
```

---

### Task 1.4: Environment variables

**Files:**
- Create: `.env.local` (never commit)
- Create: `.env.example` (commit this)

**Step 1: Create `.env.example`**

```bash
# Database
DATABASE_URL=postgresql://ledgerify:password@localhost:5432/ledgerify

# Auth
AUTH_SECRET=                  # generate with: openssl rand -base64 32
AUTH_URL=http://localhost:3000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=                  # generate with: openssl rand -base64 32
```

**Step 2: Create `.env.local` with real values**

```bash
cp .env.example .env.local
# Fill in real values — never commit .env.local
```

**Step 3: Verify `.env.local` is in `.gitignore`**

```bash
grep ".env.local" .gitignore
```
Expected: `.env.local` appears in output.

**Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add environment variable template"
```

---

## Phase 2: Database + Drizzle Schema

### Task 2.1: Docker Compose for local development

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ledgerify
      POSTGRES_USER: ledgerify
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  pg_data:
```

**Step 2: Start postgres**

```bash
docker compose up -d postgres
```
Expected: Container starts, postgres accepting connections on 5432.

**Step 3: Verify connection**

```bash
docker compose exec postgres psql -U ledgerify -c "\l"
```
Expected: `ledgerify` database listed.

**Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add Docker Compose for local postgres"
```

---

### Task 2.2: Drizzle client setup

**Files:**
- Create: `src/lib/db/index.ts`
- Create: `drizzle.config.ts`

**Step 1: Create `src/lib/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
export type DB = typeof db
```

**Step 2: Create `drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

**Step 3: Add db scripts to `package.json`**

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"db:push": "drizzle-kit push"
```

**Step 4: Commit**

```bash
git add src/lib/db/index.ts drizzle.config.ts package.json
git commit -m "chore: configure Drizzle ORM client"
```

---

### Task 2.3: Write schema — users, accounts, categories, tags

**Files:**
- Create: `src/lib/db/schema/users.ts`
- Create: `src/lib/db/schema/accounts.ts`
- Create: `src/lib/db/schema/categories.ts`
- Create: `src/lib/db/schema/tags.ts`
- Create: `src/lib/db/schema/index.ts`

**Step 1: Create `src/lib/db/schema/users.ts`**

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('INR'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Kolkata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

**Step 2: Create `src/lib/db/schema/accounts.ts`**

```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const accountTypeEnum = pgEnum('account_type', ['bank', 'wallet', 'cash', 'savings'])

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
```

**Step 3: Create `src/lib/db/schema/categories.ts`**

```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense'])

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: categoryTypeEnum('type').notNull(),
  icon: varchar('icon', { length: 64 }),
  color: varchar('color', { length: 7 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
```

**Step 4: Create `src/lib/db/schema/tags.ts`**

```typescript
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 64 }).notNull(),
  color: varchar('color', { length: 7 }),
})

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
```

**Step 5: Create `src/lib/db/schema/index.ts`**

```typescript
export * from './users'
export * from './accounts'
export * from './categories'
export * from './tags'
```

**Step 6: Commit**

```bash
git add src/lib/db/schema/
git commit -m "feat(db): add users, accounts, categories, tags schema"
```

---

### Task 2.4: Write schema — transactions

**Files:**
- Create: `src/lib/db/schema/transactions.ts`

**Step 1: Create `src/lib/db/schema/transactions.ts`**

```typescript
import { pgTable, uuid, varchar, numeric, boolean, date, timestamp, pgEnum, text, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { accounts } from './accounts'
import { categories } from './categories'
import { tags } from './tags'

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer'])

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  convertedAmount: numeric('converted_amount', { precision: 18, scale: 4 }),
  baseCurrency: varchar('base_currency', { length: 3 }),
  categoryId: uuid('category_id').references(() => categories.id),
  note: text('note'),
  date: date('date').notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurrenceRule: varchar('recurrence_rule', { length: 255 }),
  transferToId: uuid('transfer_to_id').references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const transactionTags = pgTable('transaction_tags', {
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  tagId: uuid('tag_id').notNull().references(() => tags.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.transactionId, t.tagId] }),
}))

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
```

**Step 2: Update `src/lib/db/schema/index.ts`**

```typescript
export * from './users'
export * from './accounts'
export * from './categories'
export * from './tags'
export * from './transactions'
```

**Step 3: Commit**

```bash
git add src/lib/db/schema/transactions.ts src/lib/db/schema/index.ts
git commit -m "feat(db): add transactions and transaction_tags schema"
```

---

### Task 2.5: Write schema — investments, loans, insurance

**Files:**
- Create: `src/lib/db/schema/investments.ts`
- Create: `src/lib/db/schema/loans.ts`
- Create: `src/lib/db/schema/insurance.ts`

**Step 1: Create `src/lib/db/schema/investments.ts`**

```typescript
import { pgTable, uuid, varchar, numeric, date, timestamp, pgEnum, jsonb, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const assetTypeEnum = pgEnum('asset_type', [
  'stock', 'mf', 'crypto', 'fd', 'ppf', 'nps', 'gold', 'silver', 'real_estate', 'savings', 'other'
])
export const investmentTxTypeEnum = pgEnum('investment_tx_type', ['buy', 'sell', 'dividend', 'interest', 'bonus'])

export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  assetType: assetTypeEnum('asset_type').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }),
  buyPrice: numeric('buy_price', { precision: 18, scale: 4 }),
  currentPrice: numeric('current_price', { precision: 18, scale: 4 }),
  currentPriceUpdatedAt: timestamp('current_price_updated_at', { withTimezone: true }),
  maturityDate: date('maturity_date'),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const investmentTransactions = pgTable('investment_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  investmentId: uuid('investment_id').notNull().references(() => investments.id),
  type: investmentTxTypeEnum('type').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }),
  price: numeric('price', { precision: 18, scale: 4 }),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  date: date('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Investment = typeof investments.$inferSelect
export type NewInvestment = typeof investments.$inferInsert
```

**Step 2: Create `src/lib/db/schema/loans.ts`**

```typescript
import { pgTable, uuid, varchar, numeric, integer, date, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const loanTypeEnum = pgEnum('loan_type', ['home', 'personal', 'vehicle', 'education', 'other'])
export const paymentStatusEnum = pgEnum('payment_status', ['scheduled', 'paid', 'missed', 'partial'])

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  loanType: loanTypeEnum('loan_type').notNull(),
  principal: numeric('principal', { precision: 18, scale: 4 }).notNull(),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).notNull(),
  tenureMonths: integer('tenure_months').notNull(),
  startDate: date('start_date').notNull(),
  emiAmount: numeric('emi_amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  outstandingBalance: numeric('outstanding_balance', { precision: 18, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const loanPayments = pgTable('loan_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  principalComponent: numeric('principal_component', { precision: 18, scale: 4 }),
  interestComponent: numeric('interest_component', { precision: 18, scale: 4 }),
  status: paymentStatusEnum('status').notNull().default('scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Loan = typeof loans.$inferSelect
export type NewLoan = typeof loans.$inferInsert
```

**Step 3: Create `src/lib/db/schema/insurance.ts`**

```typescript
import { pgTable, uuid, varchar, numeric, date, timestamp, pgEnum, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const policyTypeEnum = pgEnum('policy_type', ['life', 'health', 'vehicle', 'property', 'term', 'other'])
export const premiumFrequencyEnum = pgEnum('premium_frequency', ['monthly', 'quarterly', 'annual'])
export const insurancePaymentStatusEnum = pgEnum('insurance_payment_status', ['paid', 'due', 'missed'])

export const insurancePolicies = pgTable('insurance_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }),
  policyType: policyTypeEnum('policy_type').notNull(),
  premiumAmount: numeric('premium_amount', { precision: 18, scale: 4 }).notNull(),
  premiumFrequency: premiumFrequencyEnum('premium_frequency').notNull(),
  coverageAmount: numeric('coverage_amount', { precision: 18, scale: 4 }),
  currency: varchar('currency', { length: 3 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  renewalDate: date('renewal_date'),
  nominee: varchar('nominee', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const insurancePayments = pgTable('insurance_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => insurancePolicies.id),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  status: insurancePaymentStatusEnum('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type InsurancePolicy = typeof insurancePolicies.$inferSelect
export type NewInsurancePolicy = typeof insurancePolicies.$inferInsert
```

**Step 4: Update `src/lib/db/schema/index.ts`**

```typescript
export * from './users'
export * from './accounts'
export * from './categories'
export * from './tags'
export * from './transactions'
export * from './investments'
export * from './loans'
export * from './insurance'
```

**Step 5: Commit**

```bash
git add src/lib/db/schema/
git commit -m "feat(db): add investments, loans, insurance schema"
```

---

### Task 2.6: Write schema — budgets, savings goals, exchange rates, audit logs

**Files:**
- Create: `src/lib/db/schema/budgets.ts`
- Create: `src/lib/db/schema/exchangeRates.ts`
- Create: `src/lib/db/schema/auditLogs.ts`

**Step 1: Create `src/lib/db/schema/budgets.ts`**

```typescript
import { pgTable, uuid, varchar, numeric, date, timestamp, pgEnum, text } from 'drizzle-orm/pg-core'
import { users } from './users'
import { categories } from './categories'
import { accounts } from './accounts'

export const periodTypeEnum = pgEnum('period_type', ['monthly', 'weekly'])
export const goalStatusEnum = pgEnum('goal_status', ['active', 'achieved', 'abandoned'])

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  categoryId: uuid('category_id').references(() => categories.id),
  name: varchar('name', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  periodType: periodTypeEnum('period_type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const savingsGoals = pgTable('savings_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  targetAmount: numeric('target_amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  linkedAccountId: uuid('linked_account_id').references(() => accounts.id),
  deadline: date('deadline'),
  status: goalStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Budget = typeof budgets.$inferSelect
export type SavingsGoal = typeof savingsGoals.$inferSelect
```

**Step 2: Create `src/lib/db/schema/exchangeRates.ts`**

```typescript
import { pgTable, varchar, numeric, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const exchangeRates = pgTable('exchange_rates', {
  base: varchar('base', { length: 3 }).notNull(),
  target: varchar('target', { length: 3 }).notNull(),
  rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.base, t.target] }),
}))

export type ExchangeRate = typeof exchangeRates.$inferSelect
```

**Step 3: Create `src/lib/db/schema/auditLogs.ts`**

```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete'])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: auditActionEnum('action').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Step 4: Final `src/lib/db/schema/index.ts`**

```typescript
export * from './users'
export * from './accounts'
export * from './categories'
export * from './tags'
export * from './transactions'
export * from './investments'
export * from './loans'
export * from './insurance'
export * from './budgets'
export * from './exchangeRates'
export * from './auditLogs'
```

**Step 5: Generate and run migrations**

```bash
npm run db:generate
npm run db:migrate
```
Expected: Migration files created in `./drizzle/`, all tables created in postgres.

**Step 6: Verify in Drizzle Studio**

```bash
npm run db:studio
```
Expected: All 15 tables visible.

**Step 7: Commit**

```bash
git add src/lib/db/schema/ drizzle/ package.json
git commit -m "feat(db): complete schema — budgets, goals, exchange rates, audit logs + migrations"
```

---

## Phase 3: Auth

### Task 3.1: Auth.js v5 config

**Files:**
- Create: `src/lib/auth/config.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

**Step 1: Create `src/lib/auth/config.ts`**

```typescript
import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        })
        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
}
```

**Step 2: Install bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Step 3: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/config'

const { handlers } = NextAuth(authConfig)
export const { GET, POST } = handlers
```

**Step 4: Create `src/middleware.ts`**

```typescript
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/config'

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ['/((?!api/auth|auth|_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 5: Commit**

```bash
git add src/lib/auth/ src/app/api/auth/ src/middleware.ts
git commit -m "feat(auth): add Auth.js v5 credentials provider with JWT sessions"
```

---

### Task 3.2: Login and Register pages

**Files:**
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/register/page.tsx`
- Create: `src/app/actions/auth.ts`

**Step 1: Create `src/app/actions/auth.ts`**

```typescript
'use server'
import { signIn } from 'next-auth/react'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function registerUser(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid input' }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (existing) return { error: 'Email already registered' }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  })

  redirect('/auth/login')
}
```

**Step 2: Create `src/app/auth/login/page.tsx`**

```typescript
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      redirect: false,
    })
    if (res?.error) setError('Invalid email or password')
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Ledgerify</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Create `src/app/auth/register/page.tsx`** — mirror login page but call `registerUser` server action.

**Step 4: Verify auth flow**

```bash
npm run dev
```
- Visit `/auth/register` → create a user
- Visit `/auth/login` → sign in
- Confirm redirect to `/dashboard`
- Visit `/` unauthenticated → confirm redirect to `/auth/login`

**Step 5: Commit**

```bash
git add src/app/auth/ src/app/actions/auth.ts
git commit -m "feat(auth): add login and register pages"
```

---

## Phase 4: Transactions Module

### Task 4.1: Zod schemas + currency util

**Files:**
- Create: `src/lib/validations/transaction.ts`
- Create: `src/lib/utils/currency.ts`

**Step 1: Create `src/lib/validations/transaction.ts`**

```typescript
import { z } from 'zod'

export const transactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  categoryId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
  transferToId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
})

export type TransactionInput = z.infer<typeof transactionSchema>
```

**Step 2: Create `src/lib/utils/currency.ts`**

```typescript
import { db } from '@/lib/db'
import { exchangeRates } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function getRate(base: string, target: string): Promise<number> {
  if (base === target) return 1
  const row = await db.query.exchangeRates.findFirst({
    where: and(eq(exchangeRates.base, base), eq(exchangeRates.target, target)),
  })
  return row ? Number(row.rate) : 1
}

export function formatCurrency(amount: number, currency: string, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}
```

**Step 3: Commit**

```bash
git add src/lib/validations/transaction.ts src/lib/utils/currency.ts
git commit -m "feat(transactions): add Zod schema and currency utils"
```

---

### Task 4.2: Transaction server actions

**Files:**
- Create: `src/app/actions/transactions.ts`

**Step 1: Create `src/app/actions/transactions.ts`**

```typescript
'use server'
import { auth } from 'next-auth'
import { db } from '@/lib/db'
import { transactions, transactionTags } from '@/lib/db/schema'
import { transactionSchema } from '@/lib/validations/transaction'
import { getRate } from '@/lib/utils/currency'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createTransaction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = transactionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  const { tagIds, ...data } = parsed.data
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, session.user.id!) })
  const rate = await getRate(data.currency, user?.defaultCurrency ?? 'INR')

  const [tx] = await db.insert(transactions).values({
    ...data,
    userId: session.user.id,
    amount: String(data.amount),
    convertedAmount: String(data.amount * rate),
    baseCurrency: user?.defaultCurrency ?? 'INR',
  }).returning()

  if (tagIds.length > 0) {
    await db.insert(transactionTags).values(tagIds.map(tagId => ({ transactionId: tx.id, tagId })))
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  await db.update(transactions)
    .set({ deletedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)))

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}
```

**Step 2: Commit**

```bash
git add src/app/actions/transactions.ts
git commit -m "feat(transactions): add create and delete server actions"
```

---

### Task 4.3: Transactions list page

**Files:**
- Create: `src/app/(app)/transactions/page.tsx`
- Create: `src/app/(app)/layout.tsx`

**Step 1: Create the authenticated layout `src/app/(app)/layout.tsx`**

```typescript
import { auth } from 'next-auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shared/Sidebar'
import { BottomNav } from '@/components/shared/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav className="md:hidden" />
    </div>
  )
}
```

**Step 2: Create `src/app/(app)/transactions/page.tsx`**

```typescript
import { db } from '@/lib/db'
import { transactions, categories, accounts } from '@/lib/db/schema'
import { auth } from 'next-auth'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { TransactionList } from '@/components/transactions/TransactionList'

export default async function TransactionsPage() {
  const session = await auth()
  const data = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, session!.user!.id!), isNull(transactions.deletedAt)),
    with: { category: true, account: true },
    orderBy: [desc(transactions.date)],
    limit: 50,
  })
  return <TransactionList transactions={data} />
}
```

**Step 3: Create `src/components/transactions/TransactionList.tsx`** — client component rendering a table of transactions with delete action button per row.

**Step 4: Create `src/app/(app)/transactions/new/page.tsx`** — form page using `createTransaction` server action, fields: account, type, amount, currency, category, date, note, tags.

**Step 5: Verify**

```bash
npm run dev
```
- Log in → navigate to `/transactions` → list renders
- Click add → fill form → submit → transaction appears in list

**Step 6: Commit**

```bash
git add src/app/\(app\)/ src/components/transactions/
git commit -m "feat(transactions): add transactions list and new transaction page"
```

---

## Phase 5: Investments Module

### Task 5.1: Investment server actions

**Files:**
- Create: `src/lib/validations/investment.ts`
- Create: `src/app/actions/investments.ts`

**Step 1: Create `src/lib/validations/investment.ts`**

```typescript
import { z } from 'zod'

export const investmentSchema = z.object({
  name: z.string().min(1),
  assetType: z.enum(['stock','mf','crypto','fd','ppf','nps','gold','silver','real_estate','savings','other']),
  currency: z.string().length(3),
  quantity: z.coerce.number().optional(),
  buyPrice: z.coerce.number().optional(),
  currentPrice: z.coerce.number().optional(),
  maturityDate: z.string().optional(),
  interestRate: z.coerce.number().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const investmentTxSchema = z.object({
  investmentId: z.string().uuid(),
  type: z.enum(['buy','sell','dividend','interest','bonus']),
  quantity: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  amount: z.coerce.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})
```

**Step 2: Create `src/app/actions/investments.ts`**

```typescript
'use server'
import { auth } from 'next-auth'
import { db } from '@/lib/db'
import { investments, investmentTransactions } from '@/lib/db/schema'
import { investmentSchema, investmentTxSchema } from '@/lib/validations/investment'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createInvestment(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = investmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  await db.insert(investments).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/investments')
  return { success: true }
}

export async function addInvestmentTransaction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = investmentTxSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  // verify ownership
  const inv = await db.query.investments.findFirst({
    where: and(eq(investments.id, parsed.data.investmentId), eq(investments.userId, session.user.id)),
  })
  if (!inv) return { error: 'Not found' }

  await db.insert(investmentTransactions).values(parsed.data)
  revalidatePath(`/investments/${parsed.data.investmentId}`)
  return { success: true }
}

export async function updateInvestmentPrice(id: string, currentPrice: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  await db.update(investments)
    .set({ currentPrice: String(currentPrice), currentPriceUpdatedAt: new Date() })
    .where(and(eq(investments.id, id), eq(investments.userId, session.user.id)))

  revalidatePath('/investments')
  return { success: true }
}
```

**Step 3: Commit**

```bash
git add src/lib/validations/investment.ts src/app/actions/investments.ts
git commit -m "feat(investments): add investment server actions"
```

---

### Task 5.2: Investments pages

**Files:**
- Create: `src/app/(app)/investments/page.tsx`
- Create: `src/app/(app)/investments/[id]/page.tsx`
- Create: `src/components/investments/PortfolioSummary.tsx`
- Create: `src/components/investments/AssetCard.tsx`

**Step 1: Create `src/app/(app)/investments/page.tsx`**

```typescript
import { db } from '@/lib/db'
import { investments } from '@/lib/db/schema'
import { auth } from 'next-auth'
import { eq, and, isNull } from 'drizzle-orm'
import { PortfolioSummary } from '@/components/investments/PortfolioSummary'
import { AssetCard } from '@/components/investments/AssetCard'

export default async function InvestmentsPage() {
  const session = await auth()
  const data = await db.query.investments.findMany({
    where: and(eq(investments.userId, session!.user!.id!), isNull(investments.deletedAt)),
    with: { investmentTransactions: true },
  })
  return (
    <div className="p-4 space-y-6">
      <PortfolioSummary investments={data} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map(inv => <AssetCard key={inv.id} investment={inv} />)}
      </div>
    </div>
  )
}
```

**Step 2: `PortfolioSummary`** — shows total invested, current value, overall P&L (amount + %) using Recharts area chart for value over time.

**Step 3: `AssetCard`** — shows asset name, type badge, current value, P&L chip (green/red), last price update time.

**Step 4: Create `src/app/(app)/investments/[id]/page.tsx`** — detail view with transaction history table and a line chart of price over time using `investmentTransactions`.

**Step 5: Commit**

```bash
git add src/app/\(app\)/investments/ src/components/investments/
git commit -m "feat(investments): add portfolio overview and asset detail pages"
```

---

## Phase 6: Loans + Insurance

### Task 6.1: Loan server actions + pages

**Files:**
- Create: `src/lib/validations/loan.ts`
- Create: `src/app/actions/loans.ts`
- Create: `src/app/(app)/loans/page.tsx`
- Create: `src/app/(app)/loans/[id]/page.tsx`

**Step 1: Create `src/lib/validations/loan.ts`**

```typescript
import { z } from 'zod'

export const loanSchema = z.object({
  name: z.string().min(1),
  loanType: z.enum(['home','personal','vehicle','education','other']),
  principal: z.coerce.number().positive(),
  interestRate: z.coerce.number().positive(),
  tenureMonths: z.coerce.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emiAmount: z.coerce.number().positive(),
  currency: z.string().length(3),
})

export const loanPaymentSchema = z.object({
  loanId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  principalComponent: z.coerce.number().optional(),
  interestComponent: z.coerce.number().optional(),
  status: z.enum(['scheduled','paid','missed','partial']),
})
```

**Step 2: Create `src/app/actions/loans.ts`**

```typescript
'use server'
import { auth } from 'next-auth'
import { db } from '@/lib/db'
import { loans, loanPayments } from '@/lib/db/schema'
import { loanSchema, loanPaymentSchema } from '@/lib/validations/loan'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createLoan(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = loanSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  await db.insert(loans).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/loans')
  return { success: true }
}

export async function recordLoanPayment(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = loanPaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  const loan = await db.query.loans.findFirst({
    where: and(eq(loans.id, parsed.data.loanId), eq(loans.userId, session.user.id)),
  })
  if (!loan) return { error: 'Not found' }

  await db.insert(loanPayments).values(parsed.data)
  revalidatePath(`/loans/${parsed.data.loanId}`)
  return { success: true }
}
```

**Step 3: Create `src/app/(app)/loans/page.tsx`** — list all loans with outstanding balance, next EMI date, progress bar (paid vs total).

**Step 4: Create `src/app/(app)/loans/[id]/page.tsx`** — EMI schedule table, Recharts bar chart (principal vs interest per payment), payoff projection.

**Step 5: Commit**

```bash
git add src/lib/validations/loan.ts src/app/actions/loans.ts src/app/\(app\)/loans/
git commit -m "feat(loans): add loan tracking, payments, and detail page"
```

---

### Task 6.2: Insurance server actions + pages

**Files:**
- Create: `src/lib/validations/insurance.ts`
- Create: `src/app/actions/insurance.ts`
- Create: `src/app/(app)/insurance/page.tsx`
- Create: `src/app/(app)/insurance/[id]/page.tsx`

**Step 1: Create `src/lib/validations/insurance.ts`**

```typescript
import { z } from 'zod'

export const insuranceSchema = z.object({
  name: z.string().min(1),
  provider: z.string().optional(),
  policyType: z.enum(['life','health','vehicle','property','term','other']),
  premiumAmount: z.coerce.number().positive(),
  premiumFrequency: z.enum(['monthly','quarterly','annual']),
  coverageAmount: z.coerce.number().optional(),
  currency: z.string().length(3),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().optional(),
  renewalDate: z.string().optional(),
  nominee: z.string().optional(),
  notes: z.string().optional(),
})
```

**Step 2: Create `src/app/actions/insurance.ts`** — `createPolicy`, `recordPremiumPayment`, `deletePolicy` — mirror loan action pattern.

**Step 3: Create `src/app/(app)/insurance/page.tsx`** — policy cards with renewal date badge (red if within 30 days), annual premium cost summary.

**Step 4: Create `src/app/(app)/insurance/[id]/page.tsx`** — policy details, payment history, edit form.

**Step 5: Commit**

```bash
git add src/lib/validations/insurance.ts src/app/actions/insurance.ts src/app/\(app\)/insurance/
git commit -m "feat(insurance): add policy tracking and premium payment pages"
```

---

## Phase 7: Budgets + Savings Goals

### Task 7.1: Budget server actions + page

**Files:**
- Create: `src/lib/validations/budget.ts`
- Create: `src/app/actions/budgets.ts`
- Create: `src/app/(app)/budgets/page.tsx`

**Step 1: Create `src/lib/validations/budget.ts`**

```typescript
import { z } from 'zod'

export const budgetSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  periodType: z.enum(['monthly', 'weekly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().optional(),
})

export const savingsGoalSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive(),
  currency: z.string().length(3),
  linkedAccountId: z.string().uuid().optional(),
  deadline: z.string().optional(),
})
```

**Step 2: Create `src/app/actions/budgets.ts`**

```typescript
'use server'
import { auth } from 'next-auth'
import { db } from '@/lib/db'
import { budgets, savingsGoals } from '@/lib/db/schema'
import { budgetSchema, savingsGoalSchema } from '@/lib/validations/budget'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createBudget(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  const parsed = budgetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }
  await db.insert(budgets).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/budgets')
  return { success: true }
}

export async function createSavingsGoal(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  const parsed = savingsGoalSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }
  await db.insert(savingsGoals).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/budgets/goals')
  return { success: true }
}

export async function contributeToGoal(goalId: string, amount: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const goal = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, session.user.id)),
  })
  if (!goal) return { error: 'Not found' }

  const newAmount = Number(goal.currentAmount) + amount
  const status = newAmount >= Number(goal.targetAmount) ? 'achieved' : 'active'
  await db.update(savingsGoals)
    .set({ currentAmount: String(newAmount), status, updatedAt: new Date() })
    .where(eq(savingsGoals.id, goalId))

  revalidatePath('/budgets/goals')
  return { success: true }
}
```

**Step 3: Create `src/app/(app)/budgets/page.tsx`**

Query active budgets + sum of transactions per category for current period. Render radial progress rings per budget (Recharts `RadialBarChart`). Show over-budget categories in red.

**Step 4: Create `src/app/(app)/budgets/goals/page.tsx`**

List savings goals with progress bars, deadline countdown, contribute button that opens a sheet with amount input calling `contributeToGoal`.

**Step 5: Commit**

```bash
git add src/lib/validations/budget.ts src/app/actions/budgets.ts src/app/\(app\)/budgets/
git commit -m "feat(budgets): add budget tracking and savings goals pages"
```

---

## Phase 8: Dashboard + Networth

### Task 8.1: Networth calculation utility

**Files:**
- Create: `src/lib/utils/networth.ts`

**Step 1: Create `src/lib/utils/networth.ts`**

```typescript
import { db } from '@/lib/db'
import { transactions, investments, loans, savingsGoals, accounts } from '@/lib/db/schema'
import { eq, and, isNull, sum, sql } from 'drizzle-orm'
import { getRate } from './currency'

export async function computeNetworth(userId: string, baseCurrency: string) {
  // Total investment value
  const invRows = await db.query.investments.findMany({
    where: and(eq(investments.userId, userId), isNull(investments.deletedAt)),
  })
  let totalInvestments = 0
  for (const inv of invRows) {
    const rate = await getRate(inv.currency, baseCurrency)
    totalInvestments += Number(inv.currentPrice ?? inv.buyPrice ?? 0) * Number(inv.quantity ?? 1) * rate
  }

  // Total outstanding loans
  const loanRows = await db.query.loans.findMany({
    where: and(eq(loans.userId, userId), isNull(loans.deletedAt)),
  })
  let totalLiabilities = 0
  for (const loan of loanRows) {
    const rate = await getRate(loan.currency, baseCurrency)
    totalLiabilities += Number(loan.outstandingBalance ?? 0) * rate
  }

  // Account balances (sum of transactions per account)
  const balanceResult = await db
    .select({
      currency: accounts.currency,
      balance: sql<string>`
        COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount}
                         WHEN ${transactions.type} = 'expense' THEN -${transactions.amount}
                         ELSE 0 END), 0)`,
    })
    .from(accounts)
    .leftJoin(transactions, and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)))
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .groupBy(accounts.id, accounts.currency)

  let totalCash = 0
  for (const row of balanceResult) {
    const rate = await getRate(row.currency, baseCurrency)
    totalCash += Number(row.balance) * rate
  }

  const networth = totalCash + totalInvestments - totalLiabilities
  return { networth, totalCash, totalInvestments, totalLiabilities }
}
```

**Step 2: Commit**

```bash
git add src/lib/utils/networth.ts
git commit -m "feat(networth): add networth computation utility"
```

---

### Task 8.2: Dashboard page

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/dashboard/NetworthCard.tsx`
- Create: `src/components/dashboard/CashFlowSummary.tsx`
- Create: `src/components/dashboard/BudgetRings.tsx`
- Create: `src/components/dashboard/UpcomingAlerts.tsx`

**Step 1: Create `src/app/(app)/dashboard/page.tsx`**

```typescript
import { auth } from 'next-auth'
import { db } from '@/lib/db'
import { computeNetworth } from '@/lib/utils/networth'
import { transactions, loans, insurancePolicies, savingsGoals, budgets } from '@/lib/db/schema'
import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm'
import { NetworthCard } from '@/components/dashboard/NetworthCard'
import { CashFlowSummary } from '@/components/dashboard/CashFlowSummary'
import { BudgetRings } from '@/components/dashboard/BudgetRings'
import { UpcomingAlerts } from '@/components/dashboard/UpcomingAlerts'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) })

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [networthData, recentTxs, monthlyTxs, activeBudgets, upcomingLoans, upcomingRenewals] =
    await Promise.all([
      computeNetworth(userId, user?.defaultCurrency ?? 'INR'),
      db.query.transactions.findMany({
        where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
        orderBy: [desc(transactions.date)], limit: 5,
        with: { category: true },
      }),
      db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
        ),
      }),
      db.query.budgets.findMany({
        where: and(eq(budgets.userId, userId), isNull(budgets.deletedAt)),
        with: { category: true },
      }),
      db.query.loans.findMany({
        where: and(eq(loans.userId, userId), isNull(loans.deletedAt)),
      }),
      db.query.insurancePolicies.findMany({
        where: and(eq(insurancePolicies.userId, userId), isNull(insurancePolicies.deletedAt)),
      }),
    ])

  return (
    <div className="p-4 space-y-6">
      <NetworthCard {...networthData} currency={user?.defaultCurrency ?? 'INR'} />
      <CashFlowSummary transactions={monthlyTxs} currency={user?.defaultCurrency ?? 'INR'} />
      <BudgetRings budgets={activeBudgets} transactions={monthlyTxs} />
      <UpcomingAlerts loans={upcomingLoans} policies={upcomingRenewals} />
    </div>
  )
}
```

**Step 2: `NetworthCard`** — large networth number, total assets, total liabilities, simple `AreaChart` using last 6 months (store monthly snapshots or compute on the fly).

**Step 3: `CashFlowSummary`** — total income vs expense this month, net cash flow chip.

**Step 4: `BudgetRings`** — `RadialBarChart` per budget, % spent, color coded.

**Step 5: `UpcomingAlerts`** — next 30 days: EMI due dates, insurance renewals, goal deadlines. Badge style alert cards.

**Step 6: Create `src/app/(app)/networth/page.tsx`** — full networth history using Recharts `AreaChart`, breakdown by asset class using `PieChart`.

**Step 7: Commit**

```bash
git add src/app/\(app\)/dashboard/ src/app/\(app\)/networth/ src/components/dashboard/
git commit -m "feat(dashboard): add dashboard and networth pages"
```

---

## Phase 9: Reports

### Task 9.1: Report data utilities

**Files:**
- Create: `src/lib/utils/reports.ts`

**Step 1: Create `src/lib/utils/reports.ts`**

```typescript
import { db } from '@/lib/db'
import { transactions } from '@/lib/db/schema'
import { eq, and, isNull, gte, lte, sql } from 'drizzle-orm'

export async function getCashFlowByMonth(userId: string, months = 12) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)

  return db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      income: sql<string>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.convertedAmount}::numeric ELSE 0 END)`,
      expense: sql<string>`SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.convertedAmount}::numeric ELSE 0 END)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, since.toISOString().slice(0, 10)),
    ))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
}

export async function getCategoryBreakdown(userId: string, startDate: string, endDate: string) {
  return db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`SUM(${transactions.convertedAmount}::numeric)`,
      type: transactions.type,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ))
    .groupBy(transactions.categoryId, transactions.type)
}
```

**Step 2: Commit**

```bash
git add src/lib/utils/reports.ts
git commit -m "feat(reports): add report data query utilities"
```

---

### Task 9.2: Report pages

**Files:**
- Create: `src/app/(app)/reports/page.tsx`
- Create: `src/app/(app)/reports/cash-flow/page.tsx`
- Create: `src/app/(app)/reports/category-breakdown/page.tsx`
- Create: `src/app/(app)/reports/investment-returns/page.tsx`
- Create: `src/app/(app)/reports/debt-payoff/page.tsx`
- Create: `src/app/(app)/reports/budget-vs-actual/page.tsx`

**Step 1: `reports/page.tsx`** — navigation grid of report cards linking to each sub-report.

**Step 2: `cash-flow/page.tsx`** — `BarChart` (income vs expense per month, 12 months). Date range picker to adjust window.

**Step 3: `category-breakdown/page.tsx`** — `PieChart` of expense categories for selected month. Toggle income/expense.

**Step 4: `investment-returns/page.tsx`** — table of each investment: invested amount, current value, absolute return, % return, XIRR (if enough data). Total portfolio return summary card.

**Step 5: `debt-payoff/page.tsx`** — per loan: outstanding balance, projected payoff date, total interest remaining. `AreaChart` showing balance reduction over time.

**Step 6: `budget-vs-actual/page.tsx`** — horizontal bar chart per category: budget amount vs actual spend, % used, over/under amount.

**Step 7: Commit**

```bash
git add src/app/\(app\)/reports/
git commit -m "feat(reports): add all report pages with charts"
```

---

## Phase 10: Import/Export + Settings

### Task 10.1: CSV import

**Files:**
- Create: `src/lib/utils/csv.ts`
- Create: `src/app/api/import/route.ts`
- Create: `src/app/(app)/import/page.tsx`

**Step 1: Create `src/lib/utils/csv.ts`**

```typescript
import Papa from 'papaparse'

export const CSV_TEMPLATE_HEADERS = [
  'date',         // YYYY-MM-DD
  'type',         // income | expense | transfer
  'amount',       // positive number
  'currency',     // ISO 4217 e.g. INR
  'category',     // category name (matched or created)
  'account',      // account name (must exist)
  'note',         // optional
  'tags',         // comma-separated tag names
]

export function parseCSV(text: string) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true })
  return result.data as Record<string, string>[]
}

export function generateTemplateCSV(): string {
  const header = CSV_TEMPLATE_HEADERS.join(',')
  const example = '2026-01-15,expense,1500,INR,Food,HDFC Savings,Lunch,food dining'
  return `${header}\n${example}\n`
}
```

**Step 2: Create `src/app/api/import/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from 'next-auth'
import { parseCSV } from '@/lib/utils/csv'
import { db } from '@/lib/db'
import { transactions, categories, accounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  const errors: string[] = []
  let imported = 0

  for (const [i, row] of rows.entries()) {
    try {
      // resolve account
      const account = await db.query.accounts.findFirst({
        where: and(eq(accounts.userId, session.user.id!), eq(accounts.name, row.account)),
      })
      if (!account) { errors.push(`Row ${i + 2}: account "${row.account}" not found`); continue }

      // resolve or create category
      let category = await db.query.categories.findFirst({
        where: and(eq(categories.name, row.category)),
      })
      if (!category && row.category) {
        const [cat] = await db.insert(categories).values({
          userId: session.user.id!,
          name: row.category,
          type: row.type === 'income' ? 'income' : 'expense',
        }).returning()
        category = cat
      }

      await db.insert(transactions).values({
        userId: session.user.id!,
        accountId: account.id,
        type: row.type as 'income' | 'expense' | 'transfer',
        amount: row.amount,
        currency: row.currency || 'INR',
        categoryId: category?.id,
        note: row.note,
        date: row.date,
      })
      imported++
    } catch (e) {
      errors.push(`Row ${i + 2}: ${String(e)}`)
    }
  }

  return NextResponse.json({ imported, errors })
}
```

**Step 3: Create `src/app/(app)/import/page.tsx`** — client page with:
- Download template button (`generateTemplateCSV()` as blob download)
- File upload input (CSV only)
- Preview table (first 5 rows of parsed CSV)
- Confirm import button → POST to `/api/import` → show results (X imported, Y errors)

**Step 4: Commit**

```bash
git add src/lib/utils/csv.ts src/app/api/import/ src/app/\(app\)/import/
git commit -m "feat(import): add CSV template download and transaction import"
```

---

### Task 10.2: Settings pages

**Files:**
- Create: `src/app/(app)/settings/profile/page.tsx`
- Create: `src/app/(app)/settings/currencies/page.tsx`
- Create: `src/app/(app)/settings/categories/page.tsx`
- Create: `src/app/(app)/settings/accounts/page.tsx`
- Create: `src/app/(app)/settings/data/page.tsx`
- Create: `src/app/actions/settings.ts`

**Step 1: Create `src/app/actions/settings.ts`**

```typescript
'use server'
import { auth } from 'next-auth'
import { db } from '@/lib/db'
import { users, accounts, categories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  const schema = z.object({ name: z.string().min(1), timezone: z.string(), defaultCurrency: z.string().length(3) })
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }
  await db.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, session.user.id))
  revalidatePath('/settings/profile')
  return { success: true }
}

export async function createAccount(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  const schema = z.object({ name: z.string().min(1), type: z.enum(['bank','wallet','cash','savings']), currency: z.string().length(3) })
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }
  await db.insert(accounts).values({ ...parsed.data, userId: session.user.id })
  revalidatePath('/settings/accounts')
  return { success: true }
}
```

**Step 2: Settings pages** — each page is a simple form or list with add/edit/delete:
- `profile/page.tsx` — name, email (read-only), timezone select, default currency select
- `currencies/page.tsx` — exchange rate mode toggle (auto/manual), manual rate overrides table
- `categories/page.tsx` — list income/expense categories, add/rename/delete
- `accounts/page.tsx` — list accounts with computed balance, add new account
- `data/page.tsx` — export all data as CSV button, danger zone: delete all data

**Step 3: Exchange rate cron Route Handler**

Create `src/app/api/cron/exchange-rates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exchangeRates } from '@/lib/db/schema'

const CURRENCIES = ['INR','USD','EUR','GBP','JPY','SGD','AED','BTC']

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?base=INR&symbols=${CURRENCIES.filter(c => c !== 'INR').join(',')}`)
    const data = await res.json()

    for (const [target, rate] of Object.entries(data.rates as Record<string, number>)) {
      await db.insert(exchangeRates)
        .values({ base: 'INR', target, rate: String(rate), fetchedAt: new Date() })
        .onConflictDoUpdate({ target: [exchangeRates.base, exchangeRates.target], set: { rate: String(rate), fetchedAt: new Date() } })
    }
    return NextResponse.json({ updated: Object.keys(data.rates).length })
  } catch {
    return NextResponse.json({ error: 'Fetch failed, using cached rates' }, { status: 200 })
  }
}
```

**Step 4: Commit**

```bash
git add src/app/actions/settings.ts src/app/\(app\)/settings/ src/app/api/cron/
git commit -m "feat(settings): add profile, accounts, categories, currency settings and exchange rate cron"
```

---

## Phase 11: Docker + CI/CD + nginx

### Task 11.1: Production Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: Create `Dockerfile`**

```dockerfile
# Stage 1: deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: runner (standalone output)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S ledgerify && adduser -S ledgerify -G ledgerify

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER ledgerify
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Step 2: Add `output: 'standalone'` to `next.config.ts`**

```typescript
const nextConfig = {
  output: 'standalone',
}
export default nextConfig
```

**Step 3: Create `.dockerignore`**

```
node_modules
.next
.env*.local
.git
README.md
docs/
drizzle/
```

**Step 4: Build and test locally**

```bash
docker build -t ledgerify-web .
docker run -p 3000:3000 --env-file .env.local ledgerify-web
```
Expected: App runs on localhost:3000 from Docker image.

**Step 5: Commit**

```bash
git add Dockerfile .dockerignore next.config.ts
git commit -m "chore: add production Dockerfile with multi-stage standalone build"
```

---

### Task 11.2: Production Docker Compose

**Files:**
- Create: `docker-compose.prod.yml`

**Step 1: Create `docker-compose.prod.yml`**

```yaml
services:
  app:
    image: ghcr.io/kts-o7/ledgerify-web:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: ${AUTH_URL}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      CRON_SECRET: ${CRON_SECRET}
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    expose:
      - "5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg_data:
```

**Step 2: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "chore: add production Docker Compose"
```

---

### Task 11.3: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/ledgerify
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker image prune -f
```

**Step 2: Add GitHub Secrets** (in repo Settings → Secrets):
- `VPS_HOST` — `192.3.228.223`
- `VPS_USER` — your SSH user (e.g. `root` or `ubuntu`)
- `VPS_SSH_KEY` — private key contents (`cat ~/.ssh/id_rsa`)

**Step 3: Set up VPS directory**

SSH into VPS and run:
```bash
mkdir -p /opt/ledgerify
cp docker-compose.prod.yml /opt/ledgerify/
cp .env.production /opt/ledgerify/.env   # create this with prod values
```

**Step 4: Commit**

```bash
git add .github/
git commit -m "chore: add GitHub Actions CI/CD pipeline"
```

---

### Task 11.4: nginx config for money.shenthar.me

**Step 1: SSH into VPS and create nginx config**

```bash
cat > /etc/nginx/sites-available/money.shenthar.me << 'EOF'
server {
    listen 80;
    server_name money.shenthar.me;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name money.shenthar.me;

    ssl_certificate /etc/letsencrypt/live/money.shenthar.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/money.shenthar.me/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

**Step 2: Enable site and get TLS cert**

```bash
ln -s /etc/nginx/sites-available/money.shenthar.me /etc/nginx/sites-enabled/
nginx -t
certbot --nginx -d money.shenthar.me
systemctl reload nginx
```

**Step 3: Add cron for exchange rates**

```bash
crontab -e
# Add:
0 6 * * * curl -s -H "x-cron-secret: YOUR_CRON_SECRET" https://money.shenthar.me/api/cron/exchange-rates
```

**Step 4: Verify deployment**

```bash
curl -I https://money.shenthar.me
```
Expected: HTTP/2 200, TLS cert valid.

---

## Shared Layout Components (reference)

### `src/components/shared/Sidebar.tsx`
Desktop sidebar with nav links: Dashboard, Transactions, Investments, Loans, Insurance, Budgets, Goals, Networth, Reports, Import, Settings. Active link highlighted. Collapsible on narrow desktop.

### `src/components/shared/BottomNav.tsx`
Mobile bottom bar: 5 tabs — Dashboard | Transactions | + (FAB for quick add sheet) | Investments | More (opens drawer with remaining links).

---

## Execution Options

Plan complete and saved to `docs/plans/2026-04-28-ledgerify-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** — open new session with the executing-plans skill, batch execution with checkpoints.

Which approach do you prefer?

