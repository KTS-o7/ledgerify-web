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
